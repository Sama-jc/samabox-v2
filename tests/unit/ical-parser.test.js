import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  unfoldICalLines,
  unescapeICalText,
  parseICalDateTime,
  parseICalDuration,
  parseICal
} from '../../src/domain/ical-parser.js';
import {
  GOOGLE_CALENDAR_ICS,
  OUTLOOK_CALENDAR_ICS,
  APPLE_CALENDAR_ICS,
  XSS_MALICIOUS_ICS,
  FOLDED_LINES_ICS
} from '../helpers/test-fixtures.js';

describe('RFC 5545 iCal Parser', () => {
  describe('unfoldICalLines', () => {
    it('should unfold lines starting with a single space', () => {
      const raw = 'SUMMARY:Quarterly\r\n Review Meeting\r\nSTATUS:CONFIRMED';
      const unfolded = unfoldICalLines(raw);
      assert.equal(unfolded, 'SUMMARY:QuarterlyReview Meeting\nSTATUS:CONFIRMED');
    });

    it('should unfold lines starting with a tab', () => {
      const raw = 'DESCRIPTION:Line 1\n\tcontinued here';
      const unfolded = unfoldICalLines(raw);
      assert.equal(unfolded, 'DESCRIPTION:Line 1continued here');
    });

    it('should handle multiple consecutive folds', () => {
      const raw = 'SUMMARY:Very \n long \n\tmulti-line \n summary';
      const unfolded = unfoldICalLines(raw);
      assert.equal(unfolded, 'SUMMARY:Very long multi-line summary');
    });

    it('should normalize CRLF and CR to LF without removing non-continuation newlines', () => {
      const raw = 'LINE1\r\nLINE2\rLINE3\nLINE4';
      const unfolded = unfoldICalLines(raw);
      assert.equal(unfolded, 'LINE1\nLINE2\nLINE3\nLINE4');
    });

    it('should handle empty or non-string inputs safely', () => {
      assert.equal(unfoldICalLines(''), '');
      assert.equal(unfoldICalLines(null), '');
      assert.equal(unfoldICalLines(undefined), '');
      assert.equal(unfoldICalLines(123), '');
    });
  });

  describe('unescapeICalText', () => {
    it('should unescape comma, semicolon, backslash, and newlines', () => {
      const input = 'Meeting\\, with Team\\; note\\\\path\\nSecond Line\\NThird Line';
      const expected = 'Meeting, with Team; note\\path\nSecond Line\nThird Line';
      assert.equal(unescapeICalText(input), expected);
    });

    it('should return empty string for null, undefined, or non-string input', () => {
      assert.equal(unescapeICalText(null), '');
      assert.equal(unescapeICalText(undefined), '');
      assert.equal(unescapeICalText(''), '');
    });
  });

  describe('parseICalDateTime', () => {
    it('should parse UTC format YYYYMMDDTHHMMSSZ', () => {
      const result = parseICalDateTime('20261102T093000Z');
      assert.deepEqual(result, {
        date: '2026-11-02',
        time: '09:30',
        allDay: false
      });
    });

    it('should parse floating / local time YYYYMMDDTHHMMSS', () => {
      const result = parseICalDateTime('20261102T140000');
      assert.deepEqual(result, {
        date: '2026-11-02',
        time: '14:00',
        allDay: false
      });
    });

    it('should parse all-day format VALUE=DATE or 8-digit date YYYYMMDD', () => {
      const result1 = parseICalDateTime('20261103', { 'VALUE': 'DATE' });
      assert.deepEqual(result1, {
        date: '2026-11-03',
        time: '00:00',
        allDay: true
      });

      const result2 = parseICalDateTime('20261103');
      assert.deepEqual(result2, {
        date: '2026-11-03',
        time: '00:00',
        allDay: true
      });
    });

    it('should support TZID parameters', () => {
      const result = parseICalDateTime('20261102T154500', { 'TZID': 'America/New_York' });
      assert.deepEqual(result, {
        date: '2026-11-02',
        time: '15:45',
        allDay: false
      });
    });

    it('should return null on invalid input', () => {
      assert.equal(parseICalDateTime('invalid-date'), null);
      assert.equal(parseICalDateTime(''), null);
      assert.equal(parseICalDateTime(null), null);
    });
  });

  describe('parseICalDuration', () => {
    it('should parse PT1H30M to 90 minutes', () => {
      assert.equal(parseICalDuration('PT1H30M'), 90);
    });

    it('should parse PT45M to 45 minutes', () => {
      assert.equal(parseICalDuration('PT45M'), 45);
    });

    it('should parse PT2H to 120 minutes', () => {
      assert.equal(parseICalDuration('PT2H'), 120);
    });

    it('should parse P1D to 1440 minutes', () => {
      assert.equal(parseICalDuration('P1D'), 1440);
    });

    it('should return null on invalid duration format', () => {
      assert.equal(parseICalDuration('INVALID'), null);
      assert.equal(parseICalDuration(''), null);
      assert.equal(parseICalDuration(null), null);
    });
  });

  describe('parseICal (Full parsing of calendar streams)', () => {
    it('should return empty array for empty string or non-string input', () => {
      assert.deepEqual(parseICal(''), []);
      assert.deepEqual(parseICal(null), []);
      assert.deepEqual(parseICal(undefined), []);
      assert.deepEqual(parseICal('BEGIN:VCALENDAR\nEND:VCALENDAR'), []);
    });

    it('should parse Google Calendar ICS fixture with timed and all-day events', () => {
      const events = parseICal(GOOGLE_CALENDAR_ICS);
      assert.equal(events.length, 2);

      // Event 1: Timed event
      const ev1 = events[0];
      assert.equal(ev1.title, 'Sprint Planning');
      assert.equal(ev1.date, '2026-11-02');
      assert.equal(ev1.startTime, '09:30');
      assert.equal(ev1.endTime, '10:30');
      assert.equal(ev1.externalUid, 'google-event-12345@google.com');
      assert.equal(ev1.location, 'https://meet.google.com/abc-defg-hij');
      assert.ok(ev1.notes.includes('Sprint Planning meeting with engineering team.'));
      assert.equal(ev1.allDay, 0);
      assert.equal(ev1.entryType, 'meeting');

      // Event 2: All-day event
      const ev2 = events[1];
      assert.equal(ev2.title, 'Company Hackathon');
      assert.equal(ev2.date, '2026-11-03');
      assert.equal(ev2.startTime, '00:00');
      assert.equal(ev2.endTime, '23:59');
      assert.equal(ev2.allDay, 1);
      assert.equal(ev2.entryType, 'reminder');
      assert.equal(ev2.externalUid, 'google-allday-67890@google.com');
    });

    it('should parse Outlook Calendar ICS fixture with VTIMEZONE and folded fields', () => {
      const events = parseICal(OUTLOOK_CALENDAR_ICS);
      assert.equal(events.length, 1);

      const ev = events[0];
      assert.equal(ev.title, 'Quarterly Architecture Review');
      assert.equal(ev.date, '2026-11-02');
      assert.equal(ev.startTime, '14:00');
      assert.equal(ev.endTime, '15:30');
      assert.equal(ev.location, 'Conference Room B / Microsoft Teams');
      assert.equal(ev.externalUid, 'outlook-event-99999@microsoft.com');
      assert.ok(ev.notes.includes('Reviewing microservices and security architecture.'));
      assert.equal(ev.allDay, 0);
      assert.equal(ev.entryType, 'meeting');
    });

    it('should parse Apple Calendar ICS fixture with DURATION and escaped characters', () => {
      const events = parseICal(APPLE_CALENDAR_ICS);
      assert.equal(events.length, 1);

      const ev = events[0];
      assert.equal(ev.title, 'Security Sync & Audit, Team 1');
      assert.equal(ev.date, '2026-11-02');
      assert.equal(ev.startTime, '11:00');
      // DURATION: PT45M -> 11:00 + 45min = 11:45
      assert.equal(ev.endTime, '11:45');
      assert.equal(ev.location, 'Meeting Room 4 (Main Campus)');
      assert.equal(ev.externalUid, 'apple-event-77777@apple.com');
      assert.ok(ev.notes.includes('CVE-2026-1234'));
      assert.ok(ev.notes.includes('remember laptops.'));
      assert.equal(ev.allDay, 0);
      assert.equal(ev.entryType, 'meeting');
    });

    it('should parse folded lines accurately', () => {
      const events = parseICal(FOLDED_LINES_ICS);
      assert.equal(events.length, 1);

      const ev = events[0];
      assert.equal(ev.title, 'Very long summary title that has been folded into multiple lines by the calendar export server');
      assert.ok(ev.notes.includes('Line 1 of description continued on line 2 and continued on line 3 with tabs'));
      assert.equal(ev.location, 'Building A Room 302');
    });

    it('should sanitize XSS vectors from summary, description and location', () => {
      const events = parseICal(XSS_MALICIOUS_ICS);
      assert.equal(events.length, 1);

      const ev = events[0];
      assert.ok(!ev.title.includes('<script>'), 'Title should not contain <script>');
      assert.ok(!ev.title.includes('</script>'), 'Title should not contain </script>');
      assert.ok(!ev.notes.includes('<img'), 'Notes should not contain <img');
      assert.ok(!ev.notes.includes('<style>'), 'Notes should not contain <style>');
      assert.ok(!ev.location.includes('<iframe'), 'Location should not contain <iframe');
    });

    it('should assign a default 1-hour duration when neither DTEND nor DURATION is present', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-end-test@test.com
SUMMARY:Short Notice Meeting
DTSTART:20261102T100000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].startTime, '10:00');
      assert.equal(events[0].endTime, '11:00');
      assert.equal(events[0].allDay, 0);
    });

    it('should generate a fallback UID if UID is missing in VEVENT', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No UID Event
DTSTART:20261102T080000Z
DTEND:20261102T090000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.ok(events[0].externalUid);
      assert.ok(events[0].externalUid.length > 5);
    });

    it('should default title to "(Sin título)" if SUMMARY is missing or empty', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:empty-summary@test.com
DTSTART:20261102T080000Z
DTEND:20261102T090000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].title, '(Sin título)');
    });
  });
});
