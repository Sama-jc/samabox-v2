import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../helpers/test-db.js';
import { UnifiedCalendarService } from '../../src/services/unified-calendar-service.js';
import { AgendaService } from '../../src/services/agenda-service.js';
import { TaskService } from '../../src/services/task-service.js';

describe('UnifiedCalendarService Unit Tests', () => {
  let db;
  let agendaService;
  let taskService;
  let unifiedService;

  beforeEach(() => {
    db = createTestDatabase();
    agendaService = new AgendaService(db);
    taskService = new TaskService(db);
    unifiedService = new UnifiedCalendarService({ db, agendaService, taskService });
  });

  it('should return empty unified structure when no events exist for date', () => {
    const result = unifiedService.getUnifiedCalendar('2026-11-02');
    assert.equal(result.date, '2026-11-02');
    assert.deepEqual(result.meetings, []);
    assert.deepEqual(result.reminders, []);
    assert.deepEqual(result.tasks, []);
    assert.deepEqual(result.sources, []);
    assert.equal(result.stats.totalMeetings, 0);
    assert.equal(result.stats.conflictsCount, 0);
    assert.equal(result.stats.totalReminders, 0);
    assert.equal(result.stats.totalTasks, 0);
  });

  it('should consolidate local and external meetings and detect cross-source collisions', () => {
    const now = new Date().toISOString();

    // 1. Create a calendar source
    db.prepare(`
      INSERT INTO calendar_sources (id, name, type, url, color, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('src-corp', 'Corporate Cal', 'subscription', 'https://corp.test', '#e11d48', 1, now, now);

    // 2. Create local meeting 09:30 - 10:30
    agendaService.createMeeting({
      title: 'Local Standup',
      startTime: '09:30',
      endTime: '10:30',
      date: '2026-11-02'
    });

    // 3. Create external meeting 10:00 - 11:00 (overlaps with Local Standup!)
    db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, external_uid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m-ext-1', 'Client Architecture Call', '10:00', '11:00', '2026-11-02', 'src-corp', 'meeting', 0, 'uid-1', now, now);

    // 4. Create external reminder (all-day)
    db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, external_uid, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m-rem-1', 'Corporate Holiday', '00:00', '23:59', '2026-11-02', 'src-corp', 'reminder', 1, 'uid-rem-1', now, now);

    // 5. Create a task assigned to today
    taskService.createTask({
      title: 'Review PR #42',
      priority: 'Alta',
      isFocus: true,
      date: '2026-11-02'
    });

    const result = unifiedService.getUnifiedCalendar('2026-11-02');

    // Meetings
    assert.equal(result.meetings.length, 2);
    const local = result.meetings.find(m => !m.isExternal);
    const external = result.meetings.find(m => m.isExternal);

    assert.ok(local);
    assert.equal(local.sourceName, 'Local');
    assert.equal(local.hasConflict, true, 'Local meeting should have cross-source conflict detected');

    assert.ok(external);
    assert.equal(external.sourceName, 'Corporate Cal');
    assert.equal(external.sourceColor, '#e11d48');
    assert.equal(external.hasConflict, true, 'External meeting should have cross-source conflict detected');

    // Reminders
    assert.equal(result.reminders.length, 1);
    assert.equal(result.reminders[0].title, 'Corporate Holiday');
    assert.equal(result.reminders[0].allDay, 1);

    // Tasks projection
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].title, 'Review PR #42');
    assert.equal(result.tasks[0].priority, 'Alta');
    assert.equal(result.tasks[0].isFocus, true);

    // Stats
    assert.equal(result.stats.totalMeetings, 2);
    assert.equal(result.stats.conflictsCount, 2);
    assert.equal(result.stats.totalReminders, 1);
    assert.equal(result.stats.totalTasks, 1);
  });

  it('should ignore meetings from disabled calendar sources', () => {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO calendar_sources (id, name, type, color, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('src-disabled', 'Disabled Source', 'manual_import', '#64748b', 0, now, now);

    db.prepare(`
      INSERT INTO meetings (id, title, start_time, end_time, date, source_id, entry_type, all_day, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('m-disabled', 'Hidden Meeting', '14:00', '15:00', '2026-11-02', 'src-disabled', 'meeting', 0, now, now);

    const result = unifiedService.getUnifiedCalendar('2026-11-02');
    assert.equal(result.meetings.length, 0);
  });
});
