import { createDatabase } from '../../src/adapters/db.js';

export function createTestDatabase() {
  return createDatabase(':memory:');
}

export function clearDatabase(db) {
  db.exec('DELETE FROM meetings;');
  db.exec('DELETE FROM tasks;');
  db.exec('DELETE FROM briefing_items;');
}
