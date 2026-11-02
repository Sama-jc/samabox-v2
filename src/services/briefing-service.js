import crypto from 'node:crypto';
import { validateBriefingItem } from '../domain/briefing-item.js';
import { getTodayDateString } from '../domain/meeting.js';
import { RSSAdapter } from '../adapters/rss-adapter.js';
import { LLMAdapter } from '../adapters/llm-adapter.js';

function mapRowToBriefingItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: row.published_at,
    summary: row.summary,
    commentary: row.commentary,
    analysisMode: row.analysis_mode,
    briefingDate: row.briefing_date,
    createdAt: row.created_at
  };
}

export class BriefingService {
  constructor({
    db,
    rssAdapter = new RSSAdapter(),
    llmAdapter = new LLMAdapter()
  } = {}) {
    this.db = db;
    this.rssAdapter = rssAdapter;
    this.llmAdapter = llmAdapter;
  }

  async getBriefingByDate(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();

    const stmt = this.db.prepare('SELECT * FROM briefing_items WHERE briefing_date = ?');
    const rows = stmt.all(queryDate);

    if (rows.length >= 3) {
      const items = rows.map(mapRowToBriefingItem);
      const mode = items.some((item) => item.analysisMode === 'LLM_CLOUD')
        ? 'LLM_CLOUD'
        : 'HEURISTIC_LOCAL';
      return {
        date: queryDate,
        mode,
        items
      };
    }

    return this.refreshBriefing(queryDate);
  }

  async refreshBriefing(date) {
    const queryDate = date ? String(date).trim() : getTodayDateString();

    // Invalidate cached items for this date
    this.db.prepare('DELETE FROM briefing_items WHERE briefing_date = ?').run(queryDate);

    // Fetch at least 3 news items from RSS / fallback catalog
    const rawNews = await this.rssAdapter.fetchNews();

    const insertStmt = this.db.prepare(`
      INSERT INTO briefing_items (id, title, url, source, published_at, summary, commentary, analysis_mode, briefing_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const items = [];
    const now = new Date().toISOString();

    for (const raw of rawNews) {
      const analysis = await this.llmAdapter.analyzeNewsItem(raw);

      const validated = validateBriefingItem({
        title: raw.title,
        url: raw.url,
        source: raw.source,
        publishedAt: raw.publishedAt,
        summary: analysis.summary,
        commentary: analysis.commentary,
        analysisMode: analysis.analysisMode,
        briefingDate: queryDate
      });

      const id = crypto.randomUUID();

      insertStmt.run(
        id,
        validated.title,
        validated.url,
        validated.source,
        validated.publishedAt,
        validated.summary,
        validated.commentary,
        validated.analysisMode,
        validated.briefingDate,
        now
      );

      items.push({
        id,
        ...validated,
        createdAt: now
      });
    }

    const mode = items.some((item) => item.analysisMode === 'LLM_CLOUD')
      ? 'LLM_CLOUD'
      : 'HEURISTIC_LOCAL';

    return {
      date: queryDate,
      mode,
      items
    };
  }
}
