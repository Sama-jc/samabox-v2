import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgendaService, NotFoundError } from './services/agenda-service.js';
import { TaskService } from './services/task-service.js';
import { BriefingService } from './services/briefing-service.js';
import { DashboardService } from './services/dashboard-service.js';
import { CalendarSourceService } from './services/calendar-source-service.js';
import { UnifiedCalendarService } from './services/unified-calendar-service.js';
import { ValidationError } from './domain/meeting.js';
import { SSRFError } from './domain/ssrf-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPublicDir = path.resolve(__dirname, 'public');

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

export const COMMON_HEADERS = {
  ...CORS_HEADERS,
  ...SECURITY_HEADERS
};

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large. Maximum size allowed is 64KB.') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

export function serveStaticFile(req, res, publicDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const targetRel = decoded === '/' ? '/index.html' : decoded;
  const safePath = path.resolve(publicDir, '.' + targetRel);

  // Prevent directory traversal attacks
  if (!safePath.startsWith(publicDir)) {
    res.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
      ...COMMON_HEADERS
    });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return true;
  }

  if (fs.existsSync(safePath)) {
    const stat = fs.statSync(safePath);
    if (stat.isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        ...COMMON_HEADERS
      });
      fs.createReadStream(safePath).pipe(res);
      return true;
    }
  }

  return false;
}

export function sendJson(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...COMMON_HEADERS
  });
  res.end(json);
}

export function sendNoContent(res) {
  res.writeHead(204, COMMON_HEADERS);
  res.end();
}

export async function readJsonBody(req, maxSizeBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxSizeBytes) {
        reject(new PayloadTooLargeError());
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch {
        reject(new ValidationError('Invalid JSON body'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export function createRequestHandler({
  db,
  agendaService,
  taskService,
  briefingService,
  dashboardService,
  calendarSourceService,
  unifiedCalendarService,
  publicDir = defaultPublicDir,
  config = {}
}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      const method = req.method.toUpperCase();

      if (method === 'OPTIONS') {
        res.writeHead(204, COMMON_HEADERS);
        return res.end();
      }

      // Health Check Route
      if (method === 'GET' && pathname === '/api/health') {
        try {
          if (db) {
            db.prepare('SELECT 1 as alive').get();
          }
          const mode = briefingService?.analysisMode || briefingService?.mode || (process.env.LLM_API_KEY ? 'LLM_CLOUD' : 'HEURISTIC_LOCAL');
          return sendJson(res, 200, {
            status: 'ok',
            database: 'connected',
            mode,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          return sendJson(res, 503, {
            status: 'error',
            database: 'disconnected',
            error: err.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Meeting Routes
      const meetingIdMatch = pathname.match(/^\/api\/meetings\/([^/]+)$/);

      // GET /api/meetings
      if (method === 'GET' && pathname === '/api/meetings') {
        const date = url.searchParams.get('date') || undefined;
        const meetings = agendaService.getMeetingsByDate(date);
        return sendJson(res, 200, meetings);
      }

      // POST /api/meetings
      if (method === 'POST' && pathname === '/api/meetings') {
        const body = await readJsonBody(req);
        const meeting = agendaService.createMeeting(body);
        return sendJson(res, 201, { meeting });
      }

      // PUT /api/meetings/:id
      if (method === 'PUT' && meetingIdMatch) {
        const id = decodeURIComponent(meetingIdMatch[1]);
        const body = await readJsonBody(req);
        const meeting = agendaService.updateMeeting(id, body);
        return sendJson(res, 200, { meeting });
      }

      // DELETE /api/meetings/:id
      if (method === 'DELETE' && meetingIdMatch) {
        const id = decodeURIComponent(meetingIdMatch[1]);
        agendaService.deleteMeeting(id);
        return sendNoContent(res);
      }

      // Calendar Sources Routes
      const calendarSyncMatch = pathname.match(/^\/api\/calendars\/([^/]+)\/sync$/);
      const calendarIdMatch = pathname.match(/^\/api\/calendars\/([^/]+)$/);

      // GET /api/calendars
      if (method === 'GET' && pathname === '/api/calendars' && calendarSourceService) {
        const sources = calendarSourceService.getSources();
        return sendJson(res, 200, sources);
      }

      // POST /api/calendars
      if (method === 'POST' && pathname === '/api/calendars' && calendarSourceService) {
        const body = await readJsonBody(req);
        const calendarSource = calendarSourceService.createSource(body);
        return sendJson(res, 201, { calendarSource });
      }

      // POST /api/calendars/import
      if (method === 'POST' && pathname === '/api/calendars/import' && calendarSourceService) {
        const body = await readJsonBody(req, 5 * 1024 * 1024);
        const result = calendarSourceService.importManualICS(body);
        return sendJson(res, 201, result);
      }

      // POST /api/calendars/:id/sync
      if (method === 'POST' && calendarSyncMatch && calendarSourceService) {
        const id = decodeURIComponent(calendarSyncMatch[1]);
        const result = await calendarSourceService.syncSource(id);
        return sendJson(res, 200, result);
      }

      // GET /api/calendars/:id
      if (method === 'GET' && calendarIdMatch && calendarSourceService) {
        const id = decodeURIComponent(calendarIdMatch[1]);
        const calendarSource = calendarSourceService.getSourceById(id);
        if (!calendarSource) {
          throw new NotFoundError(`Calendar source "${id}" not found.`);
        }
        return sendJson(res, 200, { calendarSource });
      }

      // PATCH /api/calendars/:id
      if (method === 'PATCH' && calendarIdMatch && calendarSourceService) {
        const id = decodeURIComponent(calendarIdMatch[1]);
        const body = await readJsonBody(req);
        const calendarSource = calendarSourceService.updateSource(id, body);
        return sendJson(res, 200, { calendarSource });
      }

      // DELETE /api/calendars/:id
      if (method === 'DELETE' && calendarIdMatch && calendarSourceService) {
        const id = decodeURIComponent(calendarIdMatch[1]);
        calendarSourceService.deleteSource(id);
        return sendNoContent(res);
      }

      // Unified Calendar Route: GET /api/calendar/unified?date=YYYY-MM-DD
      if (method === 'GET' && pathname === '/api/calendar/unified' && unifiedCalendarService) {
        const date = url.searchParams.get('date') || undefined;
        const unified = unifiedCalendarService.getUnifiedCalendar(date);
        return sendJson(res, 200, unified);
      }

      // Task Routes
      const taskIdMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);

      // GET /api/tasks
      if (method === 'GET' && pathname === '/api/tasks') {
        const date = url.searchParams.get('date') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const priority = url.searchParams.get('priority') || undefined;
        const isFocus = url.searchParams.has('isFocus')
          ? url.searchParams.get('isFocus') === 'true'
          : undefined;

        const tasks = taskService.getTasksByDate(date, { status, priority, isFocus });
        return sendJson(res, 200, tasks);
      }

      // POST /api/tasks
      if (method === 'POST' && pathname === '/api/tasks') {
        const body = await readJsonBody(req);
        const task = taskService.createTask(body);
        return sendJson(res, 201, { task });
      }

      // PATCH /api/tasks/:id
      if (method === 'PATCH' && taskIdMatch) {
        const id = decodeURIComponent(taskIdMatch[1]);
        const body = await readJsonBody(req);
        const task = taskService.updateTask(id, body);
        return sendJson(res, 200, { task });
      }

      // DELETE /api/tasks/:id
      if (method === 'DELETE' && taskIdMatch) {
        const id = decodeURIComponent(taskIdMatch[1]);
        taskService.deleteTask(id);
        return sendNoContent(res);
      }

      // Briefing Routes
      // GET /api/briefing
      if (method === 'GET' && pathname === '/api/briefing') {
        const date = url.searchParams.get('date') || undefined;
        const briefing = await briefingService.getBriefingByDate(date);
        return sendJson(res, 200, briefing);
      }

      // POST /api/briefing/refresh
      if (method === 'POST' && pathname === '/api/briefing/refresh') {
        const body = await readJsonBody(req);
        const date = body?.date || url.searchParams.get('date') || undefined;
        const briefing = await briefingService.refreshBriefing(date);
        return sendJson(res, 200, briefing);
      }

      // Dashboard Routes
      // GET /api/dashboard/summary
      if (method === 'GET' && pathname === '/api/dashboard/summary') {
        const date = url.searchParams.get('date') || undefined;
        const newsLimit = url.searchParams.get('newsLimit') || undefined;
        const summary = await dashboardService.getSummary(date, { newsLimit });
        return sendJson(res, 200, summary);
      }

      // Static File Serving (Non-API GET routes)
      if (method === 'GET' && !pathname.startsWith('/api/')) {
        const served = serveStaticFile(req, res, publicDir, pathname);
        if (served) return;
      }

      // 404 Route Not Found
      return sendJson(res, 404, { error: `Route not found: ${method} ${pathname}` });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return sendJson(res, 413, { error: err.message });
      }
      if (err instanceof ValidationError) {
        return sendJson(res, 400, { error: err.message });
      }
      if (err instanceof SSRFError) {
        return sendJson(res, 400, { error: err.message });
      }
      if (err instanceof NotFoundError) {
        return sendJson(res, 404, { error: err.message });
      }
      console.error('Unhandled request error:', err);
      return sendJson(res, 500, { error: 'Internal Server Error' });
    }
  };
}

export function createApp({
  db,
  config = {},
  briefingService,
  dashboardService,
  calendarSourceService,
  unifiedCalendarService,
  publicDir
} = {}) {
  const agendaService = new AgendaService(db);
  const taskService = new TaskService(db);
  const resolvedBriefingService = briefingService || new BriefingService({ db });
  const resolvedCalendarSourceService = calendarSourceService || new CalendarSourceService(db);
  const resolvedUnifiedCalendarService = unifiedCalendarService || new UnifiedCalendarService({
    db,
    agendaService,
    taskService
  });
  const resolvedDashboardService = dashboardService || new DashboardService({
    briefingService: resolvedBriefingService,
    agendaService,
    taskService
  });

  const resolvedPublicDir = publicDir || config.publicDir || defaultPublicDir;

  const handler = createRequestHandler({
    db,
    agendaService,
    taskService,
    briefingService: resolvedBriefingService,
    dashboardService: resolvedDashboardService,
    calendarSourceService: resolvedCalendarSourceService,
    unifiedCalendarService: resolvedUnifiedCalendarService,
    publicDir: resolvedPublicDir,
    config
  });

  const server = http.createServer(handler);
  server.agendaService = agendaService;
  server.taskService = taskService;
  server.briefingService = resolvedBriefingService;
  server.dashboardService = resolvedDashboardService;
  server.calendarSourceService = resolvedCalendarSourceService;
  server.unifiedCalendarService = resolvedUnifiedCalendarService;
  return server;
}
