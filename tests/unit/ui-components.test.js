import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  sanitizeUrl,
  renderBriefingView
} from '../../src/public/js/components/briefing-view.js';
import { renderAgendaView } from '../../src/public/js/components/agenda-view.js';
import { renderTaskView } from '../../src/public/js/components/task-view.js';

describe('Frontend UI Components & Security Sanitization', () => {
  describe('Security Sanitizers (escapeHtml & sanitizeUrl)', () => {
    it('should escape dangerous HTML characters to prevent XSS', () => {
      const malicious = '<script>alert("XSS")</script>&foo=\'bar\'';
      const escaped = escapeHtml(malicious);
      assert.ok(!escaped.includes('<script>'));
      assert.ok(escaped.includes('&lt;script&gt;'));
      assert.ok(escaped.includes('&amp;foo=&#39;bar&#39;'));
    });

    it('should sanitize javascript: or invalid URLs', () => {
      assert.equal(sanitizeUrl('javascript:alert(1)'), '#');
      assert.equal(sanitizeUrl('data:text/html,<script>'), '#');
      assert.equal(sanitizeUrl('https://thehackernews.com/article'), 'https://thehackernews.com/article');
      assert.equal(sanitizeUrl('http://cisa.gov/alert'), 'http://cisa.gov/alert');
      assert.equal(sanitizeUrl(''), '#');
      assert.equal(sanitizeUrl(null), '#');
    });
  });

  describe('renderBriefingView', () => {
    it('should render empty state message when list is empty', () => {
      const html = renderBriefingView({ items: [] });
      assert.ok(html.includes('empty-state'));
    });

    it('should render cards containing Resumen a leer and Comentarios al respecto', () => {
      const briefing = {
        items: [
          {
            id: 'b1',
            title: 'Critical CVE-2026-001',
            url: 'https://sec.example.com/cve-2026-001',
            source: 'Security Alert',
            publishedAt: '2026-11-02T10:00:00Z',
            summary: 'Executive synthesis of the vulnerability.',
            commentary: 'Tactical impact and defensive guidance.',
            analysisMode: 'LLM_CLOUD',
            briefingDate: '2026-11-02'
          }
        ]
      };

      const html = renderBriefingView(briefing);
      assert.ok(html.includes('Critical CVE-2026-001'));
      assert.ok(html.includes('Resumen a leer'));
      assert.ok(html.includes('Executive synthesis of the vulnerability.'));
      assert.ok(html.includes('Comentarios al respecto'));
      assert.ok(html.includes('Tactical impact and defensive guidance.'));
      assert.ok(html.includes('Cloud LLM'));
      assert.ok(html.includes('rel="noopener noreferrer"'));
    });
  });

  describe('renderAgendaView', () => {
    it('should render empty state when no meetings exist', () => {
      const html = renderAgendaView([]);
      assert.ok(html.includes('empty-state'));
    });

    it('should render meeting cards and highlight conflict when hasConflict is true', () => {
      const meetings = [
        {
          id: 'm1',
          title: 'Architecture Sync',
          startTime: '10:00',
          endTime: '11:00',
          hasConflict: true,
          location: 'Room A'
        },
        {
          id: 'm2',
          title: 'Review',
          startTime: '14:00',
          endTime: '15:00',
          hasConflict: false
        }
      ];

      const html = renderAgendaView(meetings);
      assert.ok(html.includes('Architecture Sync'));
      assert.ok(html.includes('has-conflict'));
      assert.ok(html.includes('Conflicto de horario'));
      assert.ok(html.includes('btn-delete-meeting'));
    });
  });

  describe('renderTaskView', () => {
    it('should render empty state when no tasks exist', () => {
      const html = renderTaskView([]);
      assert.ok(html.includes('empty-state'));
    });

    it('should render task card with Daily Focus highlight and priority badge', () => {
      const tasks = [
        {
          id: 't1',
          title: 'Patch perimeter VPN',
          priority: 'Alta',
          status: 'Pendiente',
          isFocus: true
        },
        {
          id: 't2',
          title: 'Update documentation',
          priority: 'Baja',
          status: 'Completada',
          isFocus: false
        }
      ];

      const html = renderTaskView(tasks, 'Todas');
      assert.ok(html.includes('is-focus'));
      assert.ok(html.includes('DAILY FOCUS'));
      assert.ok(html.includes('priority-Alta'));
      assert.ok(html.includes('btn-toggle-focus'));
      assert.ok(html.includes('btn-delete-task'));

      // Filter: Focus only
      const focusHtml = renderTaskView(tasks, 'Focus');
      assert.ok(focusHtml.includes('Patch perimeter VPN'));
      assert.ok(!focusHtml.includes('Update documentation'));
    });
  });
});
