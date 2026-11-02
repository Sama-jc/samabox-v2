import crypto from 'node:crypto';
import {
  validateTaskData,
  sortTasksIntelligently,
  calculateTaskStats
} from '../domain/task.js';
import { getTodayDateString } from '../domain/meeting.js';
import { NotFoundError } from './agenda-service.js';

function mapRowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    isFocus: Boolean(row.is_focus),
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class TaskService {
  constructor(db) {
    this.db = db;
  }

  createTask(input) {
    const validated = validateTaskData(input);
    const id = input.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const isFocusInt = validated.isFocus ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, priority, status, is_focus, date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      validated.title,
      validated.priority,
      validated.status,
      isFocusInt,
      validated.date,
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

  getTaskById(id) {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id);
    return mapRowToTask(row);
  }

  getTasksByDate(date, filters = {}) {
    const queryDate = date ? String(date).trim() : getTodayDateString();
    let sql = 'SELECT * FROM tasks WHERE date = ?';
    const params = [queryDate];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.priority) {
      sql += ' AND priority = ?';
      params.push(filters.priority);
    }

    if (filters.isFocus !== undefined) {
      const isTrue = filters.isFocus === true || filters.isFocus === 'true' || filters.isFocus === 1 || filters.isFocus === '1';
      sql += ' AND is_focus = ?';
      params.push(isTrue ? 1 : 0);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    const tasks = rows.map(mapRowToTask);
    return sortTasksIntelligently(tasks);
  }

  updateTask(id, patchData = {}) {
    const existing = this.getTaskById(id);
    if (!existing) {
      throw new NotFoundError(`Task with id "${id}" not found.`);
    }

    const validatedPatch = validateTaskData(patchData, { isPartial: true });

    const merged = {
      title: validatedPatch.title !== undefined ? validatedPatch.title : existing.title,
      priority: validatedPatch.priority !== undefined ? validatedPatch.priority : existing.priority,
      status: validatedPatch.status !== undefined ? validatedPatch.status : existing.status,
      isFocus: validatedPatch.isFocus !== undefined ? validatedPatch.isFocus : existing.isFocus,
      date: validatedPatch.date !== undefined ? validatedPatch.date : existing.date
    };

    const now = new Date().toISOString();
    const isFocusInt = merged.isFocus ? 1 : 0;

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET title = ?, priority = ?, status = ?, is_focus = ?, date = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.title,
      merged.priority,
      merged.status,
      isFocusInt,
      merged.date,
      now,
      id
    );

    return {
      id,
      ...merged,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  deleteTask(id) {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new NotFoundError(`Task with id "${id}" not found.`);
    }

    return true;
  }

  getTaskStatsByDate(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE date = ?');
    const rows = stmt.all(queryDate);
    const tasks = rows.map(mapRowToTask);
    return calculateTaskStats(tasks);
  }
}
