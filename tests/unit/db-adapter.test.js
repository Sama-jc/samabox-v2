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
    assert.ok(tableNames.includes('tasks'), 'tasks table should exist');
    assert.ok(tableNames.includes('briefing_items'), 'briefing_items table should exist');
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
