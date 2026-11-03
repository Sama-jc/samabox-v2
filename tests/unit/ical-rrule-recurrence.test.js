import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseICal,
  parseICalDateTime,
  parseRRule,
  expandRRuleOccurrences,
  extractTimezones
} from '../../src/domain/ical-parser.js';

describe('RFC 5545 RRULE Recurrence, Overrides & Timezones (Issue #11)', () => {
  const refDate = '2026-11-02';

  describe('RRULE: FREQ=DAILY', () => {
    it('should expand daily recurring events within the reference window', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-standup@secops.corp
SUMMARY:Daily SecOps Triage
DTSTART:20261102T090000
DTEND:20261102T093000
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 5);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[0].startTime, '09:00');
      assert.equal(events[0].endTime, '09:30');
      assert.equal(events[0].externalUid, 'daily-standup@secops.corp#2026-11-02');

      assert.equal(events[1].date, '2026-11-03');
      assert.equal(events[1].externalUid, 'daily-standup@secops.corp#2026-11-03');

      assert.equal(events[4].date, '2026-11-06');
    });

    it('should respect INTERVAL=2 for daily recurrence', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:alternate-day@secops.corp
SUMMARY:Alternate Day Check
DTSTART:20261102T100000
DTEND:20261102T104500
RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[1].date, '2026-11-04');
      assert.equal(events[2].date, '2026-11-06');
    });

    it('should stop expansion when UNTIL is reached', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-until@secops.corp
SUMMARY:Short Project Sync
DTSTART:20261102T110000
DTEND:20261102T113000
RRULE:FREQ=DAILY;UNTIL=20261104T235959Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[1].date, '2026-11-03');
      assert.equal(events[2].date, '2026-11-04');
    });
  });

  describe('RRULE: FREQ=WEEKLY', () => {
    it('should expand weekly events on specific BYDAY (MO,WE,FR)', () => {
      // 2026-11-02 is Monday
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:triweekly-standup@secops.corp
SUMMARY:SecOps Team Sync
DTSTART:20261102T100000
DTEND:20261102T110000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 6);
      assert.equal(events[0].date, '2026-11-02'); // Monday
      assert.equal(events[1].date, '2026-11-04'); // Wednesday
      assert.equal(events[2].date, '2026-11-06'); // Friday
      assert.equal(events[3].date, '2026-11-09'); // Monday
      assert.equal(events[4].date, '2026-11-11'); // Wednesday
      assert.equal(events[5].date, '2026-11-13'); // Friday
    });

    it('should handle multi-week INTERVAL=2 with BYDAY', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:biweekly-review@secops.corp
SUMMARY:Bi-weekly Architecture Review
DTSTART:20261103T150000
DTEND:20261103T160000
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=3
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-03'); // Tue
      assert.equal(events[1].date, '2026-11-17'); // Tue (+2 weeks)
      assert.equal(events[2].date, '2026-12-01'); // Tue (+2 weeks)
    });
  });

  describe('RRULE: FREQ=MONTHLY', () => {
    it('should expand monthly recurrence by day of month', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:monthly-audit@secops.corp
SUMMARY:Monthly Compliance Audit
DTSTART:20261115T140000
DTEND:20261115T150000
RRULE:FREQ=MONTHLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-15');
      assert.equal(events[1].date, '2026-12-15');
      assert.equal(events[2].date, '2027-01-15');
    });

    it('should expand monthly recurrence with ordinal BYDAY (e.g. 1MO, 2TH, -1FR)', () => {
      // 1MO = 1st Monday of the month
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:first-monday@secops.corp
SUMMARY:Executive All-Hands
DTSTART:20261102T090000
DTEND:20261102T100000
RRULE:FREQ=MONTHLY;BYDAY=1MO;COUNT=3
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-02'); // 1st Mon Nov 2026
      assert.equal(events[1].date, '2026-12-07'); // 1st Mon Dec 2026
      assert.equal(events[2].date, '2027-01-04'); // 1st Mon Jan 2027
    });

    it('should handle negative ordinal BYDAY (e.g. -1FR for last Friday of month)', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:last-friday@secops.corp
SUMMARY:Monthly Security Retrospective
DTSTART:20261127T160000
DTEND:20261127T170000
RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=2
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 2);
      assert.equal(events[0].date, '2026-11-27'); // Last Friday Nov 2026
      assert.equal(events[1].date, '2026-12-25'); // Last Friday Dec 2026
    });
  });

  describe('RRULE: FREQ=YEARLY', () => {
    it('should expand yearly recurrence with BYDAY and BYMONTH', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:annual-fire-drill@secops.corp
SUMMARY:Annual Incident Drill
DTSTART:20261105T100000
DTEND:20261105T120000
RRULE:FREQ=YEARLY;INTERVAL=1;COUNT=2
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 2);
      assert.equal(events[0].date, '2026-11-05');
      assert.equal(events[1].date, '2027-11-05');
    });
  });

  describe('EXDATE Exceptions & Exclusion', () => {
    it('should exclude dates listed in EXDATE property (single or comma-separated)', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:standup-with-exdates@secops.corp
SUMMARY:Daily SecOps Standup
DTSTART:20261102T090000
DTEND:20261102T093000
RRULE:FREQ=DAILY;COUNT=5
EXDATE:20261103T090000,20261105T090000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      // Total 5 occurrences - 2 excluded = 3
      assert.equal(events.length, 3);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[1].date, '2026-11-04');
      assert.equal(events[2].date, '2026-11-06');
    });

    it('should handle multiple EXDATE lines with TZID parameters', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:multi-exdate@secops.corp
SUMMARY:Weekly Operations
DTSTART:20261102T100000
DTEND:20261102T110000
RRULE:FREQ=DAILY;COUNT=4
EXDATE;TZID="Eastern Standard Time":20261103T100000
EXDATE;TZID="Eastern Standard Time":20261104T100000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 2);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[1].date, '2026-11-05');
    });
  });

  describe('RECURRENCE-ID Overrides & Status Cancellations', () => {
    it('should replace master occurrence with RECURRENCE-ID override event', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:series-override-uid@secops.corp
SUMMARY:Regular Review
DTSTART:20261102T100000
DTEND:20261102T110000
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:series-override-uid@secops.corp
RECURRENCE-ID:20261103T100000
SUMMARY:Rescheduled Review (Special Room)
DTSTART:20261103T140000
DTEND:20261103T150000
LOCATION:Room 999
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 3);

      // Occurrence 1: Normal from RRULE
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[0].summary || events[0].title, 'Regular Review');
      assert.equal(events[0].startTime, '10:00');

      // Occurrence 2: Replaced by RECURRENCE-ID
      assert.equal(events[1].date, '2026-11-03');
      assert.equal(events[1].title, 'Rescheduled Review (Special Room)');
      assert.equal(events[1].startTime, '14:00');
      assert.equal(events[1].location, 'Room 999');

      // Occurrence 3: Normal from RRULE
      assert.equal(events[2].date, '2026-11-04');
      assert.equal(events[2].title, 'Regular Review');
    });

    it('should drop occurrence when RECURRENCE-ID has STATUS:CANCELLED', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:series-cancel-uid@secops.corp
SUMMARY:Daily Meeting
DTSTART:20261102T100000
DTEND:20261102T110000
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:series-cancel-uid@secops.corp
RECURRENCE-ID:20261103T100000
STATUS:CANCELLED
SUMMARY:Daily Meeting (Cancelled)
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 2);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[1].date, '2026-11-04');
    });

    it('should assign distinct externalUid to each occurrence and override', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:unique-key-series@secops.corp
SUMMARY:Sprint Meeting
DTSTART:20261102T100000
DTEND:20261102T110000
RRULE:FREQ=DAILY;COUNT=2
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 2);
      assert.notEqual(events[0].externalUid, events[1].externalUid);
      assert.ok(events[0].externalUid.includes('unique-key-series@secops.corp'));
      assert.ok(events[1].externalUid.includes('unique-key-series@secops.corp'));
    });
  });

  describe('Microsoft Exchange / O365 Declined & Free Blocks Filtering', () => {
    it('should ignore VEVENTs with STATUS:CANCELLED', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cancelled-meeting@secops.corp
SUMMARY:Cancelled Standup
STATUS:CANCELLED
DTSTART:20261102T090000
DTEND:20261102T100000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 0);
    });

    it('should ignore Exchange transparent declined events (X-MICROSOFT-CDO-BUSYSTATUS:FREE with TRANSP:TRANSPARENT)', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:declined-free@exchange.corp
SUMMARY:Declined: Vendor Pitch
X-MICROSOFT-CDO-BUSYSTATUS:FREE
TRANSP:TRANSPARENT
DTSTART:20261102T150000
DTEND:20261102T160000
END:VEVENT
BEGIN:VEVENT
UID:active-meeting@exchange.corp
SUMMARY:Active Incident Triage
X-MICROSOFT-CDO-BUSYSTATUS:BUSY
TRANSP:OPAQUE
DTSTART:20261102T160000
DTEND:20261102T170000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].title, 'Active Incident Triage');
    });
  });

  describe('VTIMEZONE Multi-Zone Offset Conversion', () => {
    it('should preserve original local times when calendar has NO VTIMEZONE or X-WR-TIMEZONE', () => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:pure-local@corp.com
SUMMARY:Local Lunch
DTSTART:20261102T123000
DTEND:20261102T133000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].startTime, '12:30');
      assert.equal(events[0].endTime, '13:30');
      assert.equal(events[0].date, '2026-11-02');
    });

    it('should convert UTC events (Z) to the calendar primary VTIMEZONE offset', () => {
      // Primary timezone: Mountain Standard Time (Mexico) -> UTC -7 hours (-420 min)
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Mountain Standard Time (Mexico)
BEGIN:STANDARD
DTSTART:16010101T000000
TZOFFSETFROM:-0700
TZOFFSETTO:-0700
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:utc-meeting@global.corp
SUMMARY:Global Security Council
DTSTART:20261102T160000Z
DTEND:20261102T170000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      // 16:00 UTC - 7h = 09:00 local Mountain Standard Time (Mexico)
      assert.equal(events[0].startTime, '09:00');
      assert.equal(events[0].endTime, '10:00');
      assert.equal(events[0].date, '2026-11-02');
    });

    it('should convert secondary TZID (India Standard Time +0530) to primary calendar timezone (MST -0700)', () => {
      // Primary: Mountain Standard Time (Mexico) = UTC -7 (-420m)
      // Event: India Standard Time = UTC +5:30 (+330m)
      // Difference = -420 - 330 = -750m (-12h 30m)
      // 21:30 IST on 2026-11-02 - 12h 30m = 09:00 MST on 2026-11-02
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Mountain Standard Time (Mexico)
BEGIN:STANDARD
TZOFFSETTO:-0700
END:STANDARD
END:VTIMEZONE
BEGIN:VTIMEZONE
TZID:India Standard Time
BEGIN:STANDARD
TZOFFSETTO:+0530
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:india-bridge@vendor.com
SUMMARY:Offshore SOC Handover
DTSTART;TZID="India Standard Time":20261102T213000
DTEND;TZID="India Standard Time":20261102T223000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].startTime, '09:00');
      assert.equal(events[0].endTime, '10:00');
      assert.equal(events[0].date, '2026-11-02');
    });

    it('should adjust date when timezone conversion crosses midnight', () => {
      // Primary: Mountain Standard Time (Mexico) = -7h
      // Event in India (+5:30): 04:00 AM on 2026-11-03
      // 04:00 - 12h 30m = 15:30 PM on previous day (2026-11-02)!
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Mountain Standard Time (Mexico)
BEGIN:STANDARD
TZOFFSETTO:-0700
END:STANDARD
END:VTIMEZONE
BEGIN:VTIMEZONE
TZID:India Standard Time
BEGIN:STANDARD
TZOFFSETTO:+0530
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:india-early@vendor.com
SUMMARY:Early Morning India Triage
DTSTART;TZID="India Standard Time":20261103T040000
DTEND;TZID="India Standard Time":20261103T050000
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics);
      assert.equal(events.length, 1);
      assert.equal(events[0].date, '2026-11-02');
      assert.equal(events[0].startTime, '15:30');
      assert.equal(events[0].endTime, '16:30');
    });
  });

  describe('Non-recurring events retrocompatibility', () => {
    it('should never clip one-off non-recurring events by the RRULE expansion window', () => {
      // Event far in the future or past
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:future-audit-single@secops.corp
SUMMARY:Future SOC2 Audit
DTSTART:20291102T100000Z
DTEND:20291102T110000Z
END:VEVENT
END:VCALENDAR`;

      const events = parseICal(ics, { referenceDate: refDate });
      assert.equal(events.length, 1);
      assert.equal(events[0].date, '2029-11-02');
      assert.equal(events[0].externalUid, 'future-audit-single@secops.corp');
    });
  });
});
