import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, SECURITY_HEADERS } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';

describe('Operational Hardening & Health Check API', () => {
  let server;
  let baseUrl;
  let testDb;

  before(async () => {
    testDb = createTestDatabase();
    server = createApp({
      db: testDb,
      briefingService: {
        analysisMode: 'HEURISTIC_LOCAL',
        getBriefingByDate: async () => ({ items: [] }),
        refreshBriefing: async () => ({ items: [] })
      }
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

  describe('GET /api/health', () => {
    it('should return 200 OK with database: connected and mode metadata', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/json; charset=utf-8');

      const body = await res.json();
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.database, 'connected');
      assert.ok(body.mode);
      assert.ok(body.timestamp);
    });

    it('should return 503 if database check fails', async () => {
      const mockBrokenDb = {
        prepare: () => {
          throw new Error('Database connection lost');
        }
      };

      const brokenServer = createApp({
        db: mockBrokenDb
      });

      await new Promise((resolve) => {
        brokenServer.listen(0, '127.0.0.1', resolve);
      });
      const brokenUrl = `http://127.0.0.1:${brokenServer.address().port}`;

      try {
        const res = await fetch(`${brokenUrl}/api/health`);
        assert.strictEqual(res.status, 503);
        const body = await res.json();
        assert.strictEqual(body.status, 'error');
        assert.strictEqual(body.database, 'disconnected');
        assert.ok(body.error.includes('Database connection lost'));
      } finally {
        await new Promise((resolve) => brokenServer.close(resolve));
      }
    });
  });

  describe('HTTP Security Headers', () => {
    it('should include nosniff, DENY, and strict-origin-when-cross-origin on API responses', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    it('should include security headers on static file responses', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    it('should include security headers on 404 responses', async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-route`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });
  });

  describe('Payload Size Limit (Hardening)', () => {
    it('should reject payloads exceeding 64KB with 413 Payload Too Large', async () => {
      const largeTitle = 'A'.repeat(70 * 1024); // 70 KB payload
      const res = await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: largeTitle,
          date: '2026-11-02',
          startTime: '09:00',
          endTime: '10:00'
        })
      });

      assert.strictEqual(res.status, 413);
      const data = await res.json();
      assert.ok(data.error.toLowerCase().includes('payload too large'));
    });
  });
});
