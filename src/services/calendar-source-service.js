import crypto from 'node:crypto';
import { validateCalendarSourceData } from '../domain/calendar-source.js';
import { NotFoundError } from './agenda-service.js';
import { ValidationError } from '../domain/meeting.js';
import { safeFetchICS } from '../domain/ssrf-guard.js';
import { parseICal } from '../domain/ical-parser.js';

function mapRowToCalendarSource(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    url: row.url || null,
    color: row.color,
    enabled: row.enabled === 1 || row.enabled === true ? 1 : 0,
    lastSyncedAt: row.last_synced_at || null,
    syncStatus: row.sync_status || 'ok',
    syncError: row.sync_error || '',
    eventCount: row.event_count !== undefined ? Number(row.event_count) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class CalendarSourceService {
  constructor(db) {
    this.db = db;
  }

  createSource(data) {
    const validated = validateCalendarSourceData(data);
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO calendar_sources (id, name, type, url, color, enabled, last_synced_at, sync_status, sync_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      validated.name,
      validated.type,
      validated.url,
      validated.color,
      validated.enabled,
      null,
      validated.syncStatus,
      validated.syncError,
      now,
      now
    );

    return {
      id,
      ...validated,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now
    };
  }

  getSources() {
    const stmt = this.db.prepare(`
      SELECT cs.*,
        (SELECT COUNT(*) FROM meetings m WHERE m.source_id = cs.id) as event_count
      FROM calendar_sources cs
      ORDER BY cs.created_at ASC
    `);
    const rows = stmt.all();
    return rows.map(mapRowToCalendarSource);
  }

  getSourceById(id) {
    const stmt = this.db.prepare(`
      SELECT cs.*,
        (SELECT COUNT(*) FROM meetings m WHERE m.source_id = cs.id) as event_count
      FROM calendar_sources cs
      WHERE cs.id = ?
    `);
    const row = stmt.get(id);
    return mapRowToCalendarSource(row);
  }

  updateSource(id, data = {}) {
    const existing = this.getSourceById(id);
    if (!existing) {
      throw new NotFoundError(`Calendar source with id "${id}" not found.`);
    }

    const validated = validateCalendarSourceData(data, { isPartial: true });
    const now = new Date().toISOString();

    const merged = {
      name: validated.name !== undefined ? validated.name : existing.name,
      type: validated.type !== undefined ? validated.type : existing.type,
      url: validated.url !== undefined ? validated.url : existing.url,
      color: validated.color !== undefined ? validated.color : existing.color,
      enabled: validated.enabled !== undefined ? validated.enabled : existing.enabled,
      syncStatus: validated.syncStatus !== undefined ? validated.syncStatus : existing.syncStatus,
      syncError: validated.syncError !== undefined ? validated.syncError : existing.syncError
    };

    const stmt = this.db.prepare(`
      UPDATE calendar_sources
      SET name = ?, type = ?, url = ?, color = ?, enabled = ?, sync_status = ?, sync_error = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.name,
      merged.type,
      merged.url,
      merged.color,
      merged.enabled,
      merged.syncStatus,
      merged.syncError,
      now,
      id
    );

    return {
      id,
      ...merged,
      lastSyncedAt: existing.lastSyncedAt,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  deleteSource(id) {
    const stmt = this.db.prepare('DELETE FROM calendar_sources WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new NotFoundError(`Calendar source with id "${id}" not found.`);
    }

    return true;
  }

  async syncSource(id, { fetchFn, dnsLookup } = {}) {
    const source = this.getSourceById(id);
    if (!source) {
      throw new NotFoundError(`Calendar source with id "${id}" not found.`);
    }

    if (source.type !== 'subscription' || !source.url) {
      throw new ValidationError('Only subscription sources with a valid URL can be synced.');
    }

    const now = new Date().toISOString();

    let icsContent;
    try {
      icsContent = await safeFetchICS(source.url, { fetchFn, dnsLookup });
    } catch (err) {
      // Record sync error in DB without dropping previous meetings
      const updateStmt = this.db.prepare(`
        UPDATE calendar_sources
        SET sync_status = 'error', sync_error = ?, updated_at = ?
        WHERE id = ?
      `);
      updateStmt.run(err.message, now, id);
      throw err;
    }

    const parsedEvents = parseICal(icsContent);

    // Upsert events idempotently based on (source_id, external_uid)
    const findStmt = this.db.prepare(`
      SELECT id FROM meetings WHERE source_id = ? AND external_uid = ?
    `);

    const insertStmt = this.db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, location, notes, source_id, entry_type, all_day, external_uid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.db.prepare(`
      UPDATE meetings
      SET title = ?, start_time = ?, end_time = ?, date = ?, location = ?, notes = ?, entry_type = ?, all_day = ?, updated_at = ?
      WHERE id = ?
    `);

    for (const ev of parsedEvents) {
      const existing = findStmt.get(id, ev.externalUid);
      if (existing) {
        updateStmt.run(
          ev.title,
          ev.startTime,
          ev.endTime,
          ev.date,
          ev.location,
          ev.notes,
          ev.entryType,
          ev.allDay,
          now,
          existing.id
        );
      } else {
        const meetingId = crypto.randomUUID();
        insertStmt.run(
          meetingId,
          ev.title,
          ev.startTime,
          ev.endTime,
          ev.date,
          ev.location,
          ev.notes,
          id,
          ev.entryType,
          ev.allDay,
          ev.externalUid,
          now,
          now
        );
      }
    }

    // Update source sync status to 'ok'
    const statusStmt = this.db.prepare(`
      UPDATE calendar_sources
      SET last_synced_at = ?, sync_status = 'ok', sync_error = '', updated_at = ?
      WHERE id = ?
    `);
    statusStmt.run(now, now, id);

    return {
      synced: true,
      eventCount: parsedEvents.length,
      syncedAt: now
    };
  }

  importManualICS({ name, color, icsContent } = {}) {
    if (typeof icsContent !== 'string' || !icsContent.trim()) {
      throw new ValidationError('icsContent is required and cannot be empty.');
    }

    const source = this.createSource({
      name,
      type: 'manual_import',
      color
    });

    const parsedEvents = parseICal(icsContent);
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, location, notes, source_id, entry_type, all_day, external_uid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ev of parsedEvents) {
      const meetingId = crypto.randomUUID();
      insertStmt.run(
        meetingId,
        ev.title,
        ev.startTime,
        ev.endTime,
        ev.date,
        ev.location,
        ev.notes,
        source.id,
        ev.entryType,
        ev.allDay,
        ev.externalUid,
        now,
        now
      );
    }

    return {
      calendarSource: source,
      importedCount: parsedEvents.length
    };
  }
}
