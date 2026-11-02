export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function validateMeetingData(data = {}) {
  const { title, startTime, endTime, date, location = '', notes = '' } = data;

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('Meeting title is required and cannot be empty.');
  }

  if (typeof startTime !== 'string' || !TIME_REGEX.test(startTime)) {
    throw new ValidationError('startTime must be in valid 24h format HH:MM (e.g., 09:30).');
  }

  if (typeof endTime !== 'string' || !TIME_REGEX.test(endTime)) {
    throw new ValidationError('endTime must be in valid 24h format HH:MM (e.g., 10:15).');
  }

  if (startTime >= endTime) {
    throw new ValidationError('startTime must be before endTime.');
  }

  const effectiveDate = date ? String(date).trim() : getTodayDateString();
  if (!DATE_REGEX.test(effectiveDate)) {
    throw new ValidationError('date must be in valid format YYYY-MM-DD.');
  }

  return {
    title: title.trim(),
    startTime,
    endTime,
    date: effectiveDate,
    location: typeof location === 'string' ? location.trim() : '',
    notes: typeof notes === 'string' ? notes.trim() : ''
  };
}

export function sortMeetingsChronologically(meetings = []) {
  return [...meetings].sort((a, b) => {
    const timeDiff = a.startTime.localeCompare(b.startTime);
    if (timeDiff !== 0) return timeDiff;
    return a.endTime.localeCompare(b.endTime);
  });
}

export function detectMeetingConflicts(meetings = []) {
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return [];
  }

  const sorted = sortMeetingsChronologically(meetings);
  const conflictMap = new Map();

  for (let i = 0; i < sorted.length; i++) {
    const key = sorted[i].id ?? String(i);
    conflictMap.set(key, new Set());
  }

  for (let i = 0; i < sorted.length; i++) {
    const keyA = sorted[i].id ?? String(i);
    for (let j = i + 1; j < sorted.length; j++) {
      const keyB = sorted[j].id ?? String(j);
      // Since sorted, sorted[j].startTime >= sorted[i].startTime
      // Overlap occurs if sorted[j].startTime < sorted[i].endTime
      if (sorted[j].startTime < sorted[i].endTime) {
        conflictMap.get(keyA).add(keyB);
        conflictMap.get(keyB).add(keyA);
      }
    }
  }

  return sorted.map((meeting, index) => {
    const key = meeting.id ?? String(index);
    const conflictingIds = Array.from(conflictMap.get(key) || []);
    return {
      ...meeting,
      hasConflict: conflictingIds.length > 0,
      conflictingIds
    };
  });
}
