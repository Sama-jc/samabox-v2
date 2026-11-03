import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMeetingData,
  sortMeetingsChronologically,
  detectMeetingConflicts,
  ValidationError
} from '../../src/domain/meeting.js';

describe('Meeting Domain Model', () => {
  describe('validateMeetingData', () => {
    it('should pass with valid meeting attributes', () => {
      const validData = {
        title: 'Daily Standup',
        startTime: '09:30',
        endTime: '10:00',
        date: '2026-11-02',
        location: 'Zoom',
        notes: 'Discussion of blockers'
      };

      const validated = validateMeetingData(validData);
      assert.equal(validated.title, 'Daily Standup');
      assert.equal(validated.startTime, '09:30');
      assert.equal(validated.endTime, '10:00');
      assert.equal(validated.date, '2026-11-02');
      assert.equal(validated.location, 'Zoom');
      assert.equal(validated.notes, 'Discussion of blockers');
    });

    it('should throw ValidationError if title is missing or empty', () => {
      assert.throws(
        () => validateMeetingData({ startTime: '09:00', endTime: '10:00', date: '2026-11-02' }),
        (err) => err instanceof ValidationError && err.message.includes('title')
      );

      assert.throws(
        () => validateMeetingData({ title: '   ', startTime: '09:00', endTime: '10:00', date: '2026-11-02' }),
        (err) => err instanceof ValidationError && err.message.includes('title')
      );
    });

    it('should throw ValidationError for invalid startTime or endTime format (HH:MM)', () => {
      const invalidTimes = ['9:00', '25:00', '12:60', 'ab:cd', '10-00', '10:0'];
      
      for (const t of invalidTimes) {
        assert.throws(
          () => validateMeetingData({ title: 'Meeting', startTime: t, endTime: '10:00', date: '2026-11-02' }),
          (err) => err instanceof ValidationError,
          `Expected invalid startTime ${t} to throw ValidationError`
        );

        assert.throws(
          () => validateMeetingData({ title: 'Meeting', startTime: '09:00', endTime: t, date: '2026-11-02' }),
          (err) => err instanceof ValidationError,
          `Expected invalid endTime ${t} to throw ValidationError`
        );
      }
    });

    it('should throw ValidationError if startTime >= endTime', () => {
      // Equal
      assert.throws(
        () => validateMeetingData({ title: 'Equal Times', startTime: '10:00', endTime: '10:00', date: '2026-11-02' }),
        (err) => err instanceof ValidationError && err.message.includes('startTime must be before endTime')
      );

      // Start after end
      assert.throws(
        () => validateMeetingData({ title: 'Inverted Times', startTime: '11:00', endTime: '10:00', date: '2026-11-02' }),
        (err) => err instanceof ValidationError && err.message.includes('startTime must be before endTime')
      );
    });

    it('should throw ValidationError if date format is not YYYY-MM-DD', () => {
      const invalidDates = ['2026/11/02', '02-11-2026', '2026-13-01', '2026-00-10', 'invalid'];
      for (const d of invalidDates) {
        assert.throws(
          () => validateMeetingData({ title: 'Meeting', startTime: '09:00', endTime: '10:00', date: d }),
          (err) => err instanceof ValidationError && err.message.includes('date'),
          `Expected invalid date ${d} to throw ValidationError`
        );
      }
    });

    it('should trim title and provide default empty strings for optional location and notes', () => {
      const result = validateMeetingData({
        title: '  Sync Meeting  ',
        startTime: '14:00',
        endTime: '15:00',
        date: '2026-11-02'
      });
      assert.equal(result.title, 'Sync Meeting');
      assert.equal(result.location, '');
      assert.equal(result.notes, '');
    });
  });

  describe('sortMeetingsChronologically', () => {
    it('should sort meetings ascending by startTime, then endTime', () => {
      const meetings = [
        { id: '3', title: 'Afternoon', startTime: '14:00', endTime: '15:00' },
        { id: '1', title: 'Early Morning', startTime: '08:30', endTime: '09:00' },
        { id: '2b', title: 'Mid Morning 2', startTime: '10:00', endTime: '11:30' },
        { id: '2a', title: 'Mid Morning 1', startTime: '10:00', endTime: '10:30' }
      ];

      const sorted = sortMeetingsChronologically(meetings);
      assert.deepEqual(
        sorted.map(m => m.id),
        ['1', '2a', '2b', '3']
      );
    });
  });

  describe('detectMeetingConflicts (Overlap Collision Detection)', () => {
    it('should return empty list when given empty input', () => {
      const result = detectMeetingConflicts([]);
      assert.deepEqual(result, []);
    });

    it('should mark single meeting with hasConflict: false and empty conflictingIds', () => {
      const meetings = [
        { id: 'm1', title: 'Solo', startTime: '09:00', endTime: '10:00', date: '2026-11-02' }
      ];
      const result = detectMeetingConflicts(meetings);
      assert.equal(result.length, 1);
      assert.equal(result[0].hasConflict, false);
      assert.deepEqual(result[0].conflictingIds, []);
    });

    it('should NOT flag back-to-back meetings that share start/end boundary', () => {
      const meetings = [
        { id: 'm1', title: 'First', startTime: '09:00', endTime: '10:00', date: '2026-11-02' },
        { id: 'm2', title: 'Second', startTime: '10:00', endTime: '11:00', date: '2026-11-02' }
      ];
      const result = detectMeetingConflicts(meetings);
      assert.equal(result[0].hasConflict, false);
      assert.deepEqual(result[0].conflictingIds, []);
      assert.equal(result[1].hasConflict, false);
      assert.deepEqual(result[1].conflictingIds, []);
    });

    it('should flag overlapping meetings (partial overlap)', () => {
      const meetings = [
        { id: 'm1', title: 'Team Sync', startTime: '10:00', endTime: '11:00', date: '2026-11-02' },
        { id: 'm2', title: 'Client Call', startTime: '10:30', endTime: '11:30', date: '2026-11-02' },
        { id: 'm3', title: 'Lunch', startTime: '12:00', endTime: '13:00', date: '2026-11-02' }
      ];

      const result = detectMeetingConflicts(meetings);
      
      // m1 conflicts with m2
      assert.equal(result[0].id, 'm1');
      assert.equal(result[0].hasConflict, true);
      assert.deepEqual(result[0].conflictingIds, ['m2']);

      // m2 conflicts with m1
      assert.equal(result[1].id, 'm2');
      assert.equal(result[1].hasConflict, true);
      assert.deepEqual(result[1].conflictingIds, ['m1']);

      // m3 has no conflict
      assert.equal(result[2].id, 'm3');
      assert.equal(result[2].hasConflict, false);
      assert.deepEqual(result[2].conflictingIds, []);
    });

    it('should flag full enclosure overlaps and multiple overlapping meetings', () => {
      const meetings = [
        { id: 'm1', title: 'Workshop Long', startTime: '09:00', endTime: '12:00', date: '2026-11-02' },
        { id: 'm2', title: 'Quick Sync', startTime: '09:30', endTime: '10:00', date: '2026-11-02' },
        { id: 'm3', title: 'Design Review', startTime: '11:00', endTime: '11:45', date: '2026-11-02' }
      ];

      const result = detectMeetingConflicts(meetings);

      // m1 overlaps with m2 and m3
      const r1 = result.find(m => m.id === 'm1');
      assert.equal(r1.hasConflict, true);
      assert.deepEqual(r1.conflictingIds.sort(), ['m2', 'm3']);

      // m2 overlaps with m1 only
      const r2 = result.find(m => m.id === 'm2');
      assert.equal(r2.hasConflict, true);
      assert.deepEqual(r2.conflictingIds, ['m1']);

      // m3 overlaps with m1 only
      const r3 = result.find(m => m.id === 'm3');
      assert.equal(r3.hasConflict, true);
      assert.deepEqual(r3.conflictingIds, ['m1']);
    });

    it('should sort meetings chronologically even if provided out of order', () => {
      const meetings = [
        { id: 'm2', title: 'Second', startTime: '14:00', endTime: '15:00', date: '2026-11-02' },
        { id: 'm1', title: 'First', startTime: '09:00', endTime: '10:00', date: '2026-11-02' }
      ];

      const result = detectMeetingConflicts(meetings);
      assert.equal(result[0].id, 'm1');
      assert.equal(result[1].id, 'm2');
    });

    it('should not mark all-day events or reminders as conflicting with regular meetings', () => {
      const events = [
        { id: 'm1', title: 'Morning Standup', startTime: '09:00', endTime: '10:00', date: '2026-11-02', allDay: 0, entryType: 'meeting' },
        { id: 'r1', title: 'All Day Workshop', startTime: '00:00', endTime: '23:59', date: '2026-11-02', allDay: 1, entryType: 'reminder' },
        { id: 'r2', title: 'Reminder Note', startTime: '00:00', endTime: '23:59', date: '2026-11-02', allDay: 0, entryType: 'reminder' }
      ];

      const result = detectMeetingConflicts(events);
      for (const item of result) {
        assert.equal(item.hasConflict, false, `Item ${item.id} should not have conflict`);
        assert.deepEqual(item.conflictingIds, []);
      }
    });
  });

  describe('validateMeetingData V2 Extensions (Issue #1)', () => {
    it('should populate default V2 attributes (entryType: meeting, allDay: 0, sourceId: null, externalUid: null)', () => {
      const result = validateMeetingData({
        title: 'Tech Sync',
        startTime: '10:00',
        endTime: '11:00',
        date: '2026-11-02'
      });

      assert.equal(result.entryType, 'meeting');
      assert.equal(result.allDay, 0);
      assert.equal(result.sourceId, null);
      assert.equal(result.externalUid, null);
    });

    it('should support allDay: 1 or allDay: true and default startTime/endTime to 00:00/23:59 if omitted', () => {
      const result = validateMeetingData({
        title: 'Security Awareness Day',
        date: '2026-11-02',
        allDay: true
      });

      assert.equal(result.allDay, 1);
      assert.equal(result.startTime, '00:00');
      assert.equal(result.endTime, '23:59');
      assert.equal(result.entryType, 'reminder');
    });

    it('should support entryType: "reminder" and default startTime/endTime to 00:00/23:59 if omitted', () => {
      const result = validateMeetingData({
        title: 'Renew TLS Certificate',
        date: '2026-11-02',
        entryType: 'reminder'
      });

      assert.equal(result.entryType, 'reminder');
      assert.equal(result.startTime, '00:00');
      assert.equal(result.endTime, '23:59');
    });

    it('should accept sourceId and externalUid in both camelCase and snake_case', () => {
      const result1 = validateMeetingData({
        title: 'External Sync',
        startTime: '14:00',
        endTime: '15:00',
        date: '2026-11-02',
        sourceId: 'src-123',
        externalUid: 'uid-abc-999'
      });
      assert.equal(result1.sourceId, 'src-123');
      assert.equal(result1.externalUid, 'uid-abc-999');

      const result2 = validateMeetingData({
        title: 'External Sync 2',
        startTime: '14:00',
        endTime: '15:00',
        date: '2026-11-02',
        source_id: 'src-456',
        external_uid: 'uid-xyz-000',
        entry_type: 'reminder',
        all_day: 1
      });
      assert.equal(result2.sourceId, 'src-456');
      assert.equal(result2.externalUid, 'uid-xyz-000');
      assert.equal(result2.entryType, 'reminder');
      assert.equal(result2.allDay, 1);
    });

    it('should throw ValidationError if entryType is invalid', () => {
      assert.throws(
        () => validateMeetingData({
          title: 'Invalid Entry',
          startTime: '10:00',
          endTime: '11:00',
          date: '2026-11-02',
          entryType: 'invalid_type'
        }),
        (err) => err instanceof ValidationError && /entryType/i.test(err.message)
      );
    });
  });
});
