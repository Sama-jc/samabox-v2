import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';

describe('V2 Complete Multi-Screen Architecture & Hybrid Calendar Workflow (E2E)', () => {
  let server;
  let baseUrl;
  let testDb;
  const testDate = '2026-11-02';

  before(async () => {
    testDb = createTestDatabase();
    server = createApp({
      db: testDb
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    testDb.close();
  });

  it('Step 1: System Health, SPA App Shell & Modular ES Components Serving', async () => {
    // 1.1 Verify operational health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    const health = await healthRes.json();
    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(health.database, 'connected');

    // 1.2 Verify SPA shell index.html
    const rootRes = await fetch(`${baseUrl}/`);
    assert.strictEqual(rootRes.status, 200);
    const html = await rootRes.text();
    assert.ok(html.includes('app-nav'), 'Must contain SPA navigation');
    assert.ok(html.includes('view-container'), 'Must contain dynamic SPA view container');
    assert.ok(html.includes('#/summary'));
    assert.ok(html.includes('#/calendar'));
    assert.ok(html.includes('#/tasks'));
    assert.ok(html.includes('#/news'));

    // 1.3 Verify static serving of V2 frontend components
    const modules = [
      '/js/router.js',
      '/js/components/summary-view.js',
      '/js/components/calendar-view.js',
      '/js/components/calendar-modal.js',
      '/js/components/tasks-view.js',
      '/js/components/news-view.js'
    ];

    for (const mod of modules) {
      const res = await fetch(`${baseUrl}${mod}`);
      assert.strictEqual(res.status, 200, `Module ${mod} must be served`);
      assert.ok(res.headers.get('content-type')?.includes('javascript'));
    }
  });

  it('Step 2: Hybrid Calendar Management (Manual Offline .ICS Import & Subscriptions)', async () => {
    // 2.1 Import offline .ics content (e.g. from vendor conference / team export)
    const sampleIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vendor Incident Sync//EN',
      'BEGIN:VEVENT',
      'UID:vendor-ext-999@secops.corp',
      'DTSTART:20261102T100000Z',
      'DTEND:20261102T110000Z',
      'SUMMARY:Vendor Security Audit Standup',
      'LOCATION:Bridge Room Alpha',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:reminder-all-day-777@secops.corp',
      'DTSTART;VALUE=DATE:20261102',
      'SUMMARY:Firewall Rule Renewal Deadline',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const importRes = await fetch(`${baseUrl}/api/calendars/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vendor Security Team',
        color: '#f85149',
        icsContent: sampleIcs
      })
    });
    assert.strictEqual(importRes.status, 201);
    const importData = await importRes.json();
    assert.ok(importData.calendarSource?.id || importData.source?.id);
    assert.strictEqual(importData.importedCount, 2);

    // 2.2 Verify sources list
    const sourcesRes = await fetch(`${baseUrl}/api/calendars`);
    assert.strictEqual(sourcesRes.status, 200);
    const sources = await sourcesRes.json();
    assert.ok(sources.length >= 1);
    const vendorSource = sources.find(s => s.name === 'Vendor Security Team');
    assert.ok(vendorSource);
    assert.strictEqual(vendorSource.color, '#f85149');
  });

  it('Step 3: Multi-Source Calendar Consolidation, Collision Detection & Reminders', async () => {
    // 3.1 Create local overlapping meeting (10:30 - 11:30, overlaps with 10:00 - 11:00)
    const localMeetingRes = await fetch(`${baseUrl}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Local SOC Internal Review',
        date: testDate,
        startTime: '10:30',
        endTime: '11:30',
        location: 'Local War Room'
      })
    });
    assert.strictEqual(localMeetingRes.status, 201);

    // 3.2 Query unified calendar endpoint
    const unifiedRes = await fetch(`${baseUrl}/api/calendar/unified?date=${testDate}`);
    assert.strictEqual(unifiedRes.status, 200);
    const unified = await unifiedRes.json();

    assert.strictEqual(unified.date, testDate);
    assert.ok(Array.isArray(unified.meetings));
    assert.ok(Array.isArray(unified.allDayEvents));

    // Verify all-day reminder was parsed into allDayEvents lane
    const reminder = unified.allDayEvents.find(e => e.title === 'Firewall Rule Renewal Deadline');
    assert.ok(reminder, 'Must include all-day reminder');
    assert.strictEqual(reminder.sourceName, 'Vendor Security Team');
    assert.strictEqual(reminder.sourceColor, '#f85149');

    // Verify cross-account collision detection
    const vendorMeeting = unified.meetings.find(m => m.title === 'Vendor Security Audit Standup');
    const localMeeting = unified.meetings.find(m => m.title === 'Local SOC Internal Review');

    assert.ok(vendorMeeting);
    assert.ok(localMeeting);
    assert.strictEqual(vendorMeeting.isExternal, true);
    assert.strictEqual(localMeeting.isExternal, false);
    assert.strictEqual(vendorMeeting.hasConflict, true, 'Vendor meeting must flag overlap conflict');
    assert.strictEqual(localMeeting.hasConflict, true, 'Local meeting must flag overlap conflict');
  });

  it('Step 4: Kanban Task Lifecycle & Automatic Projection in Calendar', async () => {
    // 4.1 Create task for testDate
    const taskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Deploy Hotfix for CVE-2026-9999',
        priority: 'Alta',
        isFocus: true,
        date: testDate
      })
    });
    assert.strictEqual(taskRes.status, 201);
    const task = (await taskRes.json()).task;
    assert.strictEqual(task.status, 'Pendiente');

    // 4.2 Verify task appears projected in unified calendar for the date
    const unifiedRes1 = await fetch(`${baseUrl}/api/calendar/unified?date=${testDate}`);
    const unified1 = await unifiedRes1.json();
    const projected1 = unified1.projectedTasks.find(t => t.id === task.id);
    assert.ok(projected1, 'Task must be projected in unified calendar');
    assert.strictEqual(projected1.status, 'Pendiente');
    assert.strictEqual(projected1.isFocus, true);

    // 4.3 Transition task via Kanban (Pendiente -> En Progreso)
    const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'En Progreso' })
    });
    assert.strictEqual(patchRes.status, 200);

    // 4.4 Verify updated status reflected immediately in unified calendar
    const unifiedRes2 = await fetch(`${baseUrl}/api/calendar/unified?date=${testDate}`);
    const unified2 = await unifiedRes2.json();
    const projected2 = unified2.projectedTasks.find(t => t.id === task.id);
    assert.strictEqual(projected2.status, 'En Progreso');
  });

  it('Step 5: Executive Summary Dashboard with Configurable News Limit & Metrics', async () => {
    // 5.1 Query summary with newsLimit = 1
    const summaryRes1 = await fetch(`${baseUrl}/api/dashboard/summary?date=${testDate}&newsLimit=1`);
    assert.strictEqual(summaryRes1.status, 200);
    const summary1 = await summaryRes1.json();
    assert.strictEqual(summary1.topNews.length, 1);
    assert.ok(summary1.briefingCount >= 1);
    assert.ok(summary1.meetingStats.conflictsCount > 0);

    // 5.2 Query summary with newsLimit = 5
    const summaryRes2 = await fetch(`${baseUrl}/api/dashboard/summary?date=${testDate}&newsLimit=5`);
    assert.strictEqual(summaryRes2.status, 200);
    const summary2 = await summaryRes2.json();
    assert.ok(summary2.topNews.length <= 5);
    assert.ok(summary2.topNews.length >= summary1.topNews.length);
  });
});
