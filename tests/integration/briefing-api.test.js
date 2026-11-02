import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from '../helpers/test-db.js';
import { BriefingService } from '../../src/services/briefing-service.js';

describe('Briefing API Integration Tests', () => {
  let server;
  let baseUrl;
  let db;

  const mockNews = [
    {
      title: 'Critical Gateway Zero-Day',
      url: 'https://sec.test/gw-0day',
      source: 'CISA Alerts',
      publishedAt: '2026-11-02T08:00:00Z',
      contentSnippet: 'Active RCE vulnerability reported.'
    },
    {
      title: 'Ransomware Wave Hits Logistics',
      url: 'https://sec.test/ransom-logistics',
      source: 'BleepingComputer',
      publishedAt: '2026-11-02T09:00:00Z',
      contentSnippet: 'Extortion tactics observed.'
    },
    {
      title: 'npm Package Backdoor Detected',
      url: 'https://sec.test/npm-backdoor',
      source: 'The Hacker News',
      publishedAt: '2026-11-02T10:00:00Z',
      contentSnippet: 'Supply chain compromise in core packages.'
    }
  ];

  before(async () => {
    db = createTestDatabase();

    const mockRssAdapter = {
      fetchNews: async () => mockNews
    };

    const mockLlmAdapter = {
      analyzeNewsItem: async (item) => ({
        summary: `Resumen ejecutivo de prueba para: ${item.title}`,
        commentary: `Comentario táctico de prueba para: ${item.title}`,
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

  describe('GET /api/briefing', () => {
    it('should return 200 with at least 3 news items containing summary and commentary', async () => {
      const res = await fetch(`${baseUrl}/api/briefing?date=2026-11-02`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('application/json'), true);

      const data = await res.json();
      assert.equal(data.date, '2026-11-02');
      assert.equal(data.mode, 'HEURISTIC_LOCAL');
      assert.ok(Array.isArray(data.items));
      assert.ok(data.items.length >= 3);

      for (const item of data.items) {
        assert.ok(item.id);
        assert.ok(item.title);
        assert.ok(item.url);
        assert.ok(item.source);
        assert.ok(item.summary.includes('Resumen ejecutivo de prueba'));
        assert.ok(item.commentary.includes('Comentario táctico de prueba'));
        assert.equal(item.analysisMode, 'HEURISTIC_LOCAL');
        assert.equal(item.briefingDate, '2026-11-02');
      }
    });

    it('should return cached items on subsequent GET calls', async () => {
      const res = await fetch(`${baseUrl}/api/briefing?date=2026-11-02`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.items.length, 3);
    });
  });

  describe('POST /api/briefing/refresh', () => {
    it('should refresh briefing and return updated items', async () => {
      const res = await fetch(`${baseUrl}/api/briefing/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-11-02' })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.date, '2026-11-02');
      assert.ok(data.items.length >= 3);
    });
  });
});
