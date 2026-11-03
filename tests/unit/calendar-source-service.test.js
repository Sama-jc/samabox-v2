import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../helpers/test-db.js';
import { CalendarSourceService } from '../../src/services/calendar-source-service.js';
import { NotFoundError } from '../../src/services/agenda-service.js';
import { ValidationError } from '../../src/domain/meeting.js';
import { SSRFError } from '../../src/domain/ssrf-guard.js';
import { GOOGLE_CALENDAR_ICS, APPLE_CALENDAR_ICS } from '../helpers/test-fixtures.js';

describe('CalendarSourceService Unit Tests', () => {
  let db;
  let service;

  beforeEach(() => {
    db = createTestDatabase();
    service = new CalendarSourceService(db);
  });

  describe('createSource', () => {
    it('should create a valid subscription source', () => {
      const source = service.createSource({
        name: 'Google Work',
        type: 'subscription',
        url: 'https://calendar.google.com/feed.ics',
        color: '#10b981'
      });

      assert.ok(source.id);
      assert.equal(source.name, 'Google Work');
      assert.equal(source.type, 'subscription');
      assert.equal(source.url, 'https://calendar.google.com/feed.ics');
      assert.equal(source.color, '#10b981');
      assert.equal(source.enabled, 1);
      assert.equal(source.syncStatus, 'ok');
    });

    it('should throw ValidationError on missing name or invalid type', () => {
      assert.throws(
        () => service.createSource({ type: 'subscription', url: 'https://cal.ics' }),
        (err) => err instanceof ValidationError
      );

      assert.throws(
        () => service.createSource({ name: 'Cal', type: 'invalid_type' }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('getSources and getSourceById', () => {
    it('should list all sources with eventCount metric', () => {
      const src1 = service.createSource({ name: 'Work', type: 'subscription', url: 'https://a.test' });
      const src2 = service.createSource({ name: 'Personal', type: 'manual_import', color: '#ec4899' });

      // Add a meeting linked to src1
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('m1', 'Team Sync', '09:00', '10:00', '2026-11-02', src1.id, 'meeting', 0, now, now);

      const sources = service.getSources();
      assert.equal(sources.length, 2);

      const foundSrc1 = sources.find(s => s.id === src1.id);
      assert.equal(foundSrc1.eventCount, 1);

      const foundSrc2 = sources.find(s => s.id === src2.id);
      assert.equal(foundSrc2.eventCount, 0);
    });

    it('should return null when getSourceById cannot find source', () => {
      const src = service.getSourceById('non-existent');
      assert.equal(src, null);
    });
  });

  describe('updateSource (PATCH)', () => {
    it('should update source fields', () => {
      const created = service.createSource({ name: 'Old Name', type: 'local' });
      const updated = service.updateSource(created.id, { name: 'New Name', color: '#f59e0b', enabled: 0 });

      assert.equal(updated.name, 'New Name');
      assert.equal(updated.color, '#f59e0b');
      assert.equal(updated.enabled, 0);
    });

    it('should throw NotFoundError if source does not exist', () => {
      assert.throws(
        () => service.updateSource('missing-id', { name: 'Test' }),
        (err) => err instanceof NotFoundError
      );
    });
  });

  describe('deleteSource', () => {
    it('should delete source and cascade delete all its meetings', () => {
      const src = service.createSource({ name: 'To Delete', type: 'subscription', url: 'https://del.test' });
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('m-del', 'Event', '11:00', '12:00', '2026-11-02', src.id, 'meeting', 0, now, now);

      service.deleteSource(src.id);

      assert.equal(service.getSourceById(src.id), null);
      const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get('m-del');
      assert.equal(meeting, undefined);
    });

    it('should throw NotFoundError when deleting non-existent source', () => {
      assert.throws(
        () => service.deleteSource('missing-id'),
        (err) => err instanceof NotFoundError
      );
    });
  });

  describe('syncSource (Remote URL Sync)', () => {
    it('should sync remote ICS idempotently without duplicating events on subsequent syncs', async () => {
      const source = service.createSource({
        name: 'Google Sync',
        type: 'subscription',
        url: 'https://calendar.google.com/feed.ics'
      });

      const mockDns = async () => [{ address: '93.184.216.34', family: 4 }];
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(GOOGLE_CALENDAR_ICS.length) }),
        text: async () => GOOGLE_CALENDAR_ICS
      });

      // 1st sync
      const result1 = await service.syncSource(source.id, { dnsLookup: mockDns, fetchFn: mockFetch });
      assert.equal(result1.synced, true);
      assert.equal(result1.eventCount, 2);

      // Verify DB meetings count for this source
      const count1 = db.prepare('SELECT COUNT(*) as c FROM meetings WHERE source_id = ?').get(source.id).c;
      assert.equal(count1, 2);

      // 2nd sync with same feed (must be idempotent: no duplicates!)
      const result2 = await service.syncSource(source.id, { dnsLookup: mockDns, fetchFn: mockFetch });
      assert.equal(result2.synced, true);
      assert.equal(result2.eventCount, 2);

      const count2 = db.prepare('SELECT COUNT(*) as c FROM meetings WHERE source_id = ?').get(source.id).c;
      assert.equal(count2, 2, 'Re-syncing must NOT duplicate meetings with same external_uid');
    });

    it('should retain existing meetings and mark sync_status=error if remote sync fails', async () => {
      const source = service.createSource({
        name: 'Failing Sync',
        type: 'subscription',
        url: 'https://calendar.google.com/fail.ics'
      });

      // Pre-populate with an existing meeting
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, external_uid, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('m-pre', 'Existing Event', '09:00', '10:00', '2026-11-02', source.id, 'meeting', 0, 'uid-pre-1', now, now);

      const mockFailingFetch = async () => {
        throw new Error('Network timeout');
      };
      const mockDns = async () => [{ address: '93.184.216.34', family: 4 }];

      await assert.rejects(
        async () => service.syncSource(source.id, { dnsLookup: mockDns, fetchFn: mockFailingFetch }),
        (err) => err.message.includes('Network timeout')
      );

      // Existing meeting must still exist!
      const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get('m-pre');
      assert.ok(meeting, 'Previous meetings must be retained on sync failure');

      // Source metadata must reflect error
      const updatedSource = service.getSourceById(source.id);
      assert.equal(updatedSource.syncStatus, 'error');
      assert.ok(updatedSource.syncError.includes('Network timeout'));
    });

    it('should prune obsolete meetings whose external_uid is no longer in the synced feed', async () => {
      const source = service.createSource({
        name: 'Prune Sync',
        type: 'subscription',
        url: 'https://calendar.google.com/feed.ics'
      });

      const mockDns = async () => [{ address: '93.184.216.34', family: 4 }];

      // Initial sync with 2 events: google-event-12345@google.com and google-allday-67890@google.com
      const mockFetch1 = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(GOOGLE_CALENDAR_ICS.length) }),
        text: async () => GOOGLE_CALENDAR_ICS
      });
      await service.syncSource(source.id, { dnsLookup: mockDns, fetchFn: mockFetch1 });

      const count1 = db.prepare('SELECT COUNT(*) as c FROM meetings WHERE source_id = ?').get(source.id).c;
      assert.equal(count1, 2);

      // Second sync where one meeting was removed/cancelled from remote calendar
      const reducedIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261102T093000Z
DTEND:20261102T103000Z
UID:google-event-12345@google.com
SUMMARY:Sprint Planning
END:VEVENT
END:VCALENDAR`;

      const mockFetch2 = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(reducedIcs.length) }),
        text: async () => reducedIcs
      });
      const result2 = await service.syncSource(source.id, { dnsLookup: mockDns, fetchFn: mockFetch2 });
      assert.equal(result2.eventCount, 1);

      // The second event (google-allday-67890@google.com) should now be deleted from DB!
      const remainingMeetings = db.prepare('SELECT external_uid FROM meetings WHERE source_id = ?').all(source.id);
      assert.equal(remainingMeetings.length, 1);
      assert.equal(remainingMeetings[0].external_uid, 'google-event-12345@google.com');
    });
  });

  describe('importManualICS', () => {
    it('should import offline .ics content and create manual_import source', () => {
      const result = service.importManualICS({
        name: 'Apple Calendar Offline',
        color: '#8b5cf6',
        icsContent: APPLE_CALENDAR_ICS
      });

      assert.equal(result.importedCount, 1);
      assert.ok(result.calendarSource.id);
      assert.equal(result.calendarSource.type, 'manual_import');
      assert.equal(result.calendarSource.color, '#8b5cf6');

      // Verify meetings in DB
      const meetings = db.prepare('SELECT * FROM meetings WHERE source_id = ?').all(result.calendarSource.id);
      assert.equal(meetings.length, 1);
      assert.equal(meetings[0].title, 'Security Sync & Audit, Team 1');
      assert.equal(meetings[0].start_time, '11:00');
      assert.equal(meetings[0].end_time, '11:45');
    });

    it('should throw ValidationError if icsContent is empty', () => {
      assert.throws(
        () => service.importManualICS({ name: 'Empty', icsContent: '' }),
        (err) => err instanceof ValidationError
      );
    });
  });
});
