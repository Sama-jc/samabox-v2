import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTaskData,
  sortTasksIntelligently,
  calculateTaskStats,
  VALID_PRIORITIES,
  VALID_STATUSES
} from '../../src/domain/task.js';
import { ValidationError } from '../../src/domain/meeting.js';

describe('Task Domain Model', () => {
  describe('validateTaskData', () => {
    it('should validate and normalize valid task creation data', () => {
      const input = {
        title: 'Patch vulnerability CVE-2026-001',
        priority: 'Alta',
        isFocus: true,
        date: '2026-11-02'
      };

      const result = validateTaskData(input);
      assert.equal(result.title, 'Patch vulnerability CVE-2026-001');
      assert.equal(result.priority, 'Alta');
      assert.equal(result.status, 'Pendiente');
      assert.equal(result.isFocus, true);
      assert.equal(result.date, '2026-11-02');
    });

    it('should assign default status "Pendiente" and isFocus false if omitted', () => {
      const input = {
        title: 'Refactor code',
        priority: 'Media'
      };

      const result = validateTaskData(input);
      assert.equal(result.status, 'Pendiente');
      assert.equal(result.isFocus, false);
      assert.ok(result.date);
    });

    it('should throw ValidationError if title is missing or empty', () => {
      assert.throws(
        () => validateTaskData({ priority: 'Alta' }),
        (err) => err instanceof ValidationError && err.message.includes('title')
      );

      assert.throws(
        () => validateTaskData({ title: '   ', priority: 'Alta' }),
        (err) => err instanceof ValidationError && err.message.includes('title')
      );
    });

    it('should throw ValidationError if priority is invalid', () => {
      const invalidPriorities = ['Urgente', 'Critical', '1', '', null];
      for (const p of invalidPriorities) {
        assert.throws(
          () => validateTaskData({ title: 'Task', priority: p }),
          (err) => err instanceof ValidationError && err.message.includes('priority')
        );
      }
    });

    it('should throw ValidationError if status is invalid', () => {
      assert.throws(
        () => validateTaskData({ title: 'Task', priority: 'Media', status: 'InvalidStatus' }),
        (err) => err instanceof ValidationError && err.message.includes('status')
      );
    });

    it('should throw ValidationError if date format is invalid', () => {
      assert.throws(
        () => validateTaskData({ title: 'Task', priority: 'Baja', date: '02-11-2026' }),
        (err) => err instanceof ValidationError && err.message.includes('date')
      );
    });

    it('should support partial validation for PATCH operations', () => {
      const partial = validateTaskData({ status: 'En Progreso' }, { isPartial: true });
      assert.equal(partial.status, 'En Progreso');
      assert.equal(partial.title, undefined);

      assert.throws(
        () => validateTaskData({ status: 'Invalid' }, { isPartial: true }),
        (err) => err instanceof ValidationError
      );

      assert.throws(
        () => validateTaskData({ title: '   ' }, { isPartial: true }),
        (err) => err instanceof ValidationError
      );
    });
  });

  describe('sortTasksIntelligently', () => {
    it('should sort active Daily Focus tasks first, then by priority (Alta -> Media -> Baja), and completed tasks last', () => {
      const tasks = [
        { id: '1', title: 'Task 1', priority: 'Baja', status: 'Pendiente', isFocus: false },
        { id: '2', title: 'Task 2', priority: 'Alta', status: 'Completada', isFocus: false },
        { id: '3', title: 'Task 3', priority: 'Media', status: 'Pendiente', isFocus: true },
        { id: '4', title: 'Task 4', priority: 'Alta', status: 'Pendiente', isFocus: false },
        { id: '5', title: 'Task 5', priority: 'Alta', status: 'En Progreso', isFocus: true },
        { id: '6', title: 'Task 6', priority: 'Media', status: 'Completada', isFocus: true }
      ];

      const sorted = sortTasksIntelligently(tasks);

      // Expected order:
      // Active Focus: Task 5 (Alta, Focus), Task 3 (Media, Focus)
      // Active Non-Focus: Task 4 (Alta), Task 1 (Baja)
      // Completed: Task 6 (Media, Focus), Task 2 (Alta)
      assert.equal(sorted[0].id, '5'); // Focus Alta active
      assert.equal(sorted[1].id, '3'); // Focus Media active
      assert.equal(sorted[2].id, '4'); // Non-focus Alta active
      assert.equal(sorted[3].id, '1'); // Non-focus Baja active
      assert.equal(sorted[4].id, '6'); // Completed Focus
      assert.equal(sorted[5].id, '2'); // Completed Non-focus
    });

    it('should handle empty task list', () => {
      assert.deepEqual(sortTasksIntelligently([]), []);
    });
  });

  describe('calculateTaskStats', () => {
    it('should compute metrics correctly for empty list', () => {
      const stats = calculateTaskStats([]);
      assert.deepEqual(stats, {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        completionPercentage: 0,
        focusCount: 0
      });
    });

    it('should compute metrics correctly for mixed tasks', () => {
      const tasks = [
        { id: '1', status: 'Completada', isFocus: true },
        { id: '2', status: 'Completada', isFocus: false },
        { id: '3', status: 'En Progreso', isFocus: true },
        { id: '4', status: 'Pendiente', isFocus: false },
        { id: '5', status: 'Pendiente', isFocus: false }
      ];

      const stats = calculateTaskStats(tasks);
      assert.equal(stats.total, 5);
      assert.equal(stats.completed, 2);
      assert.equal(stats.inProgress, 1);
      assert.equal(stats.pending, 2);
      assert.equal(stats.completionPercentage, 40);
      assert.equal(stats.focusCount, 2);
    });
  });
});
