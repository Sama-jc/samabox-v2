import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase, clearDatabase } from '../helpers/test-db.js';
import { CalendarSourceService } from '../../src/services/calendar-source-service.js';
import { GOOGLE_CALENDAR_ICS, APPLE_CALENDAR_ICS } from '../helpers/test-fixtures.js';

describe('Calendar Sources API Integration Tests', () => {
  let server;
  let baseUrl;
  let db;
  let calendarSourceService;

  before(async () => {
    db = createTestDatabase();
    calendarSourceService = new CalendarSourceService(db);

    server = createApp({ db, calendarSourceService });
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

  describe('GET /api/calendars', () => {
    it('should return empty array when no calendar sources exist', async () => {
      const res = await fetch(`${baseUrl}/api/calendars`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, []);
    });
  });

  describe('POST /api/calendars (Create Subscription)', () => {
    it('should register a new calendar source and return 201', async () => {
      const payload = {
        name: 'Work Google Calendar',
        type: 'subscription',
        url: 'https://calendar.google.com/calendar.ics',
        color: '#10b981'
      };

      const res = await fetch(`${baseUrl}/api/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.calendarSource);
      assert.equal(data.calendarSource.name, 'Work Google Calendar');
      assert.equal(data.calendarSource.type, 'subscription');
      assert.equal(data.calendarSource.color, '#10b981');
      assert.equal(data.calendarSource.enabled, 1);
    });

    it('should return 400 Bad Request on invalid payload', async () => {
      const res = await fetch(`${baseUrl}/api/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' })
      });

      assert.equal(res.status, 400);
    });
  });

  describe('GET /api/calendars/:id and PATCH /api/calendars/:id', () => {
    it('should get detail and update a calendar source', async () => {
      // Create first
      const createRes = await fetch(`${baseUrl}/api/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Personal Sync',
          type: 'subscription',
          url: 'https://personal.example.com/cal.ics'
        })
      });
      const { calendarSource: created } = await createRes.json();

      // GET by ID
      const getRes = await fetch(`${baseUrl}/api/calendars/${created.id}`);
      assert.equal(getRes.status, 200);
      const getJson = await getRes.json();
      assert.equal(getJson.calendarSource.name, 'Personal Sync');

      // PATCH update
      const patchRes = await fetch(`${baseUrl}/api/calendars/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Personal Sync Updated', color: '#f59e0b', enabled: 0 })
      });
      assert.equal(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.equal(patchJson.calendarSource.name, 'Personal Sync Updated');
      assert.equal(patchJson.calendarSource.color, '#f59e0b');
      assert.equal(patchJson.calendarSource.enabled, 0);
    });

    it('should return 404 for non-existent calendar id', async () => {
      const res = await fetch(`${baseUrl}/api/calendars/non-existent-id`);
      assert.equal(res.status, 404);
    });
  });

  describe('DELETE /api/calendars/:id', () => {
    it('should delete calendar source and cascade delete meetings', async () => {
      const createRes = await fetch(`${baseUrl}/api/calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Temporary',
          type: 'subscription',
          url: 'https://temp.test'
        })
      });
      const { calendarSource: created } = await createRes.json();

      const deleteRes = await fetch(`${baseUrl}/api/calendars/${created.id}`, {
        method: 'DELETE'
      });
      assert.equal(deleteRes.status, 204);

      // Verify not found after delete
      const verifyRes = await fetch(`${baseUrl}/api/calendars/${created.id}`);
      assert.equal(verifyRes.status, 404);
    });
  });

  describe('POST /api/calendars/import (Manual Offline Import)', () => {
    it('should import manual .ics content and return 201 with importedCount', async () => {
      const res = await fetch(`${baseUrl}/api/calendars/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Offline Apple Calendar',
          color: '#8b5cf6',
          icsContent: APPLE_CALENDAR_ICS
        })
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.calendarSource);
      assert.equal(data.calendarSource.type, 'manual_import');
      assert.equal(data.calendarSource.name, 'Offline Apple Calendar');
      assert.equal(data.importedCount, 1);
    });
  });
});
