import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCalendarSourceData,
  VALID_SOURCE_TYPES,
  VALID_SYNC_STATUSES,
  DEFAULT_SOURCE_COLOR
} from '../../src/domain/calendar-source.js';
import { ValidationError } from '../../src/domain/meeting.js';

describe('Calendar Source Domain Model', () => {
  describe('validateCalendarSourceData', () => {
    it('should validate a valid subscription calendar source with defaults', () => {
      const input = {
        name: 'Work Google Calendar',
        type: 'subscription',
        url: 'https://calendar.google.com/feed.ics'
      };

      const validated = validateCalendarSourceData(input);
      assert.equal(validated.name, 'Work Google Calendar');
      assert.equal(validated.type, 'subscription');
      assert.equal(validated.url, 'https://calendar.google.com/feed.ics');
      assert.equal(validated.color, DEFAULT_SOURCE_COLOR);
      assert.equal(validated.enabled, 1);
      assert.equal(validated.syncStatus, 'ok');
      assert.equal(validated.syncError, '');
    });

    it('should validate a valid manual_import calendar source without URL', () => {
      const input = {
        name: 'Conference Offline 2026',
        type: 'manual_import',
        color: '#f59e0b'
      };

      const validated = validateCalendarSourceData(input);
      assert.equal(validated.name, 'Conference Offline 2026');
      assert.equal(validated.type, 'manual_import');
      assert.equal(validated.url, null);
      assert.equal(validated.color, '#f59e0b');
      assert.equal(validated.enabled, 1);
    });

    it('should validate a local calendar source', () => {
      const input = {
        name: 'Default Agenda',
        type: 'local',
        color: '#10b981'
      };

      const validated = validateCalendarSourceData(input);
      assert.equal(validated.name, 'Default Agenda');
      assert.equal(validated.type, 'local');
      assert.equal(validated.url, null);
      assert.equal(validated.color, '#10b981');
    });

    it('should throw ValidationError if name is missing or empty', () => {
      assert.throws(
        () => validateCalendarSourceData({ type: 'local' }),
        (err) => err instanceof ValidationError && /name/i.test(err.message)
      );

      assert.throws(
        () => validateCalendarSourceData({ name: '   ', type: 'local' }),
        (err) => err instanceof ValidationError && /name/i.test(err.message)
      );
    });

    it('should throw ValidationError if type is invalid', () => {
      assert.throws(
        () => validateCalendarSourceData({ name: 'Cal', type: 'invalid_type' }),
        (err) => err instanceof ValidationError && /type/i.test(err.message)
      );
    });

    it('should throw ValidationError if subscription type is missing url', () => {
      assert.throws(
        () => validateCalendarSourceData({ name: 'Sub', type: 'subscription' }),
        (err) => err instanceof ValidationError && /url/i.test(err.message)
      );

      assert.throws(
        () => validateCalendarSourceData({ name: 'Sub', type: 'subscription', url: '' }),
        (err) => err instanceof ValidationError && /url/i.test(err.message)
      );
    });

    it('should throw ValidationError if color is not a valid hex color code', () => {
      const invalidColors = ['red', '#12', '#12345', '#1234567', '123456', '#zzz'];
      for (const c of invalidColors) {
        assert.throws(
          () => validateCalendarSourceData({ name: 'Cal', type: 'local', color: c }),
          (err) => err instanceof ValidationError && /color/i.test(err.message),
          `Expected invalid color ${c} to throw ValidationError`
        );
      }
    });

    it('should support partial validation for PATCH operations', () => {
      const partialUpdate = validateCalendarSourceData(
        { color: '#8b5cf6', enabled: 0 },
        { isPartial: true }
      );
      assert.equal(partialUpdate.color, '#8b5cf6');
      assert.equal(partialUpdate.enabled, 0);
      assert.equal(partialUpdate.name, undefined);
    });

    it('should throw ValidationError in partial validation if provided field is invalid', () => {
      assert.throws(
        () => validateCalendarSourceData({ color: 'invalid' }, { isPartial: true }),
        (err) => err instanceof ValidationError
      );

      assert.throws(
        () => validateCalendarSourceData({ name: '   ' }, { isPartial: true }),
        (err) => err instanceof ValidationError
      );
    });
  });
});
