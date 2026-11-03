import crypto from 'node:crypto';

/**
 * RFC 5545 iCal Parser
 * Pure native Node.js implementation without external dependencies.
 */

/**
 * Unfolds lines according to RFC 5545 section 3.1.
 * A line break (CRLF, CR, or LF) followed by a space or tab is removed.
 */
export function unfoldICalLines(raw = '') {
  if (typeof raw !== 'string' || !raw) return '';
  return raw
    .replace(/\r\n[ \t]|\r[ \t]|\n[ \t]/g, '')
    .replace(/\r\n|\r/g, '\n');
}

/**
 * Unescapes RFC 5545 text sequences (\,, \;, \n, \N, \\).
 */
export function unescapeICalText(str = '') {
  if (typeof str !== 'string' || !str) return '';
  return str
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Sanitizes untrusted text extracted from iCal feeds against XSS.
 * Strips executable tags (<script>, <style>, <iframe>, <img>, etc.)
 * while preserving clean formatting.
 */
export function cleanICalText(raw = '') {
  if (typeof raw !== 'string' || !raw) return '';
  const unescaped = unescapeICalText(raw);

  // 1. Strip script, style, and iframe blocks along with their content
  let text = unescaped.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

  // 2. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 3. Normalize spaces while preserving meaningful line breaks
  const lines = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim());
  return lines.filter((l, i, arr) => l.length > 0 || (i > 0 && i < arr.length - 1)).join('\n').trim();
}

/**
 * Parses RFC 5545 Date or DateTime property value.
 * Handles:
 * - VALUE=DATE: YYYYMMDD -> { date: 'YYYY-MM-DD', time: '00:00', allDay: true }
 * - UTC: YYYYMMDDTHHMMSSZ -> { date: 'YYYY-MM-DD', time: 'HH:MM', allDay: false, isUtc: true }
 * - TZID or Floating: YYYYMMDDTHHMMSS -> { date: 'YYYY-MM-DD', time: 'HH:MM', allDay: false }
 */
export function parseICalDateTime(propValue = '', params = {}) {
  if (typeof propValue !== 'string' || !propValue.trim()) return null;
  const value = propValue.trim();

  const isValueDate = (params && (params.VALUE === 'DATE' || params.value === 'DATE')) || /^\d{8}$/.test(value);

  // 1. Date-only format (VALUE=DATE or 8 digits)
  if (isValueDate) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    return {
      date: `${year}-${month}-${day}`,
      time: '00:00',
      allDay: true
    };
  }

  // 2. DateTime format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    allDay: false
  };
}

/**
 * Parses RFC 5545 DURATION string into duration in minutes.
 * Examples: PT1H30M -> 90, PT45M -> 45, P1D -> 1440
 */
export function parseICalDuration(durationStr = '') {
  if (typeof durationStr !== 'string' || !durationStr.trim()) return null;
  const str = durationStr.trim();

  const match = str.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match || match[0] === 'P') return null;

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);

  const totalMinutes = (days * 1440) + (hours * 60) + minutes + Math.round(seconds / 60);
  return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Helper to add minutes to a 24-hour time string (HH:MM).
 * Clamps to 23:59 if it wraps or exceeds day boundary.
 */
function addMinutesToTime(timeStr, minutesToAdd) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = (h * 60) + m + minutesToAdd;
  if (total >= 1440 - 1) {
    return '23:59';
  }
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Parses an individual property line into name, parameters, and value.
 * Handles parameter quotes, e.g.: DTSTART;TZID="Eastern Standard Time":20261102T140000
 */
function parsePropertyLine(line) {
  let colonIndex = -1;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ':' && !inQuotes) {
      colonIndex = i;
      break;
    }
  }

  if (colonIndex === -1) return null;

  const left = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1);

  const parts = left.split(';');
  const name = parts[0].toUpperCase().trim();
  const params = {};

  for (let p = 1; p < parts.length; p++) {
    const paramPart = parts[p].trim();
    const eqIdx = paramPart.indexOf('=');
    if (eqIdx !== -1) {
      const pName = paramPart.slice(0, eqIdx).toUpperCase().trim();
      let pVal = paramPart.slice(eqIdx + 1).trim();
      if (pVal.startsWith('"') && pVal.endsWith('"')) {
        pVal = pVal.slice(1, -1);
      }
      params[pName] = pVal;
    }
  }

  return { name, params, value };
}

/**
 * Parses raw iCal string into an array of structured meeting/event objects.
 */
export function parseICal(icsString = '') {
  if (typeof icsString !== 'string' || !icsString.trim()) {
    return [];
  }

  const unfolded = unfoldICalLines(icsString);
  const veventRegex = /BEGIN:VEVENT\s*([\s\S]*?)END:VEVENT/gi;
  const events = [];

  let match;
  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];
    const lines = block.split('\n');

    let uid = '';
    let summary = '';
    let description = '';
    let location = '';
    let dtstart = null;
    let dtend = null;
    let duration = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const parsed = parsePropertyLine(line);
      if (!parsed) continue;

      const { name, params, value } = parsed;

      switch (name) {
        case 'UID':
          uid = value.trim();
          break;
        case 'SUMMARY':
          summary = value;
          break;
        case 'DESCRIPTION':
          description = value;
          break;
        case 'LOCATION':
          location = value;
          break;
        case 'DTSTART':
          dtstart = { value: value.trim(), params };
          break;
        case 'DTEND':
          dtend = { value: value.trim(), params };
          break;
        case 'DURATION':
          duration = value.trim();
          break;
      }
    }

    if (!dtstart) {
      // Event without DTSTART is invalid per RFC 5545
      continue;
    }

    const startParsed = parseICalDateTime(dtstart.value, dtstart.params);
    if (!startParsed) continue;

    const externalUid = uid ? cleanICalText(uid) : crypto.randomUUID();
    const title = cleanICalText(summary) || '(Sin título)';
    const cleanLocation = cleanICalText(location);
    const cleanNotes = cleanICalText(description);

    let startTime = startParsed.time;
    let endTime = null;
    let allDay = startParsed.allDay ? 1 : 0;
    let entryType = allDay === 1 ? 'reminder' : 'meeting';

    if (allDay === 1) {
      startTime = '00:00';
      endTime = '23:59';
      entryType = 'reminder';
    } else {
      if (dtend) {
        const endParsed = parseICalDateTime(dtend.value, dtend.params);
        if (endParsed) {
          endTime = endParsed.time;
        }
      } else if (duration) {
        const durMinutes = parseICalDuration(duration);
        if (durMinutes) {
          endTime = addMinutesToTime(startTime, durMinutes);
        }
      }

      // Default duration is 60 minutes if DTEND or DURATION is absent or invalid
      if (!endTime || endTime <= startTime) {
        endTime = addMinutesToTime(startTime, 60);
        if (endTime <= startTime) {
          endTime = '23:59';
        }
      }
    }

    const event = {
      title,
      startTime,
      endTime,
      date: startParsed.date,
      location: cleanLocation,
      notes: cleanNotes,
      externalUid,
      allDay,
      entryType,
      // snake_case aliases for direct DB compatibility
      start_time: startTime,
      end_time: endTime,
      external_uid: externalUid,
      all_day: allDay,
      entry_type: entryType
    };

    events.push(event);
  }

  return events;
}

export const parseICalEvents = parseICal;
