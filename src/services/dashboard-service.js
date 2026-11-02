import { getTodayDateString } from '../domain/meeting.js';

export class DashboardService {
  constructor({ briefingService, agendaService, taskService }) {
    this.briefingService = briefingService;
    this.agendaService = agendaService;
    this.taskService = taskService;
  }

  async getSummary(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();

    const [briefing, meetings, taskStats] = await Promise.all([
      this.briefingService.getBriefingByDate(queryDate),
      Promise.resolve(this.agendaService.getMeetingsByDate(queryDate)),
      Promise.resolve(this.taskService.getTaskStatsByDate(queryDate))
    ]);

    const totalMeetings = meetings.length;
    const conflictsCount = meetings.filter((m) => m.hasConflict).length;

    // Determine next meeting
    let nextMeeting = null;
    if (totalMeetings > 0) {
      const now = new Date();
      const todayStr = getTodayDateString();
      if (queryDate === todayStr) {
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        nextMeeting = meetings.find((m) => m.endTime >= currentTime) || null;
      }
      if (!nextMeeting) {
        nextMeeting = meetings[0] || null;
      }
    }

    return {
      date: queryDate,
      briefingCount: briefing?.items ? briefing.items.length : 0,
      mode: briefing?.mode || 'HEURISTIC_LOCAL',
      meetingStats: {
        total: totalMeetings,
        conflictsCount,
        nextMeeting
      },
      taskStats
    };
  }
}
