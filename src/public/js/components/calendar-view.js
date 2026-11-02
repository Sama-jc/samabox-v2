import { escapeHtml } from './briefing-view.js';

/**
 * Dedicated Calendar Screen Component (V2)
 * Consolidates local and external calendar sources, collision detection,
 * reminders / all-day lane, and projected tasks for the queried date.
 */
export function renderCalendarView(data = {}) {
  const date = data.date || new Date().toISOString().slice(0, 10);
  const meetings = Array.isArray(data.meetings) ? data.meetings : [];
  const allDayEvents = Array.isArray(data.allDayEvents) ? data.allDayEvents : [];
  const projectedTasks = Array.isArray(data.projectedTasks) ? data.projectedTasks : [];
  const calendarSources = Array.isArray(data.calendarSources) ? data.calendarSources : [];

  const conflictsCount = meetings.filter((m) => m.hasConflict).length;

  // 1. All-Day / Reminders Lane HTML
  const allDayHtml = allDayEvents.length > 0
    ? allDayEvents.map(event => {
        const color = event.sourceColor || '#388bfd';
        const isExternal = Boolean(event.isExternal);
        return `
          <div class="calendar-item-card reminder-card" style="--source-color: ${color}; border-left: 4px solid ${color};">
            <div class="item-main">
              <span class="source-badge" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}66;">
                ${escapeHtml(event.sourceName || 'Local')}
              </span>
              <span class="item-title"><strong>${escapeHtml(event.title)}</strong></span>
              <span class="badge badge-neutral">${event.entryType === 'reminder' ? 'Recordatorio' : 'Todo el día'}</span>
            </div>
            <div class="item-actions">
              ${isExternal
                ? '<span class="badge badge-external is-external" title="Sincronizado desde fuente externa">Solo lectura</span>'
                : `<button class="btn btn-icon btn-sm btn-delete-meeting" data-id="${escapeHtml(event.id)}" title="Eliminar recordatorio">🗑️</button>`}
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state empty-lane">No hay recordatorios ni eventos de día completo para esta fecha.</div>';

  // 2. Timed Meetings Timeline HTML
  const meetingsHtml = meetings.length > 0
    ? meetings.map(meeting => {
        const color = meeting.sourceColor || '#388bfd';
        const isExternal = Boolean(meeting.isExternal);
        const conflictClass = meeting.hasConflict ? 'has-conflict' : '';
        const conflictBadge = meeting.hasConflict
          ? `<div class="conflict-alert" role="alert">⚠️ Conflicto de horario</div>`
          : '';

        return `
          <div class="calendar-item-card meeting-card ${conflictClass}" style="--source-color: ${color}; border-left: 4px solid ${color};">
            <div class="item-header">
              <div class="item-time-badge">
                <span>🕒 ${escapeHtml(meeting.startTime)} - ${escapeHtml(meeting.endTime)}</span>
              </div>
              <div class="item-source-group">
                <span class="source-badge" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}66;">
                  ${escapeHtml(meeting.sourceName || 'Local')}
                </span>
                ${isExternal
                  ? '<span class="badge badge-external is-external">Solo lectura</span>'
                  : `<button class="btn btn-icon btn-sm btn-delete-meeting" data-id="${escapeHtml(meeting.id)}" title="Eliminar reunión">🗑️</button>`}
              </div>
            </div>

            <h4 class="item-title">${escapeHtml(meeting.title)}</h4>
            ${conflictBadge}

            ${meeting.location ? `<div class="item-location">📍 ${escapeHtml(meeting.location)}</div>` : ''}
            ${meeting.notes ? `<div class="item-notes">${escapeHtml(meeting.notes)}</div>` : ''}
          </div>
        `;
      }).join('')
    : '<div class="empty-state empty-lane">No hay reuniones programadas para este día.</div>';

  // 3. Projected Tasks Lane HTML
  const tasksHtml = projectedTasks.length > 0
    ? projectedTasks.map(task => {
        const isFocus = Boolean(task.isFocus);
        const focusBadge = isFocus
          ? `<span class="focus-badge">⭐ DAILY FOCUS</span>`
          : '';

        return `
          <div class="calendar-projected-task-card card ${isFocus ? 'is-focus' : ''}">
            <div class="task-info">
              <div class="task-badges">
                ${focusBadge}
                <span class="priority-badge priority-${escapeHtml(task.priority || 'Media')}">
                  ${escapeHtml(task.priority || 'Media')}
                </span>
              </div>
              <span class="task-title ${task.status === 'Completada' ? 'task-completed-text' : ''}">
                ${escapeHtml(task.title)}
              </span>
            </div>

            <div class="task-status-control">
              <select class="select-projected-task-status select-status" data-id="${escapeHtml(task.id)}" aria-label="Cambiar estado de tarea">
                <option value="Pendiente" ${task.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="En Progreso" ${task.status === 'En Progreso' ? 'selected' : ''}>En Progreso</option>
                <option value="Completada" ${task.status === 'Completada' ? 'selected' : ''}>Completada</option>
              </select>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state empty-lane">No hay tareas programadas para esta fecha.</div>';

  return `
    <div class="calendar-screen-container">
      <!-- Calendar Controls & Navigation Bar -->
      <div class="calendar-header-bar">
        <div class="date-navigator">
          <button id="btn-calendar-prev" class="btn btn-sm btn-secondary" title="Día anterior">◀</button>
          <input type="date" id="calendar-date-input" class="input-date" value="${escapeHtml(date)}">
          <button id="btn-calendar-today" class="btn btn-sm btn-secondary">Hoy</button>
          <button id="btn-calendar-next" class="btn btn-sm btn-secondary" title="Día siguiente">▶</button>
        </div>

        <div class="calendar-actions">
          <button id="btn-toggle-meeting-form" class="btn btn-sm btn-primary">
            ➕ Agendar Compromiso
          </button>
          <button id="btn-manage-calendars" class="btn btn-sm btn-outline">
            📅 Gestionar Cuentas (${calendarSources.length})
          </button>
        </div>
      </div>

      <!-- Quick Add Meeting / Reminder Inline Form -->
      <form id="form-create-meeting" class="form-panel card hidden" style="margin-bottom: 1.25rem;">
        <h3 class="form-title">Nuevo Compromiso o Recordatorio</h3>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="meeting-title">Título:</label>
            <input type="text" id="meeting-title" required placeholder="Ej: Auditoría SOC2">
          </div>
          <div class="form-group flex-1">
            <label for="meeting-entry-type">Tipo:</label>
            <select id="meeting-entry-type">
              <option value="meeting">Reunión con horario</option>
              <option value="reminder">Recordatorio / Todo el día</option>
            </select>
          </div>
        </div>

        <div class="form-row" id="time-inputs-row">
          <div class="form-group flex-1">
            <label for="meeting-start">Hora Inicio:</label>
            <input type="time" id="meeting-start" value="09:00">
          </div>
          <div class="form-group flex-1">
            <label for="meeting-end">Hora Fin:</label>
            <input type="time" id="meeting-end" value="10:00">
          </div>
          <div class="form-group flex-2">
            <label for="meeting-location">Ubicación / Enlace:</label>
            <input type="text" id="meeting-location" placeholder="Ej: Sala 3B o enlace Zoom">
          </div>
        </div>

        <div class="form-group">
          <label for="meeting-notes">Notas / Contexto:</label>
          <textarea id="meeting-notes" rows="2" placeholder="Notas preparatorias..."></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Guardar</button>
          <button type="button" id="btn-cancel-meeting" class="btn btn-secondary">Cancelar</button>
        </div>
      </form>

      ${conflictsCount > 0 ? `
        <div class="alert-conflict conflict-warning" role="alert" style="margin-bottom: 1.25rem;">
          ⚠️ <strong>Solapamiento detectado:</strong> Hay ${conflictsCount} citas con conflicto de horario en esta fecha.
        </div>
      ` : ''}

      <!-- Main Calendar Grid: AllDay/Reminders + Timeline + Projected Tasks -->
      <div class="calendar-screen-grid">
        <!-- Column 1 & 2: Agenda (All-Day Lane + Timeline) -->
        <div class="calendar-main-column">
          <!-- All-Day & Reminders Lane -->
          <section class="calendar-section calendar-all-day-lane card">
            <div class="section-header">
              <span class="section-icon">📌</span>
              <h3>Recordatorios y Día Completo</h3>
              <span class="badge badge-neutral">${allDayEvents.length}</span>
            </div>
            <div class="section-body">
              ${allDayHtml}
            </div>
          </section>

          <!-- Timed Meetings Timeline -->
          <section class="calendar-section calendar-timeline-lane card">
            <div class="section-header">
              <span class="section-icon">🕒</span>
              <h3>Cronograma de Reuniones</h3>
              <span class="badge badge-info">${meetings.length}</span>
            </div>
            <div class="section-body">
              ${meetingsHtml}
            </div>
          </section>
        </div>

        <!-- Column 3: Task Projection Lane -->
        <div class="calendar-side-column">
          <section class="calendar-section calendar-projected-tasks card">
            <div class="section-header">
              <span class="section-icon">📋</span>
              <h3>Tareas para la Fecha</h3>
              <span class="badge badge-success">${projectedTasks.length}</span>
            </div>
            <div class="section-body">
              ${tasksHtml}
            </div>
            <div class="section-footer">
              <a href="#/tasks" class="btn btn-cta">Abrir Planner de Tareas →</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
