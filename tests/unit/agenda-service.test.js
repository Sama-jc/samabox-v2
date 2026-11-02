import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../helpers/test-db.js';
import { AgendaService, NotFoundError } from '../../src/services/agenda-service.js';
import { ValidationError } from '../../src/domain/meeting.js';

describe('AgendaService', () => {
  let db;
  let service;

  beforeEach(() => {
    db = createTestDatabase();
    service = new AgendaService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createMeeting', () => {
    it('should create and persist a meeting with default values', () => {
      const created = service.createMeeting({
        title: 'Weekly Standup',
        startTime: '10:00',
        endTime: '10:30',
        date: '2026-11-02'
      });

      assert.ok(created.id);
      assert.equal(created.title, 'Weekly Standup');
      assert.equal(created.startTime, '10:00');
      assert.equal(created.endTime, '10:30');
      assert.equal(created.date, '2026-11-02');
      assert.equal(created.location, '');
      assert.equal(created.notes, '');
      assert.ok(created.createdAt);
      assert.ok(created.updatedAt);

      const fromDb = service.getMeetingById(created.id);
      assert.equal(fromDb.title, 'Weekly Standup');
    });

    it('should throw ValidationError if input is invalid', () => {
      assert.throws(
        () => service.createMeeting({ title: '', startTime: '10:00', endTime: '10:30' }),
        (err) => err instanceof ValidationError
      );

      assert.throws(
        () => service.createMeeting({ title: 'Invalid time', startTime: '11:00', endTime: '10:00' }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('getMeetingsByDate', () => {
    it('should return meetings sorted chronologically with conflict metadata', () => {
      const m1 = service.createMeeting({
        title: 'Morning Catch-up',
        startTime: '09:00',
        endTime: '10:00',
        date: '2026-11-02'
      });

      const m2 = service.createMeeting({
        title: 'Overlapping Review',
        startTime: '09:30',
        endTime: '10:30',
        date: '2026-11-02'
      });

      const m3 = service.createMeeting({
        title: 'Separate Project Sync',
        startTime: '11:00',
        endTime: '12:00',
        date: '2026-11-02'
      });

      // Different date meeting should not be included
      service.createMeeting({
        title: 'Tomorrow Meeting',
        startTime: '09:00',
        endTime: '10:00',
        date: '2026-11-03'
      });

      const list = service.getMeetingsByDate('2026-11-02');
      assert.equal(list.length, 3);

      // Order check
      assert.equal(list[0].id, m1.id);
      assert.equal(list[1].id, m2.id);
      assert.equal(list[2].id, m3.id);

      // Conflict flags
      assert.equal(list[0].hasConflict, true);
      assert.deepEqual(list[0].conflictingIds, [m2.id]);

      assert.equal(list[1].hasConflict, true);
      assert.deepEqual(list[1].conflictingIds, [m1.id]);

      assert.equal(list[2].hasConflict, false);
      assert.deepEqual(list[2].conflictingIds, []);
    });

    it('should return empty array if no meetings exist on given date', () => {
      const list = service.getMeetingsByDate('2026-12-25');
      assert.deepEqual(list, []);
    });
  });

  describe('updateMeeting', () => {
    it('should update existing meeting attributes and validate invariants', () => {
      const created = service.createMeeting({
        title: 'Original Title',
        startTime: '10:00',
        endTime: '11:00',
        date: '2026-11-02'
      });

      const updated = service.updateMeeting(created.id, {
        title: 'Updated Title',
        startTime: '10:30',
        endTime: '11:30',
        location: 'Room B'
      });

      assert.equal(updated.id, created.id);
      assert.equal(updated.title, 'Updated Title');
      assert.equal(updated.startTime, '10:30');
      assert.equal(updated.endTime, '11:30');
      assert.equal(updated.location, 'Room B');

      const reloaded = service.getMeetingById(created.id);
      assert.equal(reloaded.title, 'Updated Title');
    });

    it('should throw NotFoundError if meeting to update does not exist', () => {
      assert.throws(
        () => service.updateMeeting('non-existent-id', { title: 'Foo', startTime: '09:00', endTime: '10:00' }),
        (err) => err instanceof NotFoundError
      );
    });

    it('should throw ValidationError if update causes invalid invariant', () => {
      const created = service.createMeeting({
        title: 'Valid Meeting',
        startTime: '10:00',
        endTime: '11:00',
        date: '2026-11-02'
      });

      assert.throws(
        () => service.updateMeeting(created.id, { startTime: '12:00', endTime: '11:00' }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('deleteMeeting', () => {
    it('should delete existing meeting and return true', () => {
      const created = service.createMeeting({
        title: 'To Delete',
        startTime: '14:00',
        endTime: '15:00',
        date: '2026-11-02'
      });

      const result = service.deleteMeeting(created.id);
      assert.equal(result, true);

      const found = service.getMeetingById(created.id);
      assert.equal(found, null);
    });

    it('should throw NotFoundError when deleting non-existent id', () => {
      assert.throws(
        () => service.deleteMeeting('missing-id'),
        (err) => err instanceof NotFoundError
      );
    });
  });
});
