import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
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
