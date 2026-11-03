import crypto from 'node:crypto';

/**
 * RFC 5545 iCal Parser with Recurrence & Timezone Engine
 * Pure native Node.js implementation without external dependencies.
 */

const DOW_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DOW_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

const KNOWN_TZ_OFFSETS = {
  'UTC': 0,
  'GMT': 0,
  'Z': 0,
  'MOUNTAIN STANDARD TIME (MEXICO)': -420,
  'CENTRAL AMERICA STANDARD TIME': -360,
  'CENTRAL STANDARD TIME (MEXICO)': -360,
  'INDIA STANDARD TIME': 330,
  'EASTERN STANDARD TIME': -300,
  'CENTRAL STANDARD TIME': -360,
  'MOUNTAIN STANDARD TIME': -420,
  'PACIFIC STANDARD TIME': -480,
  'ALASKA STANDARD TIME': -540,
  'HAWAIIAN STANDARD TIME': -600,
  'AMERICA/NEW_YORK': -300,
  'AMERICA/CHICAGO': -360,
  'AMERICA/DENVER': -420,
  'AMERICA/LOS_ANGELES': -480,
  'AMERICA/MEXICO_CITY': -360,
  'AMERICA/TIJUANA': -480,
  'EUROPE/LONDON': 0,
  'EUROPE/PARIS': 60,
  'EUROPE/MADRID': 60,
  'EUROPE/BERLIN': 60,
  'ASIA/KOLKATA': 330,
  'ASIA/CALCUTTA': 330,
  'ASIA/TOKYO': 540,
  'W. EUROPE STANDARD TIME': 60,
  'ROMANCE STANDARD TIME': 60,
  'GREENWICH STANDARD TIME': 0,
};

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getDayOfWeek(dateStr) {
  const { year, month, day } = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(dateStr, n) {
  const { year, month, day } = parseDateStr(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function getNthWeekdayOfMonth(year, month, weekdayStr, ordinal = 0) {
  const targetDow = DOW_MAP[weekdayStr.toUpperCase()];
  if (targetDow === undefined) return null;

  const totalDays = daysInMonth(year, month);
  const matchingDays = [];

  for (let day = 1; day <= totalDays; day++) {
    const dow = getDayOfWeek(formatDate(year, month, day));
    if (dow === targetDow) {
      matchingDays.push(day);
    }
  }

  if (matchingDays.length === 0) return null;

  if (ordinal > 0) {
    return matchingDays[ordinal - 1] ?? null;
  } else if (ordinal < 0) {
    const idx = matchingDays.length + ordinal;
    return matchingDays[idx] ?? null;
  } else {
    return matchingDays[0];
  }
}

function extractUntilDate(untilVal) {
  if (!untilVal) return null;
  const match = untilVal.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseOffsetToMinutes(offsetStr) {
  if (!offsetStr || typeof offsetStr !== 'string') return 0;
  const str = offsetStr.trim();
  const match = str.match(/^([+-])?(\d{2})(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * ((hours * 60) + minutes);
}

function shiftDateTime(dateStr, timeStr, shiftMinutes) {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  d.setUTCMinutes(d.getUTCMinutes() + shiftMinutes);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dStr = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${y}-${m}-${dStr}`,
    time: `${h}:${min}`
  };
}

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

  let text = unescaped.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');

  const lines = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim());
  return lines.filter((l, i, arr) => l.length > 0 || (i > 0 && i < arr.length - 1)).join('\n').trim();
}

/**
 * Parses RFC 5545 Date or DateTime property value.
 * Preserves strict object shape for backward compatibility: { date, time, allDay }.
 */
export function parseICalDateTime(propValue = '', params = {}) {
  if (typeof propValue !== 'string' || !propValue.trim()) return null;
  const value = propValue.trim();

  const isValueDate = (params && (params.VALUE === 'DATE' || params.value === 'DATE')) || /^\d{8}$/.test(value);

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
 * Parses RFC 5545 RRULE string into structured object.
 */
export function parseRRule(rruleStr = '') {
  if (typeof rruleStr !== 'string' || !rruleStr.trim()) return null;
  const clean = rruleStr.replace(/^RRULE:/i, '').trim();
  if (!clean) return null;

  const parts = clean.split(';');
  const rule = {
    freq: null,
    interval: 1,
    count: null,
    until: null,
    byDay: null,
    byMonthDay: null,
    byMonth: null,
    wkst: 'MO'
  };

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).toUpperCase().trim();
    const val = part.slice(eqIdx + 1).trim();

    switch (key) {
      case 'FREQ':
        rule.freq = val.toUpperCase();
        break;
      case 'INTERVAL':
        rule.interval = Math.max(1, parseInt(val, 10) || 1);
        break;
      case 'COUNT':
        rule.count = parseInt(val, 10) || null;
        break;
      case 'UNTIL':
        rule.until = val;
        break;
      case 'BYDAY':
        rule.byDay = val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        break;
      case 'BYMONTH':
        rule.byMonth = val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        break;
      case 'WKST':
        rule.wkst = val.toUpperCase();
        break;
    }
  }

  if (!rule.freq) return null;
  return rule;
}

/**
 * Extracts VTIMEZONE blocks and primary calendar timezone offset.
 */
export function extractTimezones(raw = '') {
  const tzMap = new Map();
  let primaryTzId = null;

  if (typeof raw !== 'string' || !raw) {
    return { primaryTzId: null, primaryOffset: 0, tzMap };
  }

  const xWrMatch = raw.match(/X-WR-TIMEZONE\s*[:;]([^\r\n]+)/i);
  if (xWrMatch) {
    primaryTzId = xWrMatch[1].trim().replace(/^"|"$/g, '');
  }

  const vtzRegex = /BEGIN:VTIMEZONE\s*([\s\S]*?)END:VTIMEZONE/gi;
  let match;
  while ((match = vtzRegex.exec(raw)) !== null) {
    const block = match[1];
    const lines = block.split('\n');

    let tzid = null;
    let offsetMinutes = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^TZID\s*[:;]/i.test(line)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          tzid = line.slice(colonIdx + 1).trim().replace(/^"|"$/g, '');
        }
      } else if (/^TZOFFSETTO\s*[:;]/i.test(line)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const val = line.slice(colonIdx + 1).trim();
          offsetMinutes = parseOffsetToMinutes(val);
        }
      }
    }

    if (tzid) {
      if (!primaryTzId) {
        primaryTzId = tzid;
      }
      if (offsetMinutes !== null) {
        tzMap.set(tzid.toUpperCase(), offsetMinutes);
      }
    }
  }

  let primaryOffset = 0;
  if (primaryTzId) {
    const upper = primaryTzId.toUpperCase();
    if (tzMap.has(upper)) {
      primaryOffset = tzMap.get(upper);
    } else if (KNOWN_TZ_OFFSETS[upper] !== undefined) {
      primaryOffset = KNOWN_TZ_OFFSETS[upper];
      tzMap.set(upper, primaryOffset);
    }
  }

  return { primaryTzId, primaryOffset, tzMap };
}

/**
 * Converts event start and end time to the primary calendar timezone offset.
 */
function applyTimezoneConversion({ date, startTime, endTime, dtstart, dtend, duration, allDay }, tzInfo) {
  if (allDay) {
    return {
      date,
      startTime: '00:00',
      endTime: '23:59'
    };
  }

  const { primaryTzId, primaryOffset, tzMap } = tzInfo;
  if (!primaryTzId) {
    return { date, startTime, endTime };
  }

  let isUtc = false;
  let sourceTzid = null;

  if (dtstart) {
    if (typeof dtstart.value === 'string' && /Z$/i.test(dtstart.value.trim())) {
      isUtc = true;
    } else if (dtstart.params && dtstart.params.TZID) {
      sourceTzid = dtstart.params.TZID.replace(/^"|"$/g, '').trim();
    }
  }

  let sourceOffset = primaryOffset;
  if (isUtc) {
    sourceOffset = 0;
  } else if (sourceTzid) {
    const upper = sourceTzid.toUpperCase();
    if (tzMap.has(upper)) {
      sourceOffset = tzMap.get(upper);
    } else if (KNOWN_TZ_OFFSETS[upper] !== undefined) {
      sourceOffset = KNOWN_TZ_OFFSETS[upper];
    }
  }

  const shiftMinutes = primaryOffset - sourceOffset;
  if (shiftMinutes === 0) {
    return { date, startTime, endTime };
  }

  const shiftedStart = shiftDateTime(date, startTime, shiftMinutes);
  let shiftedEndTime = endTime;

  if (dtend) {
    const endRaw = dtend.value ? dtend.value.trim() : '';
    const endIsUtc = /Z$/i.test(endRaw);
    let endSourceOffset = sourceOffset;
    if (endIsUtc) {
      endSourceOffset = 0;
    } else if (dtend.params && dtend.params.TZID) {
      const endTz = dtend.params.TZID.replace(/^"|"$/g, '').trim().toUpperCase();
      if (tzMap.has(endTz)) {
        endSourceOffset = tzMap.get(endTz);
      } else if (KNOWN_TZ_OFFSETS[endTz] !== undefined) {
        endSourceOffset = KNOWN_TZ_OFFSETS[endTz];
      }
    }
    const endShiftMinutes = primaryOffset - endSourceOffset;
    const shiftedEnd = shiftDateTime(date, endTime, endShiftMinutes);
    if (shiftedEnd.date === shiftedStart.date) {
      shiftedEndTime = shiftedEnd.time;
    } else if (shiftedEnd.date > shiftedStart.date) {
      shiftedEndTime = '23:59';
    } else {
      shiftedEndTime = addMinutesToTime(shiftedStart.time, 60);
    }
  } else if (duration) {
    const durMin = parseICalDuration(duration) || 60;
    shiftedEndTime = addMinutesToTime(shiftedStart.time, durMin);
  } else {
    shiftedEndTime = addMinutesToTime(shiftedStart.time, 60);
  }

  if (!shiftedEndTime || shiftedEndTime <= shiftedStart.time) {
    shiftedEndTime = addMinutesToTime(shiftedStart.time, 60);
    if (shiftedEndTime <= shiftedStart.time) {
      shiftedEndTime = '23:59';
    }
  }

  return {
    date: shiftedStart.date,
    startTime: shiftedStart.time,
    endTime: shiftedEndTime
  };
}

/**
 * Expands occurrences of an RRULE recurring event.
 */
export function expandRRuleOccurrences(event, rrule, optionsOrExdates = {}, maybeWinStart, maybeWinEnd) {
  let exdateSet = new Set();
  let windowStartDate = '1970-01-01';
  let windowEndDate = '2099-12-31';

  if (optionsOrExdates instanceof Set) {
    exdateSet = optionsOrExdates;
    if (maybeWinStart) windowStartDate = maybeWinStart;
    if (maybeWinEnd) windowEndDate = maybeWinEnd;
  } else if (Array.isArray(optionsOrExdates)) {
    exdateSet = new Set(optionsOrExdates);
    if (maybeWinStart) windowStartDate = maybeWinStart;
    if (maybeWinEnd) windowEndDate = maybeWinEnd;
  } else if (optionsOrExdates && typeof optionsOrExdates === 'object') {
    if (optionsOrExdates.exdateSet) exdateSet = optionsOrExdates.exdateSet;
    if (optionsOrExdates.windowStartDate) windowStartDate = optionsOrExdates.windowStartDate;
    if (optionsOrExdates.windowEndDate) windowEndDate = optionsOrExdates.windowEndDate;
  }

  const rule = typeof rrule === 'string' ? parseRRule(rrule) : rrule;
  if (!rule || !rule.freq) {
    return [event];
  }

  const occurrences = [];
  const uid = event.uid || event.externalUid || event.external_uid || crypto.randomUUID();
  const startDate = event.date;
  const untilDate = rule.until ? extractUntilDate(rule.until) : null;

  let totalCount = 0;
  const maxIterations = 2000;

  function shouldStop(dateStr) {
    if (rule.until && dateStr > untilDate) return true;
    if (rule.count !== null && totalCount >= rule.count) return true;
    if (dateStr > windowEndDate) return true;
    return false;
  }

  function addOccurrenceIfValid(occurrenceDate) {
    if (shouldStop(occurrenceDate)) return false;
    totalCount++;

    if (occurrenceDate >= windowStartDate && occurrenceDate <= windowEndDate) {
      if (!exdateSet.has(occurrenceDate)) {
        const occ = {
          ...event,
          date: occurrenceDate,
          externalUid: `${uid}#${occurrenceDate}`,
          external_uid: `${uid}#${occurrenceDate}`
        };
        occurrences.push(occ);
      }
    }
    return true;
  }

  switch (rule.freq) {
    case 'DAILY': {
      let curr = startDate;
      let iter = 0;
      while (iter++ < maxIterations) {
        if (!addOccurrenceIfValid(curr)) break;
        if (rule.count !== null && totalCount >= rule.count) break;
        curr = addDays(curr, rule.interval || 1);
        if (rule.until && curr > untilDate) break;
        if (curr > windowEndDate) break;
      }
      break;
    }

    case 'WEEKLY': {
      const wkst = (rule.wkst || 'MO').toUpperCase();
      const wkstIndex = DOW_MAP[wkst] ?? 1;

      let byDayList = rule.byDay && rule.byDay.length > 0 ? [...rule.byDay] : null;
      if (!byDayList) {
        const startDow = getDayOfWeek(startDate);
        byDayList = [DOW_CODES[startDow]];
      }

      byDayList.sort((a, b) => {
        const dayA = a.slice(-2);
        const dayB = b.slice(-2);
        const offA = (DOW_MAP[dayA] - wkstIndex + 7) % 7;
        const offB = (DOW_MAP[dayB] - wkstIndex + 7) % 7;
        return offA - offB;
      });

      const startDow = getDayOfWeek(startDate);
      const startWeekOffset = (startDow - wkstIndex + 7) % 7;
      let currentWeekStart = addDays(startDate, -startWeekOffset);

      let iter = 0;
      let stopped = false;
      while (iter++ < maxIterations && !stopped) {
        for (const dayItem of byDayList) {
          const dayCode = dayItem.slice(-2);
          const dayOffset = (DOW_MAP[dayCode] - wkstIndex + 7) % 7;
          const occurrenceDate = addDays(currentWeekStart, dayOffset);

          if (occurrenceDate < startDate) {
            continue;
          }

          if (!addOccurrenceIfValid(occurrenceDate)) {
            stopped = true;
            break;
          }

          if (rule.count !== null && totalCount >= rule.count) {
            stopped = true;
            break;
          }
        }

        if (stopped) break;
        currentWeekStart = addDays(currentWeekStart, (rule.interval || 1) * 7);
        if (rule.until && currentWeekStart > untilDate) break;
        if (currentWeekStart > windowEndDate) break;
      }
      break;
    }

    case 'MONTHLY': {
      const startParts = parseDateStr(startDate);
      let curYear = startParts.year;
      let curMonth = startParts.month;
      const targetDay = startParts.day;

      let iter = 0;
      let stopped = false;
      while (iter++ < maxIterations && !stopped) {
        if (rule.byDay && rule.byDay.length > 0) {
          for (const item of rule.byDay) {
            const match = item.match(/^([+-]?\d+)?([A-Z]{2})$/);
            if (!match) continue;
            const ordinal = match[1] ? parseInt(match[1], 10) : 0;
            const dayCode = match[2];
            const d = getNthWeekdayOfMonth(curYear, curMonth, dayCode, ordinal);
            if (!d) continue;

            const occurrenceDate = formatDate(curYear, curMonth, d);
            if (occurrenceDate < startDate) continue;

            if (!addOccurrenceIfValid(occurrenceDate)) {
              stopped = true;
              break;
            }
            if (rule.count !== null && totalCount >= rule.count) {
              stopped = true;
              break;
            }
          }
        } else {
          const maxDays = daysInMonth(curYear, curMonth);
          if (targetDay <= maxDays) {
            const occurrenceDate = formatDate(curYear, curMonth, targetDay);
            if (occurrenceDate >= startDate) {
              if (!addOccurrenceIfValid(occurrenceDate)) {
                stopped = true;
                break;
              }
            }
          }
        }

        if (stopped) break;
        curMonth += (rule.interval || 1);
        while (curMonth > 12) {
          curMonth -= 12;
          curYear++;
        }
        const testDate = formatDate(curYear, curMonth, 1);
        if (rule.until && testDate > untilDate) break;
        if (testDate > windowEndDate) break;
      }
      break;
    }

    case 'YEARLY': {
      const startParts = parseDateStr(startDate);
      let curYear = startParts.year;
      const months = (rule.byMonth && rule.byMonth.length > 0) ? rule.byMonth : [startParts.month];

      let iter = 0;
      let stopped = false;
      while (iter++ < maxIterations && !stopped) {
        for (const m of months) {
          if (rule.byDay && rule.byDay.length > 0) {
            for (const item of rule.byDay) {
              const match = item.match(/^([+-]?\d+)?([A-Z]{2})$/);
              if (!match) continue;
              const ordinal = match[1] ? parseInt(match[1], 10) : 0;
              const dayCode = match[2];
              const d = getNthWeekdayOfMonth(curYear, m, dayCode, ordinal);
              if (!d) continue;

              const occurrenceDate = formatDate(curYear, m, d);
              if (occurrenceDate < startDate) continue;

              if (!addOccurrenceIfValid(occurrenceDate)) {
                stopped = true;
                break;
              }
              if (rule.count !== null && totalCount >= rule.count) {
                stopped = true;
                break;
              }
            }
          } else {
            const occurrenceDate = formatDate(curYear, m, startParts.day);
            if (occurrenceDate >= startDate) {
              if (!addOccurrenceIfValid(occurrenceDate)) {
                stopped = true;
                break;
              }
            }
          }
          if (stopped) break;
        }

        if (stopped) break;
        curYear += (rule.interval || 1);
        const testDate = formatDate(curYear, months[0], 1);
        if (rule.until && testDate > untilDate) break;
        if (testDate > windowEndDate) break;
      }
      break;
    }

    default:
      occurrences.push(event);
      break;
  }

  return occurrences;
}

function computeWindow(refDateStr, pastDays = 90, futureDays = 365) {
  const parts = parseDateStr(refDateStr);
  const ref = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const start = new Date(ref.getTime() - pastDays * 86400000);
  const end = new Date(ref.getTime() + (futureDays + 14) * 86400000);
  return {
    windowStartDate: formatDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
    windowEndDate: formatDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate())
  };
}

/**
 * Parses raw iCal string into an array of structured meeting/event objects.
 */
export function parseICal(icsString = '', options = {}) {
  if (typeof icsString !== 'string' || !icsString.trim()) {
    return [];
  }

  const { referenceDate, pastDays = 90, futureDays = 365 } = options;
  const refDateStr = referenceDate || new Date().toISOString().slice(0, 10);
  const { windowStartDate, windowEndDate } = computeWindow(refDateStr, pastDays, futureDays);

  const unfolded = unfoldICalLines(icsString);
  const tzInfo = extractTimezones(unfolded);

  const veventRegex = /BEGIN:VEVENT\s*([\s\S]*?)END:VEVENT/gi;
  const rawEvents = [];

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
    let rrule = null;
    const exdates = new Set();
    let recurrenceId = null;
    let status = '';
    let transp = '';
    let xMicrosoftBusy = '';

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
        case 'RRULE':
          rrule = value.trim();
          break;
        case 'EXDATE': {
          const parts = value.split(',');
          for (const p of parts) {
            const trimmed = p.trim();
            const dt = parseICalDateTime(trimmed, params);
            if (dt && dt.date) {
              exdates.add(dt.date);
              exdates.add(`${dt.date}T${dt.time}`);
            }
          }
          break;
        }
        case 'RECURRENCE-ID':
          recurrenceId = { value: value.trim(), params };
          break;
        case 'STATUS':
          status = value.trim().toUpperCase();
          break;
        case 'TRANSP':
          transp = value.trim().toUpperCase();
          break;
        case 'X-MICROSOFT-CDO-BUSYSTATUS':
          xMicrosoftBusy = value.trim().toUpperCase();
          break;
      }
    }

    if (!dtstart && !recurrenceId) continue;
    if (!dtstart && recurrenceId) {
      dtstart = recurrenceId;
    }

    if (status === 'CANCELLED' && !recurrenceId) {
      continue;
    }
    if (xMicrosoftBusy === 'FREE' && transp === 'TRANSPARENT') {
      continue;
    }
    if (transp === 'TRANSPARENT' && /^free$/i.test(summary.trim())) {
      continue;
    }

    rawEvents.push({
      uid,
      summary,
      description,
      location,
      dtstart,
      dtend,
      duration,
      rrule,
      exdates,
      recurrenceId,
      status,
      transp,
      xMicrosoftBusy
    });
  }

  const masters = [];
  const overridesMap = new Map();

  for (const raw of rawEvents) {
    if (raw.recurrenceId) {
      const recParsed = parseICalDateTime(raw.recurrenceId.value, raw.recurrenceId.params);
      if (recParsed) {
        const cleanUid = raw.uid ? cleanICalText(raw.uid) : 'unknown';
        overridesMap.set(`${cleanUid}::${recParsed.date}`, raw);
        if (recParsed.time) {
          overridesMap.set(`${cleanUid}::${recParsed.date}T${recParsed.time}`, raw);
        }
      }
    } else {
      masters.push(raw);
    }
  }

  function buildFinalEvent(rawEvent, occurrenceDate = null, forcedExternalUid = null) {
    const startParsed = parseICalDateTime(rawEvent.dtstart.value, rawEvent.dtstart.params);
    if (!startParsed) return null;

    const rawDate = occurrenceDate || startParsed.date;
    const allDay = startParsed.allDay ? 1 : 0;
    let entryType = allDay === 1 ? 'reminder' : 'meeting';

    let startTime = startParsed.time;
    let endTime = null;

    if (allDay === 1) {
      startTime = '00:00';
      endTime = '23:59';
      entryType = 'reminder';
    } else {
      if (rawEvent.dtend) {
        const endParsed = parseICalDateTime(rawEvent.dtend.value, rawEvent.dtend.params);
        if (endParsed) {
          endTime = endParsed.time;
        }
      } else if (rawEvent.duration) {
        const durMinutes = parseICalDuration(rawEvent.duration);
        if (durMinutes) {
          endTime = addMinutesToTime(startTime, durMinutes);
        }
      }

      if (!endTime || endTime <= startTime) {
        endTime = addMinutesToTime(startTime, 60);
        if (endTime <= startTime) {
          endTime = '23:59';
        }
      }
    }

    const converted = applyTimezoneConversion({
      date: rawDate,
      startTime,
      endTime,
      dtstart: rawEvent.dtstart,
      dtend: rawEvent.dtend,
      duration: rawEvent.duration,
      allDay: allDay === 1
    }, tzInfo);

    const cleanUid = rawEvent.uid ? cleanICalText(rawEvent.uid) : crypto.randomUUID();
    const externalUid = forcedExternalUid || cleanUid;
    const title = cleanICalText(rawEvent.summary) || '(Sin título)';
    const cleanLocation = cleanICalText(rawEvent.location);
    const cleanNotes = cleanICalText(rawEvent.description);

    return {
      title,
      startTime: converted.startTime,
      endTime: converted.endTime,
      date: converted.date,
      location: cleanLocation,
      notes: cleanNotes,
      externalUid,
      allDay,
      entryType,
      start_time: converted.startTime,
      end_time: converted.endTime,
      external_uid: externalUid,
      all_day: allDay,
      entry_type: entryType
    };
  }

  const events = [];

  for (const master of masters) {
    const cleanUid = master.uid ? cleanICalText(master.uid) : crypto.randomUUID();

    if (master.rrule) {
      const startParsed = parseICalDateTime(master.dtstart.value, master.dtstart.params);
      if (!startParsed) continue;

      const templateEvent = {
        uid: cleanUid,
        date: startParsed.date,
        startTime: startParsed.time
      };

      const occurrences = expandRRuleOccurrences(templateEvent, master.rrule, {
        exdateSet: master.exdates,
        windowStartDate,
        windowEndDate
      });

      for (const occ of occurrences) {
        const occDate = occ.date;
        const key = `${cleanUid}::${occDate}`;
        const keyWithTime = `${cleanUid}::${occDate}T${occ.startTime || startParsed.time}`;

        let override = null;
        if (overridesMap.has(keyWithTime)) {
          override = overridesMap.get(keyWithTime);
          overridesMap.delete(keyWithTime);
          overridesMap.delete(key);
        } else if (overridesMap.has(key)) {
          override = overridesMap.get(key);
          overridesMap.delete(key);
        }

        if (override) {
          if (override.status === 'CANCELLED') {
            continue;
          }
          const overrideEvent = buildFinalEvent(override, null, `${cleanUid}#${occDate}`);
          if (overrideEvent) {
            events.push(overrideEvent);
          }
        } else {
          const occEvent = buildFinalEvent(master, occDate, `${cleanUid}#${occDate}`);
          if (occEvent) {
            events.push(occEvent);
          }
        }
      }
    } else {
      const singleEvent = buildFinalEvent(master, null, cleanUid);
      if (singleEvent) {
        events.push(singleEvent);
      }
    }
  }

  for (const [key, override] of overridesMap.entries()) {
    if (key.includes('T')) continue;
    if (override.status === 'CANCELLED') continue;

    const cleanUid = override.uid ? cleanICalText(override.uid) : crypto.randomUUID();
    const recParsed = parseICalDateTime(override.recurrenceId?.value, override.recurrenceId?.params);
    const occKey = recParsed?.date || 'override';
    const orphanEvent = buildFinalEvent(override, null, `${cleanUid}#${occKey}`);
    if (orphanEvent) {
      events.push(orphanEvent);
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return events;
}

export const parseICalEvents = parseICal;

