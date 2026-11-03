import { escapeHtml, sanitizeUrl } from './briefing-view.js';

/**
 * Executive Summary Landing View Component
 * Renders the 3 executive widgets (News, Calendar, Tasks) with reactive controls and CTAs.
 */
export function renderSummaryView(summary = {}) {
  const date = summary.date || '';
  const newsLimit = Number(summary.newsLimit) || 3;
  const topNews = Array.isArray(summary.topNews) ? summary.topNews : [];
  const briefingCount = summary.briefingCount || 0;
  const mode = summary.mode || 'HEURISTIC_LOCAL';

  const meetingStats = summary.meetingStats || { total: 0, conflictsCount: 0, nextMeeting: null };
  const taskStats = summary.taskStats || {
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    focusCount: 0,
    focusTask: null,
    completionRate: 0
  };

  const completionRate = taskStats.total > 0
    ? Math.round((taskStats.completed / taskStats.total) * 100)
    : 0;

  // 1. News Widget HTML
  const newsCardsHtml = topNews.length > 0
    ? topNews.map(item => `
        <article class="summary-news-card card">
          <div class="summary-card-header">
            <span class="news-source-tag">${escapeHtml(item.source || 'Ciberseguridad')}</span>
          </div>
          <h4 class="summary-news-title">
            <a href="${sanitizeUrl(item.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(item.title)}
            </a>
          </h4>
          <p class="summary-news-extract">${escapeHtml(item.summary || '')}</p>
        </article>
      `).join('')
    : '<div class="empty-state">No hay noticias analizadas para esta fecha.</div>';

  // 2. Calendar Widget HTML
  const conflictBannerHtml = meetingStats.conflictsCount > 0
    ? `<div class="alert-conflict conflict-warning" role="alert">
         ⚠️ <strong>Solapamiento detectado:</strong> Hay ${meetingStats.conflictsCount} citas con conflicto de horario.
       </div>`
    : '';

  const nextMeetingHtml = meetingStats.nextMeeting
    ? `<div class="summary-next-meeting">
         <span class="next-label">Próxima cita:</span>
         <span class="next-title"><strong>${escapeHtml(meetingStats.nextMeeting.title)}</strong></span>
         <span class="next-time">(${escapeHtml(meetingStats.nextMeeting.startTime)} - ${escapeHtml(meetingStats.nextMeeting.endTime)})</span>
       </div>`
    : `<div class="summary-next-meeting text-muted">No hay reuniones programadas para hoy.</div>`;

  // 3. Tasks Widget HTML
  const focusHtml = taskStats.focusTask
    ? `<div class="summary-focus-card">
         <span class="focus-badge">⭐ Daily Focus</span>
         <span class="focus-title"><strong>${escapeHtml(taskStats.focusTask.title)}</strong></span>
         <span class="priority-badge priority-${escapeHtml(taskStats.focusTask.priority || 'Media')}">
           ${escapeHtml(taskStats.focusTask.priority || 'Media')}
         </span>
       </div>`
    : `<div class="summary-focus-card text-muted">Sin tarea designada como Daily Focus hoy.</div>`;

  return `
    <div class="summary-landing-container">
      <div class="summary-widgets-grid">
        <!-- Widget 1: Daily Security Briefing -->
        <section class="summary-widget summary-widget-news card">
          <div class="widget-header">
            <div class="widget-title-group">
              <span class="widget-icon">🛡️</span>
              <h3>Noticias de Seguridad</h3>
              <span class="badge badge-neutral">${briefingCount} analizadas</span>
            </div>
            <div class="news-limit-selector">
              <label for="select-news-limit">Mostrar:</label>
              <select id="select-news-limit" class="select-news-limit" aria-label="Cantidad de noticias a mostrar">
                <option value="1" ${newsLimit === 1 ? 'selected' : ''}>1 noticia</option>
                <option value="3" ${newsLimit === 3 ? 'selected' : ''}>3 noticias</option>
                <option value="5" ${newsLimit === 5 ? 'selected' : ''}>5 noticias</option>
              </select>
            </div>
          </div>

          <div class="widget-body">
            ${newsCardsHtml}
          </div>

          <div class="widget-footer">
            <a href="#/news" class="btn btn-cta btn-news-cta">
              Ver todas las noticias de seguridad →
            </a>
          </div>
        </section>

        <!-- Widget 2: Agenda y Compromisos -->
        <section class="summary-widget summary-widget-calendar card">
          <div class="widget-header">
            <div class="widget-title-group">
              <span class="widget-icon">📅</span>
              <h3>Compromisos del Día</h3>
              <span class="badge badge-info">${meetingStats.total} citas</span>
            </div>
          </div>

          <div class="widget-body">
            ${conflictBannerHtml}
            ${nextMeetingHtml}
          </div>

          <div class="widget-footer">
            <a href="#/calendar" class="btn btn-cta btn-calendar-cta">
              Ir a mi Calendario →
            </a>
          </div>
        </section>

        <!-- Widget 3: Planner y Tareas -->
        <section class="summary-widget summary-widget-tasks card">
          <div class="widget-header">
            <div class="widget-title-group">
              <span class="widget-icon">📋</span>
              <h3>Planner de Tareas</h3>
              <span class="badge badge-success">${taskStats.total} tareas</span>
            </div>
          </div>

          <div class="widget-body">
            <div class="tasks-progress-block">
              <div class="progress-labels">
                <span>Progreso:</span>
                <strong>${taskStats.completed} de ${taskStats.total} tareas listas (${completionRate}%)</strong>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${completionRate}%"></div>
              </div>
            </div>

            ${focusHtml}
          </div>

          <div class="widget-footer">
            <a href="#/tasks" class="btn btn-cta btn-tasks-cta">
              Abrir Planner de Tareas →
            </a>
          </div>
        </section>
      </div>
    </div>
  `;
}
