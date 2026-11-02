import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, initSchema } from '../../src/adapters/db.js';
import { createTestDatabase, clearDatabase } from '../helpers/test-db.js';

describe('SQLite Adapter & Schema', () => {
  it('should initialize tables in memory database', () => {
    const db = createDatabase(':memory:');
    
    // Check tables exist in sqlite_master
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map(t => t.name);

    assert.ok(tableNames.includes('meetings'), 'meetings table should exist');
    assert.ok(tableNames.includes('calendar_sources'), 'calendar_sources table should exist');
    assert.ok(tableNames.includes('tasks'), 'tasks table should exist');
    assert.ok(tableNames.includes('briefing_items'), 'briefing_items table should exist');
    db.close();
  });

  it('should verify V2 columns on meetings table and cascade delete on source removal', () => {
    const db = createTestDatabase();
    const columns = db.prepare("PRAGMA table_info('meetings')").all().map(c => c.name);

    assert.ok(columns.includes('source_id'), 'source_id column should exist on meetings');
    assert.ok(columns.includes('entry_type'), 'entry_type column should exist on meetings');
    assert.ok(columns.includes('all_day'), 'all_day column should exist on meetings');
    assert.ok(columns.includes('external_uid'), 'external_uid column should exist on meetings');

    const now = new Date().toISOString();
    // Insert a calendar source
    db.prepare(`
      INSERT INTO calendar_sources (id, name, type, url, color, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('src-1', 'Google Cal', 'subscription', 'https://example.com/cal.ics', '#3b82f6', 1, now, now);

    // Insert a meeting linked to that source
    db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, external_uid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m-ext-1', 'External Event', '10:00', '11:00', '2026-11-02', 'src-1', 'meeting', 0, 'ext-uid-1', now, now);

    // Verify meeting exists
    const mRow = db.prepare('SELECT * FROM meetings WHERE id = ?').get('m-ext-1');
    assert.equal(mRow.id, 'm-ext-1');
    assert.equal(mRow.source_id, 'src-1');

    // Delete calendar source -> CASCADE delete should remove meeting
    db.prepare('DELETE FROM calendar_sources WHERE id = ?').run('src-1');
    const meetingAfterDelete = db.prepare('SELECT * FROM meetings WHERE id = ?').get('m-ext-1');
    assert.equal(meetingAfterDelete, undefined, 'Meeting linked to deleted source should be cascaded');

    db.close();
  });

  it('should insert and retrieve a meeting row adhering to schema', () => {
    const db = createTestDatabase();
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, location, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('m1', 'Sprint Planning', '09:00', '10:00', '2026-11-02', 'Room A', 'Review backlog', now, now);

    const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get('m1');
    assert.equal(row.id, 'm1');
    assert.equal(row.title, 'Sprint Planning');
    assert.equal(row.start_time, '09:00');
    assert.equal(row.end_time, '10:00');
    assert.equal(row.date, '2026-11-02');
    assert.equal(row.location, 'Room A');
    assert.equal(row.notes, 'Review backlog');

    clearDatabase(db);
    const count = db.prepare('SELECT COUNT(*) as c FROM meetings').get();
    assert.equal(count.c, 0);
    db.close();
  });
});
