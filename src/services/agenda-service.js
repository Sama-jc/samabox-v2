import crypto from 'node:crypto';
import {
  validateMeetingData,
  detectMeetingConflicts,
  getTodayDateString,
  ValidationError
} from '../domain/meeting.js';

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

function mapRowToMeeting(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    date: row.date,
    location: row.location || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class AgendaService {
  constructor(db) {
    this.db = db;
  }

  createMeeting(input) {
    const validated = validateMeetingData(input);
    const id = input.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, location, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      validated.title,
      validated.startTime,
      validated.endTime,
      validated.date,
      validated.location,
      validated.notes,
      now,
      now
    );

    return {
      id,
      ...validated,
      createdAt: now,
      updatedAt: now
    };
  }

  getMeetingById(id) {
    const stmt = this.db.prepare('SELECT * FROM meetings WHERE id = ?');
    const row = stmt.get(id);
    return mapRowToMeeting(row);
  }

  getMeetingsByDate(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();
    const stmt = this.db.prepare('SELECT * FROM meetings WHERE date = ?');
    const rows = stmt.all(queryDate);
    const meetings = rows.map(mapRowToMeeting);
    return detectMeetingConflicts(meetings);
  }

  updateMeeting(id, data = {}) {
    const existing = this.getMeetingById(id);
    if (!existing) {
      throw new NotFoundError(`Meeting with id "${id}" not found.`);
    }

    const merged = {
      title: data.title !== undefined ? data.title : existing.title,
      startTime: data.startTime !== undefined ? data.startTime : existing.startTime,
      endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
      date: data.date !== undefined ? data.date : existing.date,
      location: data.location !== undefined ? data.location : existing.location,
      notes: data.notes !== undefined ? data.notes : existing.notes
    };

    const validated = validateMeetingData(merged);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE meetings
      SET title = ?, start_time = ?, end_time = ?, date = ?, location = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      validated.title,
      validated.startTime,
      validated.endTime,
      validated.date,
      validated.location,
      validated.notes,
      now,
      id
    );

    return {
      id,
      ...validated,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  deleteMeeting(id) {
    const stmt = this.db.prepare('DELETE FROM meetings WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new NotFoundError(`Meeting with id "${id}" not found.`);
    }

    return true;
  }
}
