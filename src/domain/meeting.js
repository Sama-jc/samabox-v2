export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const VALID_ENTRY_TYPES = ['meeting', 'reminder'];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function validateMeetingData(data = {}) {
  const { title, location = '', notes = '' } = data;

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('Meeting title is required and cannot be empty.');
  }

  // V2 fields resolution (supports camelCase and snake_case)
  const rawAllDay = data.allDay !== undefined ? data.allDay : data.all_day;
  const isAllDay = rawAllDay === true || rawAllDay === 1 || rawAllDay === '1';
  const allDay = isAllDay ? 1 : 0;

  let rawEntryType = data.entryType !== undefined ? data.entryType : data.entry_type;
  if (rawEntryType !== undefined) {
    if (!VALID_ENTRY_TYPES.includes(rawEntryType)) {
      throw new ValidationError(`entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}.`);
    }
  } else {
    rawEntryType = allDay === 1 ? 'reminder' : 'meeting';
  }
  const entryType = rawEntryType;

  // Handle start and end times
  let startTime = data.startTime !== undefined ? data.startTime : data.start_time;
  let endTime = data.endTime !== undefined ? data.endTime : data.end_time;

  if (allDay === 1 || entryType === 'reminder') {
    if (!startTime) startTime = '00:00';
    if (!endTime) endTime = '23:59';
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

  const effectiveDate = data.date ? String(data.date).trim() : getTodayDateString();
  if (!DATE_REGEX.test(effectiveDate)) {
    throw new ValidationError('date must be in valid format YYYY-MM-DD.');
  }

  const rawSourceId = data.sourceId !== undefined ? data.sourceId : data.source_id;
  const sourceId = rawSourceId ? String(rawSourceId).trim() : null;

  const rawExternalUid = data.externalUid !== undefined ? data.externalUid : data.external_uid;
  const externalUid = rawExternalUid ? String(rawExternalUid).trim() : null;

  return {
    title: title.trim(),
    startTime,
    endTime,
    date: effectiveDate,
    location: typeof location === 'string' ? location.trim() : '',
    notes: typeof notes === 'string' ? notes.trim() : '',
    sourceId,
    entryType,
    allDay,
    externalUid
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
    const meetingA = sorted[i];
    // Reminders and all-day events are excluded from hourly collision detection
    if (meetingA.allDay === 1 || meetingA.entryType === 'reminder') {
      continue;
    }

    const keyA = meetingA.id ?? String(i);
    for (let j = i + 1; j < sorted.length; j++) {
      const meetingB = sorted[j];
      if (meetingB.allDay === 1 || meetingB.entryType === 'reminder') {
        continue;
      }

      const keyB = meetingB.id ?? String(j);
      // Since sorted, meetingB.startTime >= meetingA.startTime
      // Overlap occurs if meetingB.startTime < meetingA.endTime
      if (meetingB.startTime < meetingA.endTime) {
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
