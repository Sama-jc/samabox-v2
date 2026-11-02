import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';
import { BriefingService } from '../../src/services/briefing-service.js';

describe('Dashboard API & Static File Serving Integration Tests', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    db = createTestDatabase();

    const mockRssAdapter = {
      fetchNews: async () => [
        {
          title: 'News A',
          url: 'https://a.test',
          source: 'Src A',
          publishedAt: '2026-11-02T08:00:00Z',
          contentSnippet: 'Text'
        },
        {
          title: 'News B',
          url: 'https://b.test',
          source: 'Src B',
          publishedAt: '2026-11-02T09:00:00Z',
          contentSnippet: 'Text'
        },
        {
          title: 'News C',
          url: 'https://c.test',
          source: 'Src C',
          publishedAt: '2026-11-02T10:00:00Z',
          contentSnippet: 'Text'
        }
      ]
    };

    const mockLlmAdapter = {
      analyzeNewsItem: async (item) => ({
        summary: `Summary of ${item.title}`,
        commentary: `Commentary on ${item.title}`,
        analysisMode: 'HEURISTIC_LOCAL'
      })
    };

    const briefingService = new BriefingService({
      db,
      rssAdapter: mockRssAdapter,
      llmAdapter: mockLlmAdapter
    });

    server = createApp({ db, briefingService });
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

  describe('GET /api/dashboard/summary', () => {
    it('should return aggregated morning kickoff summary', async () => {
      // Create a meeting
      await fetch(`${baseUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Morning Briefing Meeting',
          startTime: '09:00',
          endTime: '10:00',
          date: '2026-11-02'
        })
      });

      // Create a task
      await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'High priority vulnerability patch',
          priority: 'Alta',
          isFocus: true,
          date: '2026-11-02'
        })
      });

      const res = await fetch(`${baseUrl}/api/dashboard/summary?date=2026-11-02`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('application/json'), true);

      const summary = await res.json();
      assert.equal(summary.date, '2026-11-02');
      assert.equal(summary.briefingCount, 3);
      assert.equal(summary.mode, 'HEURISTIC_LOCAL');
      assert.equal(summary.meetingStats.total, 1);
      assert.equal(summary.meetingStats.conflictsCount, 0);
      assert.ok(summary.meetingStats.nextMeeting);
      assert.equal(summary.taskStats.total, 1);
      assert.equal(summary.taskStats.focusCount, 1);
    });
  });

  describe('Static File Serving & Security', () => {
    it('should serve index.html on root GET /', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('text/html'), true);
      const text = await res.text();
      assert.ok(text.includes('Samabox'));
    });

    it('should serve CSS and JS static assets with correct MIME types', async () => {
      const cssRes = await fetch(`${baseUrl}/css/styles.css`);
      assert.equal(cssRes.status, 200);
      assert.equal(cssRes.headers.get('content-type')?.includes('text/css'), true);

      const jsRes = await fetch(`${baseUrl}/js/app.js`);
      assert.equal(jsRes.status, 200);
      assert.equal(jsRes.headers.get('content-type')?.includes('javascript'), true);
    });

    it('should prevent path traversal attacks (e.g. /../package.json)', async () => {
      const res = await fetch(`${baseUrl}/../package.json`);
      // Should reject with 403 or 404, never 200 exposing package.json
      assert.ok(res.status === 403 || res.status === 404);
    });

    it('should return 404 for non-existent static assets', async () => {
      const res = await fetch(`${baseUrl}/images/non-existent-asset.png`);
      assert.equal(res.status, 404);
    });
  });
});
