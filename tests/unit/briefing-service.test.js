import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../helpers/test-db.js';
import { BriefingService } from '../../src/services/briefing-service.js';

describe('BriefingService', () => {
  let db;
  let mockRssAdapter;
  let mockLlmAdapter;
  let service;

  const sampleNews = [
    {
      title: 'Zero-day in Firewall Appliance',
      url: 'https://sec.example.com/fw-zero-day',
      source: 'Security Alert',
      publishedAt: '2026-11-02T08:00:00Z',
      contentSnippet: 'Active RCE vulnerability reported.'
    },
    {
      title: 'Ransomware Outbreak in Logistics',
      url: 'https://sec.example.com/ransomware',
      source: 'Bleeping',
      publishedAt: '2026-11-02T09:00:00Z',
      contentSnippet: 'Double extortion variant.'
    },
    {
      title: 'Supply Chain Compromise in PyPI',
      url: 'https://sec.example.com/pypi-backdoor',
      source: 'CISA',
      publishedAt: '2026-11-02T10:00:00Z',
      contentSnippet: 'Malicious libraries uploaded.'
    }
  ];

  beforeEach(() => {
    db = createTestDatabase();

    let rssCalls = 0;
    mockRssAdapter = {
      getRssCalls: () => rssCalls,
      fetchNews: async () => {
        rssCalls++;
        return sampleNews;
      }
    };

    mockLlmAdapter = {
      analyzeNewsItem: async (item) => ({
        summary: `Resumen de: ${item.title}`,
        commentary: `Comentario táctico de: ${item.title}`,
        analysisMode: 'HEURISTIC_LOCAL'
      })
    };

    service = new BriefingService({
      db,
      rssAdapter: mockRssAdapter,
      llmAdapter: mockLlmAdapter
    });
  });

  afterEach(() => {
    db.close();
  });

  it('should fetch news, analyze, persist to SQLite, and return at least 3 items when cache is empty', async () => {
    const briefing = await service.getBriefingByDate('2026-11-02');
    assert.equal(briefing.date, '2026-11-02');
    assert.equal(briefing.mode, 'HEURISTIC_LOCAL');
    assert.equal(briefing.items.length, 3);
    assert.equal(mockRssAdapter.getRssCalls(), 1);

    // Verify each item has required structure
    for (const item of briefing.items) {
      assert.ok(item.id);
      assert.ok(item.title);
      assert.ok(item.url);
      assert.ok(item.source);
      assert.ok(item.summary.startsWith('Resumen de:'));
      assert.ok(item.commentary.startsWith('Comentario táctico de:'));
      assert.equal(item.analysisMode, 'HEURISTIC_LOCAL');
      assert.equal(item.briefingDate, '2026-11-02');
    }

    // Verify persisted in DB
    const count = db.prepare('SELECT COUNT(*) as c FROM briefing_items WHERE briefing_date = ?').get('2026-11-02');
    assert.equal(count.c, 3);
  });

  it('should return cached items from SQLite on subsequent calls without re-fetching RSS', async () => {
    // First call populates cache
    await service.getBriefingByDate('2026-11-02');
    assert.equal(mockRssAdapter.getRssCalls(), 1);

    // Second call must use cache
    const cached = await service.getBriefingByDate('2026-11-02');
    assert.equal(cached.items.length, 3);
    assert.equal(mockRssAdapter.getRssCalls(), 1, 'Should NOT call RSS again when cache is present');
  });

  it('should invalidate cache and reprocess on refreshBriefing', async () => {
    // Initial populate
    await service.getBriefingByDate('2026-11-02');
    assert.equal(mockRssAdapter.getRssCalls(), 1);

    // Refresh
    const refreshed = await service.refreshBriefing('2026-11-02');
    assert.equal(refreshed.items.length, 3);
    assert.equal(mockRssAdapter.getRssCalls(), 2, 'Should re-fetch RSS on refresh');
  });

  it('should reflect LLM_CLOUD mode if items were analyzed via cloud LLM', async () => {
    mockLlmAdapter.analyzeNewsItem = async (item) => ({
      summary: `AI Summary of ${item.title}`,
      commentary: `AI Commentary on ${item.title}`,
      analysisMode: 'LLM_CLOUD'
    });

    const briefing = await service.getBriefingByDate('2026-11-03');
    assert.equal(briefing.mode, 'LLM_CLOUD');
    assert.equal(briefing.items[0].analysisMode, 'LLM_CLOUD');
  });
});
