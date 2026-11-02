import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../helpers/test-db.js';
import { TaskService } from '../../src/services/task-service.js';
import { NotFoundError } from '../../src/services/agenda-service.js';
import { ValidationError } from '../../src/domain/meeting.js';

describe('TaskService', () => {
  let db;
  let service;

  beforeEach(() => {
    db = createTestDatabase();
    service = new TaskService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createTask', () => {
    it('should create and persist a task with defaults', () => {
      const task = service.createTask({
        title: 'Review firewall rules',
        priority: 'Alta',
        date: '2026-11-02'
      });

      assert.ok(task.id);
      assert.equal(task.title, 'Review firewall rules');
      assert.equal(task.priority, 'Alta');
      assert.equal(task.status, 'Pendiente');
      assert.equal(task.isFocus, false);
      assert.equal(task.date, '2026-11-02');
      assert.ok(task.createdAt);
      assert.ok(task.updatedAt);

      const fromDb = service.getTaskById(task.id);
      assert.equal(fromDb.title, 'Review firewall rules');
      assert.equal(fromDb.isFocus, false);
    });

    it('should create a task with isFocus = true', () => {
      const task = service.createTask({
        title: 'Isolate compromised host',
        priority: 'Alta',
        isFocus: true,
        date: '2026-11-02'
      });

      assert.equal(task.isFocus, true);
      const fromDb = service.getTaskById(task.id);
      assert.equal(fromDb.isFocus, true);
    });

    it('should throw ValidationError on invalid task data', () => {
      assert.throws(
        () => service.createTask({ title: '', priority: 'Alta' }),
        (err) => err instanceof ValidationError
      );

      assert.throws(
        () => service.createTask({ title: 'Valid', priority: 'Invalida' }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('getTasksByDate with filtering and intelligent sorting', () => {
    it('should return tasks sorted intelligently and filtered by status or priority', () => {
      const t1 = service.createTask({
        title: 'Low task',
        priority: 'Baja',
        status: 'Pendiente',
        date: '2026-11-02'
      });
      const t2 = service.createTask({
        title: 'Critical focus',
        priority: 'Alta',
        isFocus: true,
        status: 'Pendiente',
        date: '2026-11-02'
      });
      const t3 = service.createTask({
        title: 'Done task',
        priority: 'Alta',
        status: 'Completada',
        date: '2026-11-02'
      });

      // Default list (intelligent sort)
      const list = service.getTasksByDate('2026-11-02');
      assert.equal(list.length, 3);
      assert.equal(list[0].id, t2.id); // Focus Alta first
      assert.equal(list[1].id, t1.id); // Non-focus Baja active
      assert.equal(list[2].id, t3.id); // Completed last

      // Filter by status: 'Pendiente'
      const pendingList = service.getTasksByDate('2026-11-02', { status: 'Pendiente' });
      assert.equal(pendingList.length, 2);
      assert.ok(pendingList.every((t) => t.status === 'Pendiente'));

      // Filter by priority: 'Alta'
      const altaList = service.getTasksByDate('2026-11-02', { priority: 'Alta' });
      assert.equal(altaList.length, 2);
      assert.ok(altaList.every((t) => t.priority === 'Alta'));

      // Filter by isFocus: true
      const focusList = service.getTasksByDate('2026-11-02', { isFocus: true });
      assert.equal(focusList.length, 1);
      assert.equal(focusList[0].id, t2.id);
    });
  });

  describe('updateTask (PATCH)', () => {
    it('should partially update task fields', () => {
      const created = service.createTask({
        title: 'Original task',
        priority: 'Baja',
        date: '2026-11-02'
      });

      const updated = service.updateTask(created.id, {
        status: 'En Progreso',
        isFocus: true,
        priority: 'Media'
      });

      assert.equal(updated.id, created.id);
      assert.equal(updated.title, 'Original task');
      assert.equal(updated.status, 'En Progreso');
      assert.equal(updated.isFocus, true);
      assert.equal(updated.priority, 'Media');

      const reloaded = service.getTaskById(created.id);
      assert.equal(reloaded.status, 'En Progreso');
      assert.equal(reloaded.isFocus, true);
      assert.equal(reloaded.priority, 'Media');
    });

    it('should throw NotFoundError if task does not exist', () => {
      assert.throws(
        () => service.updateTask('non-existent', { status: 'Completada' }),
        (err) => err instanceof NotFoundError
      );
    });

    it('should throw ValidationError on invalid partial update', () => {
      const created = service.createTask({
        title: 'Original',
        priority: 'Baja',
        date: '2026-11-02'
      });

      assert.throws(
        () => service.updateTask(created.id, { priority: 'Invalida' }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task and return true', () => {
      const created = service.createTask({
        title: 'To delete',
        priority: 'Media',
        date: '2026-11-02'
      });

      const result = service.deleteTask(created.id);
      assert.equal(result, true);

      assert.equal(service.getTaskById(created.id), null);
    });

    it('should throw NotFoundError when deleting non-existent task', () => {
      assert.throws(
        () => service.deleteTask('non-existent'),
        (err) => err instanceof NotFoundError
      );
    });
  });

  describe('getTaskStatsByDate', () => {
    it('should calculate statistics for the given date', () => {
      service.createTask({ title: 'T1', priority: 'Alta', status: 'Completada', isFocus: true, date: '2026-11-02' });
      service.createTask({ title: 'T2', priority: 'Media', status: 'En Progreso', isFocus: false, date: '2026-11-02' });
      service.createTask({ title: 'T3', priority: 'Baja', status: 'Pendiente', isFocus: false, date: '2026-11-02' });
      // Other date
      service.createTask({ title: 'T4', priority: 'Alta', status: 'Completada', isFocus: true, date: '2026-11-03' });

      const stats = service.getTaskStatsByDate('2026-11-02');
      assert.deepEqual(stats, {
        total: 3,
        completed: 1,
        inProgress: 1,
        pending: 1,
        completionPercentage: 33,
        focusCount: 1
      });
    });
  });
});
