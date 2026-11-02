import { escapeHtml } from './briefing-view.js';

export function renderAgendaView(meetings = []) {
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return `<div class="empty-state">No tienes compromisos agendados para este día. ¡Agenda tu primera reunión!</div>`;
  }

  return meetings.map((m) => {
    const conflictClass = m.hasConflict ? 'has-conflict' : '';
    const conflictBadge = m.hasConflict
      ? `<div class="meeting-conflict-alert">⚠️ Conflicto de horario: se solapa con otro compromiso</div>`
      : '';

    const safeTitle = escapeHtml(m.title);
    const safeStart = escapeHtml(m.startTime);
    const safeEnd = escapeHtml(m.endTime);
    const safeLocation = m.location ? `<div class="meeting-detail-row">📍 ${escapeHtml(m.location)}</div>` : '';
    const safeNotes = m.notes ? `<div class="meeting-detail-row">📝 ${escapeHtml(m.notes)}</div>` : '';

    return `
      <div class="card meeting-card ${conflictClass}" data-id="${escapeHtml(m.id)}">
        ${conflictBadge}
        <div class="meeting-time">⏰ ${safeStart} - ${safeEnd}</div>
        <div class="meeting-title">${safeTitle}</div>
        ${safeLocation || safeNotes ? `<div class="meeting-details">${safeLocation}${safeNotes}</div>` : ''}
        <div class="meeting-card-footer">
          <button class="btn btn-sm btn-danger btn-delete-meeting" data-id="${escapeHtml(m.id)}" title="Eliminar reunión">
            🗑️ Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');
}
