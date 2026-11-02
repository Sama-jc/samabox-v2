import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBriefingItem,
  VALID_ANALYSIS_MODES
} from '../../src/domain/briefing-item.js';
import { ValidationError } from '../../src/domain/meeting.js';

describe('BriefingItem Domain Model', () => {
  it('should validate and normalize a complete BriefingItem', () => {
    const raw = {
      title: 'Critical Zero-Day in VPN Appliance',
      url: 'https://thehackernews.com/2026/11/vpn-zero-day.html',
      source: 'The Hacker News',
      publishedAt: '2026-11-02T08:00:00Z',
      summary: 'A new remote code execution zero-day flaw was discovered in enterprise VPNs.',
      commentary: 'Immediate patching required; verify perimeter logs for unexpected outbound traffic.',
      analysisMode: 'LLM_CLOUD',
      briefingDate: '2026-11-02'
    };

    const validated = validateBriefingItem(raw);
    assert.equal(validated.title, 'Critical Zero-Day in VPN Appliance');
    assert.equal(validated.url, 'https://thehackernews.com/2026/11/vpn-zero-day.html');
    assert.equal(validated.source, 'The Hacker News');
    assert.equal(validated.publishedAt, '2026-11-02T08:00:00Z');
    assert.equal(validated.summary, 'A new remote code execution zero-day flaw was discovered in enterprise VPNs.');
    assert.equal(validated.commentary, 'Immediate patching required; verify perimeter logs for unexpected outbound traffic.');
    assert.equal(validated.analysisMode, 'LLM_CLOUD');
    assert.equal(validated.briefingDate, '2026-11-02');
  });

  it('should default briefingDate to today if not provided', () => {
    const raw = {
      title: 'Supply Chain Advisory',
      url: 'https://cisa.gov/alerts/supply-chain-2026',
      source: 'CISA Alerts',
      publishedAt: '2026-11-02T09:00:00Z',
      summary: 'Advisory on npm packages injecting crypto miners.',
      commentary: 'Enforce lockfiles and dependency scanning in CI/CD.',
      analysisMode: 'HEURISTIC_LOCAL'
    };

    const validated = validateBriefingItem(raw);
    assert.ok(validated.briefingDate);
    assert.match(validated.briefingDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('should throw ValidationError if required fields are missing or empty', () => {
    const base = {
      title: 'Title',
      url: 'https://example.com/sec',
      source: 'Source',
      publishedAt: '2026-11-02T10:00:00Z',
      summary: 'Summary',
      commentary: 'Commentary',
      analysisMode: 'HEURISTIC_LOCAL'
    };

    // Missing title
    assert.throws(
      () => validateBriefingItem({ ...base, title: '  ' }),
      (err) => err instanceof ValidationError && err.message.includes('title')
    );

    // Missing url
    assert.throws(
      () => validateBriefingItem({ ...base, url: '' }),
      (err) => err instanceof ValidationError && err.message.includes('url')
    );

    // Missing source
    assert.throws(
      () => validateBriefingItem({ ...base, source: '   ' }),
      (err) => err instanceof ValidationError && err.message.includes('source')
    );

    // Missing summary (Resumen a leer)
    assert.throws(
      () => validateBriefingItem({ ...base, summary: '' }),
      (err) => err instanceof ValidationError && err.message.includes('summary')
    );

    // Missing commentary (Comentarios al respecto)
    assert.throws(
      () => validateBriefingItem({ ...base, commentary: '   ' }),
      (err) => err instanceof ValidationError && err.message.includes('commentary')
    );
  });

  it('should throw ValidationError for invalid analysisMode', () => {
    assert.throws(
      () => validateBriefingItem({
        title: 'Title',
        url: 'https://example.com',
        source: 'Src',
        publishedAt: '2026-11-02T10:00:00Z',
        summary: 'Sum',
        commentary: 'Com',
        analysisMode: 'UNKNOWN_MODE'
      }),
      (err) => err instanceof ValidationError && err.message.includes('analysisMode')
    );
  });
});
