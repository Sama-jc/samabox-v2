import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  sanitizeUrl,
  renderBriefingView
} from '../../src/public/js/components/briefing-view.js';
import { renderAgendaView } from '../../src/public/js/components/agenda-view.js';
import { renderTaskView } from '../../src/public/js/components/task-view.js';
import { renderSummaryView } from '../../src/public/js/components/summary-view.js';
import { renderCalendarView } from '../../src/public/js/components/calendar-view.js';
import { renderCalendarModal } from '../../src/public/js/components/calendar-modal.js';
import { resolveRoute, Router } from '../../src/public/js/router.js';

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

  describe('Hash Router (resolveRoute)', () => {
    it('should resolve default route "summary" for empty, root or summary hashes', () => {
      assert.equal(resolveRoute(''), 'summary');
      assert.equal(resolveRoute('#'), 'summary');
      assert.equal(resolveRoute('#/'), 'summary');
      assert.equal(resolveRoute('#/summary'), 'summary');
      assert.equal(resolveRoute('/summary'), 'summary');
    });

    it('should resolve valid feature routes: calendar, tasks, news', () => {
      assert.equal(resolveRoute('#/calendar'), 'calendar');
      assert.equal(resolveRoute('#/tasks'), 'tasks');
      assert.equal(resolveRoute('#/news'), 'news');
    });

    it('should fallback to default route "summary" for unknown routes', () => {
      assert.equal(resolveRoute('#/unknown-route'), 'summary');
      assert.equal(resolveRoute('#/foo/bar'), 'summary');
    });

    it('should dispatch route handlers and update active route upon hash change', () => {
      const origWindow = globalThis.window;
      const origDoc = globalThis.document;
      try {
        let routedAction = null;
        let notifiedRoute = null;

        const navLinks = [
          {
            getAttribute: (attr) => (attr === 'data-route' ? 'summary' : null),
            classList: {
              add: () => {},
              remove: () => {}
            },
            setAttribute: () => {},
            removeAttribute: () => {}
          },
          {
            getAttribute: (attr) => (attr === 'data-route' ? 'calendar' : null),
            classList: {
              add: () => {},
              remove: () => {}
            },
            setAttribute: () => {},
            removeAttribute: () => {}
          }
        ];

        globalThis.window = {
          location: { hash: '#/calendar' },
          addEventListener: () => {},
          removeEventListener: () => {}
        };

        globalThis.document = {
          querySelectorAll: () => navLinks
        };

        const router = new Router({
          routes: {
            summary: () => { routedAction = 'summary'; },
            calendar: () => { routedAction = 'calendar'; }
          },
          onRouteChange: (r) => { notifiedRoute = r; }
        });

        router._handleHashChange();

        assert.equal(router.getCurrentRoute(), 'calendar');
        assert.equal(routedAction, 'calendar');
        assert.equal(notifiedRoute, 'calendar');

        router.navigate('summary');
        assert.equal(globalThis.window.location.hash, '#/summary');
      } finally {
        globalThis.window = origWindow;
        globalThis.document = origDoc;
      }
    });
  });

  describe('renderSummaryView (Executive Landing View)', () => {
    const mockSummary = {
      date: '2026-11-02',
      newsLimit: 3,
      briefingCount: 5,
      mode: 'LLM_CLOUD',
      meetingStats: {
        total: 3,
        conflictsCount: 2,
        nextMeeting: {
          title: 'Emergency SecOps Call',
          startTime: '10:00',
          endTime: '11:00'
        }
      },
      taskStats: {
        total: 5,
        completed: 2,
        pending: 2,
        inProgress: 1,
        focusCount: 1,
        focusTask: {
          title: 'Patch Critical CVE',
          priority: 'Alta'
        },
        completionRate: 40
      },
      topNews: [
        {
          id: 'n1',
          title: 'Ransomware Outbreak',
          source: 'BleepingComputer',
          summary: 'Critical alert regarding ransomware.',
          commentary: 'Isolate affected network segments immediately.'
        },
        {
          id: 'n2',
          title: 'Zero-Day in Chrome',
          source: 'The Hacker News',
          summary: 'Exploit detected in wild.',
          commentary: 'Update browsers across fleet.'
        }
      ]
    };

    it('should render all 3 executive widgets: News, Calendar, Tasks', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('summary-widget-news'), 'Should contain News widget');
      assert.ok(html.includes('summary-widget-calendar'), 'Should contain Calendar widget');
      assert.ok(html.includes('summary-widget-tasks'), 'Should contain Tasks widget');
    });

    it('should render news limit selector with 1, 3, 5 options and select configured newsLimit', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('select-news-limit'));
      assert.ok(html.includes('value="1"'));
      assert.ok(html.includes('value="3" selected'));
      assert.ok(html.includes('value="5"'));
    });

    it('should render executive topNews cards', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('Ransomware Outbreak'));
      assert.ok(html.includes('BleepingComputer'));
      assert.ok(html.includes('Zero-Day in Chrome'));
    });

    it('should include CTA buttons directing to respective SPA routes (#/news, #/calendar, #/tasks)', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('href="#/news"'), 'Should contain CTA to #/news');
      assert.ok(html.includes('href="#/calendar"'), 'Should contain CTA to #/calendar');
      assert.ok(html.includes('href="#/tasks"'), 'Should contain CTA to #/tasks');
    });

    it('should display collision warning banner if meeting conflicts exist', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('alert-conflict') || html.includes('conflict-warning'));
      assert.ok(html.includes('2') || html.includes('Solapamiento'));
    });

    it('should render tasks progress metrics and Daily Focus highlight', () => {
      const html = renderSummaryView(mockSummary);
      assert.ok(html.includes('40%') || html.includes('2 de 5'));
      assert.ok(html.includes('Patch Critical CVE'));
    });
  });

  describe('renderCalendarView (Dedicated Calendar Screen)', () => {
    const mockUnifiedData = {
      date: '2026-11-02',
      meetings: [
        {
          id: 'm1',
          title: 'Local Standup',
          startTime: '09:00',
          endTime: '10:00',
          hasConflict: true,
          conflictingIds: ['m2'],
          sourceId: null,
          sourceName: 'Local',
          sourceColor: '#388bfd',
          isExternal: false,
          location: 'Sala 1',
          notes: 'Daily sync'
        },
        {
          id: 'm2',
          title: 'Google SecOps Incident Call',
          startTime: '09:30',
          endTime: '10:30',
          hasConflict: true,
          conflictingIds: ['m1'],
          sourceId: 'src-google',
          sourceName: 'Google Calendar SecOps',
          sourceColor: '#ea4335',
          isExternal: true,
          location: 'Meet https://meet.google.com/xyz',
          notes: 'External incident response'
        }
      ],
      allDayEvents: [
        {
          id: 'rem-1',
          title: 'TLS Certificate Expiration Reminder',
          startTime: '00:00',
          endTime: '23:59',
          allDay: 1,
          entryType: 'reminder',
          sourceId: null,
          sourceName: 'Local',
          sourceColor: '#2ea043',
          isExternal: false
        }
      ],
      projectedTasks: [
        {
          id: 'task-101',
          title: 'Patch External Firewall Rules',
          priority: 'Alta',
          status: 'Pendiente',
          isFocus: true,
          date: '2026-11-02'
        },
        {
          id: 'task-102',
          title: 'Update SIEM Correlation Rules',
          priority: 'Media',
          status: 'Completada',
          isFocus: false,
          date: '2026-11-02'
        }
      ],
      calendarSources: [
        { id: 'src-google', name: 'Google Calendar SecOps', color: '#ea4335', is_enabled: 1 }
      ]
    };

    it('should render date controls and manage accounts CTA button', () => {
      const html = renderCalendarView(mockUnifiedData);
      assert.ok(html.includes('btn-manage-calendars') || html.includes('Gestionar Cuentas'), 'Must have manage calendars button');
      assert.ok(html.includes('2026-11-02'), 'Must display active date');
      assert.ok(html.includes('btn-calendar-prev') || html.includes('btn-date-prev'));
      assert.ok(html.includes('btn-calendar-next') || html.includes('btn-date-next'));
    });

    it('should render all-day reminders lane with color badge', () => {
      const html = renderCalendarView(mockUnifiedData);
      assert.ok(html.includes('calendar-all-day-lane') || html.includes('reminders-lane'));
      assert.ok(html.includes('TLS Certificate Expiration Reminder'));
      assert.ok(html.includes('Local'));
    });

    it('should render timed meetings timeline with multi-source colors and collision indicators', () => {
      const html = renderCalendarView(mockUnifiedData);
      assert.ok(html.includes('Local Standup'));
      assert.ok(html.includes('Google SecOps Incident Call'));
      assert.ok(html.includes('#ea4335') || html.includes('style="--source-color: #ea4335"'));
      assert.ok(html.includes('Google Calendar SecOps'));
      assert.ok(html.includes('Conflicto') || html.includes('has-conflict'), 'Must indicate conflict for overlapping meetings');
      // Local meeting should have delete button, external meeting should be marked readonly
      assert.ok(html.includes('btn-delete-meeting'));
      assert.ok(html.includes('badge-external') || html.includes('Solo lectura') || html.includes('is-external'));
    });

    it('should render integrated tasks projection lane for the selected date with status switcher', () => {
      const html = renderCalendarView(mockUnifiedData);
      assert.ok(html.includes('calendar-projected-tasks') || html.includes('tasks-projection-section'));
      assert.ok(html.includes('Patch External Firewall Rules'));
      assert.ok(html.includes('DAILY FOCUS') || html.includes('Daily Focus'));
      assert.ok(html.includes('priority-Alta'));
      assert.ok(html.includes('select-projected-task-status') || html.includes('select-status'));
      assert.ok(html.includes('Update SIEM Correlation Rules'));
    });

    it('should display empty states gracefully when no meetings or tasks exist', () => {
      const html = renderCalendarView({
        date: '2026-11-03',
        meetings: [],
        allDayEvents: [],
        projectedTasks: [],
        calendarSources: []
      });
      assert.ok(html.includes('empty-state') || html.includes('No hay reuniones'));
    });
  });

  describe('renderCalendarModal (Calendar Accounts Manager)', () => {
    const mockSources = [
      {
        id: 's1',
        name: 'Work Exchange',
        color: '#0969da',
        type: 'subscription',
        url: 'https://work.example.com/calendar.ics',
        is_enabled: 1,
        sync_status: 'success',
        last_synced_at: '2026-11-02T08:00:00Z',
        sync_error: null
      },
      {
        id: 's2',
        name: 'Personal Offline',
        color: '#8250df',
        type: 'manual_import',
        url: null,
        is_enabled: 0,
        sync_status: 'idle',
        last_synced_at: null,
        sync_error: null
      }
    ];

    it('should render modal dialog structure with close button', () => {
      const html = renderCalendarModal(mockSources);
      assert.ok(html.includes('calendar-modal-container') || html.includes('modal-calendar'));
      assert.ok(html.includes('btn-close-modal'));
    });

    it('should render iCal URL subscription form with name, url and color input', () => {
      const html = renderCalendarModal(mockSources);
      assert.ok(html.includes('form-add-subscription') || html.includes('form-subscription'));
      assert.ok(html.includes('input-sub-name') || html.includes('sub-name'));
      assert.ok(html.includes('input-sub-url') || html.includes('sub-url'));
      assert.ok(html.includes('input-sub-color') || html.includes('sub-color'));
    });

    it('should render offline .ics file upload form with file input and name', () => {
      const html = renderCalendarModal(mockSources);
      assert.ok(html.includes('form-import-ics') || html.includes('form-upload-ics'));
      assert.ok(html.includes('type="file"') && (html.includes('.ics') || html.includes('text/calendar')));
    });

    it('should render list of connected sources with color swatch, toggle switch, sync and delete buttons', () => {
      const html = renderCalendarModal(mockSources);
      assert.ok(html.includes('Work Exchange'));
      assert.ok(html.includes('#0969da'));
      assert.ok(html.includes('Personal Offline'));
      assert.ok(html.includes('toggle-source-enabled') || html.includes('btn-toggle-source'));
      assert.ok(html.includes('btn-sync-source') || html.includes('btn-sync'));
      assert.ok(html.includes('btn-delete-source') || html.includes('btn-delete'));
    });
  });
});
