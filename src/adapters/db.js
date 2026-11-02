import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS calendar_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('subscription', 'manual_import', 'local')),
    url TEXT DEFAULT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT DEFAULT NULL,
    sync_status TEXT NOT NULL DEFAULT 'ok' CHECK(sync_status IN ('ok', 'error')),
    sync_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    source_id TEXT DEFAULT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL DEFAULT 'meeting' CHECK(entry_type IN ('meeting', 'reminder')),
    all_day INTEGER NOT NULL DEFAULT 0,
    external_uid TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('Alta', 'Media', 'Baja')),
    status TEXT NOT NULL CHECK(status IN ('Pendiente', 'En Progreso', 'Completada')),
    is_focus INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefing_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    published_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    commentary TEXT NOT NULL,
    analysis_mode TEXT NOT NULL,
    briefing_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);
`;

export function initSchema(db) {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);

  // Idempotent column additions for pre-existing meetings tables
  const columns = db.prepare("PRAGMA table_info('meetings')").all().map((c) => c.name);
  if (!columns.includes('source_id')) {
    db.exec("ALTER TABLE meetings ADD COLUMN source_id TEXT DEFAULT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE;");
  }
  if (!columns.includes('entry_type')) {
    db.exec("ALTER TABLE meetings ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'meeting';");
  }
  if (!columns.includes('all_day')) {
    db.exec("ALTER TABLE meetings ADD COLUMN all_day INTEGER NOT NULL DEFAULT 0;");
  }
  if (!columns.includes('external_uid')) {
    db.exec("ALTER TABLE meetings ADD COLUMN external_uid TEXT DEFAULT NULL;");
  }

  // Create performance indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
    CREATE INDEX IF NOT EXISTS idx_meetings_source_id ON meetings(source_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_external_uid ON meetings(external_uid);
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
    CREATE INDEX IF NOT EXISTS idx_briefing_date ON briefing_items(briefing_date);
  `);
}

export function createDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new DatabaseSync(dbPath);
  initSchema(db);
  return db;
}
