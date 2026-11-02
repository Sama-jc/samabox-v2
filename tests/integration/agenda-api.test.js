import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';

describe('Agenda API Integration Tests', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    db = createTestDatabase();
    server = createApp({ db });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  describe('GET /api/meetings', () => {
    it('should return empty list when no meetings exist for date', async () => {
      const res = await fetch(`${baseUrl}/api/meetings?date=2026-11-02`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
      const data = await res.json();
      assert.deepEqual(data, []);
    });
  });

  describe('POST /api/meetings', () => {
    it('should create meeting successfully and return 201', async () => {
      const payload = {
        title: 'Morning Standup',
        startTime: '09:00',
        endTime: '09:30',
        date: '2026-11-02',
        location: 'Room 101',
        notes: 'Review PRs'
      };

      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.meeting);
      assert.ok(data.meeting.id);
      assert.equal(data.meeting.title, 'Morning Standup');
      assert.equal(data.meeting.startTime, '09:00');
      assert.equal(data.meeting.endTime, '09:30');
      assert.equal(data.meeting.date, '2026-11-02');
      assert.equal(data.meeting.location, 'Room 101');
      assert.equal(data.meeting.notes, 'Review PRs');
    });

    it('should return 400 Bad Request when title is missing', async () => {
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '10:00',
          endTime: '11:00',
          date: '2026-11-02'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    it('should return 400 Bad Request when startTime >= endTime', async () => {
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bad Time Meeting',
          startTime: '14:00',
          endTime: '13:00',
          date: '2026-11-02'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('startTime must be before endTime'));
    });

    it('should return 400 Bad Request on invalid JSON payload', async () => {
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json '
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  describe('Conflict Detection via API (GET /api/meetings)', () => {
    it('should report hasConflict: true and conflictingIds for overlapping meetings', async () => {
      // Create first meeting: 11:00 - 12:00
      const res1 = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Architecture Review',
          startTime: '11:00',
          endTime: '12:00',
          date: '2026-11-02'
        })
      });
      const data1 = await res1.json();
      const id1 = data1.meeting.id;

      // Create overlapping meeting: 11:30 - 12:30
      const res2 = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Security Sync',
          startTime: '11:30',
          endTime: '12:30',
          date: '2026-11-02'
        })
      });
      const data2 = await res2.json();
      const id2 = data2.meeting.id;

      // Fetch meetings for date
      const listRes = await fetch(`${baseUrl}/api/meetings?date=2026-11-02`);
      assert.equal(listRes.status, 200);
      const list = await listRes.json();

      const m1 = list.find((m) => m.id === id1);
      const m2 = list.find((m) => m.id === id2);

      assert.ok(m1);
      assert.ok(m2);
      assert.equal(m1.hasConflict, true);
      assert.deepEqual(m1.conflictingIds, [id2]);
      assert.equal(m2.hasConflict, true);
      assert.deepEqual(m2.conflictingIds, [id1]);
    });
  });

  describe('PUT /api/meetings/:id', () => {
    it('should update meeting successfully and return 200', async () => {
      // Create meeting to update
      const createRes = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Before Update',
          startTime: '15:00',
          endTime: '16:00',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).meeting;

      const updateRes = await fetch(`${baseUrl}/api/meetings/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'After Update',
          startTime: '15:15',
          endTime: '16:15',
          location: 'Conference Room C'
        })
      });

      assert.equal(updateRes.status, 200);
      const updated = (await updateRes.json()).meeting;
      assert.equal(updated.id, created.id);
      assert.equal(updated.title, 'After Update');
      assert.equal(updated.startTime, '15:15');
      assert.equal(updated.endTime, '16:15');
      assert.equal(updated.location, 'Conference Room C');
    });

    it('should return 404 Not Found when updating non-existent id', async () => {
      const res = await fetch(`${baseUrl}/api/meetings/non-existent-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Missing Meeting',
          startTime: '09:00',
          endTime: '10:00'
        })
      });

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });

    it('should return 400 Bad Request when update has invalid times', async () => {
      const createRes = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Meeting for invalid update',
          startTime: '16:00',
          endTime: '17:00',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).meeting;

      const res = await fetch(`${baseUrl}/api/meetings/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '18:00',
          endTime: '17:00'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  describe('DELETE /api/meetings/:id', () => {
    it('should delete meeting and return 204 No Content', async () => {
      const createRes = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Temporary Meeting',
          startTime: '17:00',
          endTime: '18:00',
          date: '2026-11-02'
        })
      });
      const created = (await createRes.json()).meeting;

      const deleteRes = await fetch(`${baseUrl}/api/meetings/${created.id}`, {
        method: 'DELETE'
      });
      assert.equal(deleteRes.status, 204);

      // Verify it no longer exists
      const listRes = await fetch(`${baseUrl}/api/meetings?date=2026-11-02`);
      const list = await listRes.json();
      assert.ok(!list.some((m) => m.id === created.id));
    });

    it('should return 404 Not Found when deleting non-existent id', async () => {
      const res = await fetch(`${baseUrl}/api/meetings/non-existent-id-delete`, {
        method: 'DELETE'
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  describe('CORS and Preflight', () => {
    it('should respond to OPTIONS request with 204 and CORS headers', async () => {
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'OPTIONS'
      });
      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      assert.ok(res.headers.get('access-control-allow-methods').includes('GET'));
    });
  });

  describe('404 for unknown endpoints', () => {
    it('should return 404 for unknown route', async () => {
      const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });
  });
});
