import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase, clearDatabase } from '../helpers/test-db.js';
import { BriefingService } from '../../src/services/briefing-service.js';
import { GOOGLE_CALENDAR_ICS } from '../helpers/test-fixtures.js';

describe('Unified Calendar & Dashboard Integration Tests', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    db = createTestDatabase();

    const mockRssAdapter = {
      fetchNews: async () => [
        { title: 'Item 1', url: 'https://1.test', source: 'Source 1', publishedAt: '2026-11-02T08:00:00Z', contentSnippet: 'N1' },
        { title: 'Item 2', url: 'https://2.test', source: 'Source 2', publishedAt: '2026-11-02T09:00:00Z', contentSnippet: 'N2' },
        { title: 'Item 3', url: 'https://3.test', source: 'Source 3', publishedAt: '2026-11-02T10:00:00Z', contentSnippet: 'N3' },
        { title: 'Item 4', url: 'https://4.test', source: 'Source 4', publishedAt: '2026-11-02T11:00:00Z', contentSnippet: 'N4' },
        { title: 'Item 5', url: 'https://5.test', source: 'Source 5', publishedAt: '2026-11-02T12:00:00Z', contentSnippet: 'N5' }
      ]
    };

    const mockLlmAdapter = {
      analyzeNewsItem: async (item) => ({
        summary: `Summary of ${item.title}`,
        commentary: `Commentary on ${item.title}`,
        analysisMode: 'HEURISTIC_LOCAL'
      })
    };

    const briefingService = new BriefingService({ db, rssAdapter: mockRssAdapter, llmAdapter: mockLlmAdapter });

    server = createApp({ db, briefingService });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  beforeEach(() => {
    clearDatabase(db);
  });

  describe('GET /api/calendar/unified', () => {
    it('should return consolidated schedule with collision detection and task projection', async () => {
      // 1. Create a local meeting 09:00 - 10:00
      await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Daily Kickoff',
          startTime: '09:00',
          endTime: '10:00',
          date: '2026-11-02'
        })
      });

      // 2. Import external calendar (Google sample: contains Sprint Planning at 09:30-10:30 which overlaps!)
      await fetch(`${baseUrl}/api/calendars/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Google Calendar Account',
          color: '#3b82f6',
          icsContent: GOOGLE_CALENDAR_ICS
        })
      });

      // 3. Create a task assigned to 2026-11-02
      await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Fix CSRF token bug',
          priority: 'Alta',
          isFocus: true,
          date: '2026-11-02'
        })
      });

      // Query unified endpoint
      const res = await fetch(`${baseUrl}/api/calendar/unified?date=2026-11-02`);
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.date, '2026-11-02');

      // Meetings check
      assert.equal(data.meetings.length, 2);
      const localMeeting = data.meetings.find(m => m.title === 'Daily Kickoff');
      const extMeeting = data.meetings.find(m => m.title === 'Sprint Planning');

      assert.ok(localMeeting);
      assert.equal(localMeeting.isExternal, false);
      assert.equal(localMeeting.hasConflict, true, 'Local meeting should detect collision with external');

      assert.ok(extMeeting);
      assert.equal(extMeeting.isExternal, true);
      assert.equal(extMeeting.sourceName, 'Google Calendar Account');
      assert.equal(extMeeting.sourceColor, '#3b82f6');
      assert.equal(extMeeting.hasConflict, true, 'External meeting should detect collision with local');

      // Reminders check: Google ICS also has an all-day event "Company Hackathon" on 2026-11-03
      // Query 2026-11-03
      const resNextDay = await fetch(`${baseUrl}/api/calendar/unified?date=2026-11-03`);
      const dataNextDay = await resNextDay.json();
      assert.equal(dataNextDay.reminders.length, 1);
      assert.equal(dataNextDay.reminders[0].title, 'Company Hackathon');
      assert.equal(dataNextDay.reminders[0].allDay, 1);

      // Tasks projection check on 2026-11-02
      assert.equal(data.tasks.length, 1);
      assert.equal(data.tasks[0].title, 'Fix CSRF token bug');
      assert.equal(data.tasks[0].priority, 'Alta');
      assert.equal(data.tasks[0].isFocus, true);
    });
  });

  describe('GET /api/dashboard/summary with newsLimit', () => {
    it('should limit topNews based on newsLimit parameter', async () => {
      // First populate briefing
      await fetch(`${baseUrl}/api/briefing/refresh`, { method: 'POST' });

      // Request with newsLimit = 1
      const res1 = await fetch(`${baseUrl}/api/dashboard/summary?date=2026-11-02&newsLimit=1`);
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.topNews.length, 1);

      // Request with newsLimit = 3
      const res3 = await fetch(`${baseUrl}/api/dashboard/summary?date=2026-11-02&newsLimit=3`);
      assert.equal(res3.status, 200);
      const data3 = await res3.json();
      assert.equal(data3.topNews.length, 3);
    });
  });
});
