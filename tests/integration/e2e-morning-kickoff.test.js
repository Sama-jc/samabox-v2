import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';

describe('End-to-End Morning Kickoff Workflow', () => {
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

  it('Step 1: System Health Check & Static Dashboard Initial Load', async () => {
    // Check health endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    const health = await healthRes.json();
    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(health.database, 'connected');
    assert.ok(health.timestamp);

    // Verify root serving of Web Dashboard
    const rootRes = await fetch(`${baseUrl}/`);
    assert.strictEqual(rootRes.status, 200);
    assert.strictEqual(rootRes.headers.get('content-type'), 'text/html; charset=utf-8');
    const html = await rootRes.text();
    assert.ok(html.includes('Samabox — Morning Kickoff Dashboard'));
    assert.ok(html.includes('briefing-container'));
    assert.ok(html.includes('agenda-container'));
    assert.ok(html.includes('tasks-container'));
  });

  it('Step 2: Security Briefing Ingestion & Reading (>= 3 news with summary and commentary)', async () => {
    const briefingRes = await fetch(`${baseUrl}/api/briefing?date=${testDate}`);
    assert.strictEqual(briefingRes.status, 200);
    const briefing = await briefingRes.json();

    assert.strictEqual(briefing.date, testDate);
    assert.ok(Array.isArray(briefing.items));
    assert.ok(briefing.items.length >= 3, 'Must deliver at least 3 cybersecurity news items');

    for (const item of briefing.items) {
      assert.ok(item.title && item.title.trim().length > 0);
      assert.ok(item.url && item.url.startsWith('http'));
      assert.ok(item.source);
      // Mandatory requirement: Resumen a leer
      assert.ok(item.summary && item.summary.trim().length > 0, 'Summary (Resumen a leer) is mandatory');
      // Mandatory requirement: Comentarios al respecto
      assert.ok(item.commentary && item.commentary.trim().length > 0, 'Commentary (Comentarios al respecto) is mandatory');
      assert.ok(['LLM_CLOUD', 'HEURISTIC_LOCAL'].includes(item.analysisMode));
    }
  });

  it('Step 3: Agenda Planning, Collision Detection & Rescheduling', async () => {
    // 3.1 Create first meeting (09:00 - 10:00)
    const m1Res = await fetch(`${baseUrl}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'SecOps Daily Standup',
        date: testDate,
        startTime: '09:00',
        endTime: '10:00',
        location: 'War Room A / Meet',
        notes: 'Reviewing overnight triage alerts'
      })
    });
    assert.strictEqual(m1Res.status, 201);
    const m1Data = await m1Res.json();
    const m1Id = m1Data.meeting.id;
    assert.ok(m1Id);

    // 3.2 Create overlapping meeting (09:30 - 10:30)
    const m2Res = await fetch(`${baseUrl}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Vendor Incident Review',
        date: testDate,
        startTime: '09:30',
        endTime: '10:30',
        location: 'Zoom 452'
      })
    });
    assert.strictEqual(m2Res.status, 201);
    const m2Data = await m2Res.json();
    const m2Id = m2Data.meeting.id;
    assert.ok(m2Id);

    // 3.3 List meetings and verify collision detected
    const listRes = await fetch(`${baseUrl}/api/meetings?date=${testDate}`);
    assert.strictEqual(listRes.status, 200);
    const meetings = await listRes.json();
    assert.strictEqual(meetings.length, 2);

    const m1 = meetings.find((m) => m.id === m1Id);
    const m2 = meetings.find((m) => m.id === m2Id);

    assert.strictEqual(m1.hasConflict, true, 'Meeting 1 must be flagged with conflict');
    assert.ok(m1.conflictingIds.includes(m2Id));
    assert.strictEqual(m2.hasConflict, true, 'Meeting 2 must be flagged with conflict');
    assert.ok(m2.conflictingIds.includes(m1Id));

    // 3.4 Reschedule Meeting 2 to 10:00 - 11:00 to resolve overlap
    const updateRes = await fetch(`${baseUrl}/api/meetings/${m2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime: '10:00',
        endTime: '11:00'
      })
    });
    assert.strictEqual(updateRes.status, 200);

    // 3.5 Verify conflict is resolved
    const resolvedRes = await fetch(`${baseUrl}/api/meetings?date=${testDate}`);
    assert.strictEqual(resolvedRes.status, 200);
    const resolvedMeetings = await resolvedRes.json();

    const m1Updated = resolvedMeetings.find((m) => m.id === m1Id);
    const m2Updated = resolvedMeetings.find((m) => m.id === m2Id);

    assert.strictEqual(m1Updated.hasConflict, false, 'Collision must be cleared after reschedule');
    assert.deepStrictEqual(m1Updated.conflictingIds, []);
    assert.strictEqual(m2Updated.hasConflict, false, 'Collision must be cleared after reschedule');
    assert.deepStrictEqual(m2Updated.conflictingIds, []);
  });

  it('Step 4: Task Management with Daily Focus & Lifecycle Progression', async () => {
    // 4.1 Create tasks with priorities and focus
    const t1Res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Apply patch to edge VPN gateways (CVE-2026-1102)',
        priority: 'Alta',
        isFocus: true,
        date: testDate
      })
    });
    assert.strictEqual(t1Res.status, 201);
    const t1 = (await t1Res.json()).task;

    const t2Res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Review cloud audit logs for root account logins',
        priority: 'Media',
        isFocus: false,
        date: testDate
      })
    });
    assert.strictEqual(t2Res.status, 201);
    const t2 = (await t2Res.json()).task;

    const t3Res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Update incident escalation directory',
        priority: 'Baja',
        isFocus: false,
        date: testDate
      })
    });
    assert.strictEqual(t3Res.status, 201);
    const t3 = (await t3Res.json()).task;

    // 4.2 Verify initial sorting (Focus first)
    const listTasksRes = await fetch(`${baseUrl}/api/tasks?date=${testDate}`);
    assert.strictEqual(listTasksRes.status, 200);
    const tasks = await listTasksRes.json();
    assert.strictEqual(tasks.length, 3);
    assert.strictEqual(tasks[0].id, t1.id, 'Daily Focus task must be first');

    // 4.3 Update task progression: complete t1, start t2
    const completeRes = await fetch(`${baseUrl}/api/tasks/${t1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completada' })
    });
    assert.strictEqual(completeRes.status, 200);

    const startRes = await fetch(`${baseUrl}/api/tasks/${t2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'En Progreso' })
    });
    assert.strictEqual(startRes.status, 200);
  });

  it('Step 5: Unified Morning Kickoff Dashboard Summary Aggregation', async () => {
    const summaryRes = await fetch(`${baseUrl}/api/dashboard/summary?date=${testDate}`);
    assert.strictEqual(summaryRes.status, 200);
    const summary = await summaryRes.json();

    assert.strictEqual(summary.date, testDate);
    assert.ok(summary.briefingCount >= 3);
    assert.ok(['LLM_CLOUD', 'HEURISTIC_LOCAL'].includes(summary.mode));

    // Meeting statistics validation
    assert.strictEqual(summary.meetingStats.total, 2);
    assert.strictEqual(summary.meetingStats.conflictsCount, 0);
    assert.strictEqual(summary.meetingStats.nextMeeting.title, 'SecOps Daily Standup');
    assert.strictEqual(summary.meetingStats.nextMeeting.startTime, '09:00');

    // Task statistics validation
    assert.strictEqual(summary.taskStats.total, 3);
    assert.strictEqual(summary.taskStats.completed, 1);
    assert.strictEqual(summary.taskStats.inProgress, 1);
    assert.strictEqual(summary.taskStats.pending, 1);
    assert.strictEqual(summary.taskStats.completionPercentage, 33);
    assert.strictEqual(summary.taskStats.focusCount, 1);
  });
});
