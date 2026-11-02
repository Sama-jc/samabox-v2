import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DashboardService } from '../../src/services/dashboard-service.js';

describe('DashboardService', () => {
  it('should consolidate morning kickoff metrics accurately', async () => {
    const mockBriefingService = {
      getBriefingByDate: async (date) => ({
        date,
        mode: 'LLM_CLOUD',
        items: [
          { id: 'b1', title: 'News 1' },
          { id: 'b2', title: 'News 2' },
          { id: 'b3', title: 'News 3' }
        ]
      })
    };

    const mockAgendaService = {
      getMeetingsByDate: (date) => [
        { id: 'm1', title: 'Standup', startTime: '09:00', endTime: '09:30', hasConflict: true },
        { id: 'm2', title: 'Client Call', startTime: '09:15', endTime: '10:00', hasConflict: true },
        { id: 'm3', title: 'Review', startTime: '14:00', endTime: '15:00', hasConflict: false }
      ]
    };

    const mockTaskService = {
      getTaskStatsByDate: (date) => ({
        total: 5,
        completed: 2,
        inProgress: 1,
        pending: 2,
        completionPercentage: 40,
        focusCount: 1
      })
    };

    const dashboardService = new DashboardService({
      briefingService: mockBriefingService,
      agendaService: mockAgendaService,
      taskService: mockTaskService
    });

    const summary = await dashboardService.getSummary('2026-11-02');

    assert.equal(summary.date, '2026-11-02');
    assert.equal(summary.briefingCount, 3);
    assert.equal(summary.mode, 'LLM_CLOUD');

    // Meeting stats
    assert.equal(summary.meetingStats.total, 3);
    assert.equal(summary.meetingStats.conflictsCount, 2);
    assert.ok(summary.meetingStats.nextMeeting);
    assert.equal(summary.meetingStats.nextMeeting.id, 'm1');

    // Task stats
    assert.equal(summary.taskStats.total, 5);
    assert.equal(summary.taskStats.completed, 2);
    assert.equal(summary.taskStats.inProgress, 1);
    assert.equal(summary.taskStats.pending, 2);
    assert.equal(summary.taskStats.completionPercentage, 40);
    assert.equal(summary.taskStats.focusCount, 1);
  });

  it('should handle empty day metrics cleanly without errors', async () => {
    const mockBriefingService = {
      getBriefingByDate: async (date) => ({ date, mode: 'HEURISTIC_LOCAL', items: [] })
    };
    const mockAgendaService = {
      getMeetingsByDate: () => []
    };
    const mockTaskService = {
      getTaskStatsByDate: () => ({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        completionPercentage: 0,
        focusCount: 0
      })
    };

    const dashboardService = new DashboardService({
      briefingService: mockBriefingService,
      agendaService: mockAgendaService,
      taskService: mockTaskService
    });

    const summary = await dashboardService.getSummary('2026-12-31');
    assert.equal(summary.date, '2026-12-31');
    assert.equal(summary.briefingCount, 0);
    assert.equal(summary.mode, 'HEURISTIC_LOCAL');
    assert.equal(summary.meetingStats.total, 0);
    assert.equal(summary.meetingStats.conflictsCount, 0);
    assert.equal(summary.meetingStats.nextMeeting, null);
    assert.equal(summary.taskStats.total, 0);
    assert.equal(summary.taskStats.completionPercentage, 0);
  });
});
