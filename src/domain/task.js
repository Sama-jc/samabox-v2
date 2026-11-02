import { ValidationError, getTodayDateString } from './meeting.js';

export const VALID_PRIORITIES = ['Alta', 'Media', 'Baja'];
export const VALID_STATUSES = ['Pendiente', 'En Progreso', 'Completada'];

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PRIORITY_WEIGHTS = { Alta: 1, Media: 2, Baja: 3 };

export function validateTaskData(data = {}, { isPartial = false } = {}) {
  const result = {};

  if (!isPartial) {
    // Title is mandatory
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('Task title is required and cannot be empty.');
    }
    result.title = data.title.trim();

    // Priority is mandatory
    if (!VALID_PRIORITIES.includes(data.priority)) {
      throw new ValidationError(`Task priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }
    result.priority = data.priority;

    // Status defaults to 'Pendiente'
    const status = data.status || 'Pendiente';
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Task status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
    result.status = status;

    // isFocus defaults to false
    result.isFocus = Boolean(data.isFocus);

    // Date defaults to today
    const date = data.date ? String(data.date).trim() : getTodayDateString();
    if (!DATE_REGEX.test(date)) {
      throw new ValidationError('Task date must be in valid format YYYY-MM-DD.');
    }
    result.date = date;

    return result;
  }

  // Partial validation for PATCH
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('Task title cannot be empty.');
    }
    result.title = data.title.trim();
  }

  if (data.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(data.priority)) {
      throw new ValidationError(`Task priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }
    result.priority = data.priority;
  }

  if (data.status !== undefined) {
    if (!VALID_STATUSES.includes(data.status)) {
      throw new ValidationError(`Task status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
    result.status = data.status;
  }

  if (data.isFocus !== undefined) {
    result.isFocus = Boolean(data.isFocus);
  }

  if (data.date !== undefined) {
    const trimmed = String(data.date).trim();
    if (!DATE_REGEX.test(trimmed)) {
      throw new ValidationError('Task date must be in valid format YYYY-MM-DD.');
    }
    result.date = trimmed;
  }

  return result;
}

export function sortTasksIntelligently(tasks = []) {
  return [...tasks].sort((a, b) => {
    // 1. Incompleted before completed
    const aCompleted = a.status === 'Completada' ? 1 : 0;
    const bCompleted = b.status === 'Completada' ? 1 : 0;
    if (aCompleted !== bCompleted) {
      return aCompleted - bCompleted;
    }

    // 2. Focus first (true before false)
    const aFocus = a.isFocus ? 0 : 1;
    const bFocus = b.isFocus ? 0 : 1;
    if (aFocus !== bFocus) {
      return aFocus - bFocus;
    }

    // 3. Priority severity (Alta -> Media -> Baja)
    const aWeight = PRIORITY_WEIGHTS[a.priority] || 99;
    const bWeight = PRIORITY_WEIGHTS[b.priority] || 99;
    if (aWeight !== bWeight) {
      return aWeight - bWeight;
    }

    // 4. Fallback to title
    return (a.title || '').localeCompare(b.title || '');
  });
}

export function calculateTaskStats(tasks = []) {
  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let focusCount = 0;

  for (const t of tasks) {
    if (t.status === 'Completada') {
      completed++;
    } else if (t.status === 'En Progreso') {
      inProgress++;
    } else if (t.status === 'Pendiente') {
      pending++;
    }

    if (t.isFocus) {
      focusCount++;
    }
  }

  const completionPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    pending,
    completionPercentage,
    focusCount
  };
}
