import { getTodayDateString, detectMeetingConflicts } from '../domain/meeting.js';

export class UnifiedCalendarService {
  constructor({ db, agendaService, taskService }) {
    this.db = db;
    this.agendaService = agendaService;
    this.taskService = taskService;
  }

  getUnifiedCalendar(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();

    // 1. Fetch meetings for the date from local agenda and enabled external sources
    const stmt = this.db.prepare(`
      SELECT
        m.id,
        m.title,
        m.start_time,
        m.end_time,
        m.date,
        m.location,
        m.notes,
        m.source_id,
        m.entry_type,
        m.all_day,
        m.external_uid,
        m.created_at,
        m.updated_at,
        cs.name as source_name,
        cs.color as source_color,
        cs.enabled as source_enabled
      FROM meetings m
      LEFT JOIN calendar_sources cs ON m.source_id = cs.id
      WHERE m.date = ?
        AND (m.source_id IS NULL OR cs.enabled = 1)
      ORDER BY m.start_time ASC, m.end_time ASC
    `);

    const rows = stmt.all(queryDate);

    const timedEvents = [];
    const reminders = [];

    for (const row of rows) {
      const isExternal = Boolean(row.source_id);
      const sourceName = row.source_name || 'Local';
      const sourceColor = row.source_color || '#3b82f6';
      const allDay = row.all_day === 1 ? 1 : 0;
      const entryType = row.entry_type || (allDay === 1 ? 'reminder' : 'meeting');

      const item = {
        id: row.id,
        title: row.title,
        startTime: row.start_time,
        endTime: row.end_time,
        date: row.date,
        location: row.location || '',
        notes: row.notes || '',
        sourceId: row.source_id || null,
        sourceName,
        sourceColor,
        isExternal,
        entryType,
        allDay,
        externalUid: row.external_uid || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      if (allDay === 1 || entryType === 'reminder') {
        reminders.push({
          ...item,
          hasConflict: false,
          conflictingIds: []
        });
      } else {
        timedEvents.push(item);
      }
    }

    // 2. Global collision detection across all timed meetings of the date
    const meetings = detectMeetingConflicts(timedEvents);

    // 3. Project tasks for the date
    const tasks = this.taskService ? this.taskService.getTasksByDate(queryDate) : [];

    // 4. Retrieve list of enabled calendar sources
    const sourcesStmt = this.db.prepare(`
      SELECT id, name, type, url, color, enabled, last_synced_at, sync_status
      FROM calendar_sources
      WHERE enabled = 1
      ORDER BY name ASC
    `);
    const sourceRows = sourcesStmt.all();
    const sources = sourceRows.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      url: s.url || null,
      color: s.color,
      enabled: 1,
      lastSyncedAt: s.last_synced_at || null,
      syncStatus: s.sync_status || 'ok'
    }));

    // 5. Calculate statistics
    const totalMeetings = meetings.length;
    const conflictsCount = meetings.filter(m => m.hasConflict).length;
    const totalReminders = reminders.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completada').length;

    return {
      date: queryDate,
      meetings,
      reminders,
      tasks,
      sources,
      stats: {
        totalMeetings,
        conflictsCount,
        totalReminders,
        totalTasks,
        completedTasks
      }
    };
  }
}
