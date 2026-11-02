import { escapeHtml } from './briefing-view.js';

export function renderTaskView(tasks = [], activeFilter = 'Todas') {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return `<div class="empty-state">No hay tareas pendientes en este filtro. ¡Agrega tus prioridades!</div>`;
  }

  // Client-side filtering if requested
  let filtered = tasks;
  if (activeFilter === 'Activas') {
    filtered = tasks.filter((t) => t.status !== 'Completada');
  } else if (activeFilter === 'Completadas') {
    filtered = tasks.filter((t) => t.status === 'Completada');
  } else if (activeFilter === 'Focus') {
    filtered = tasks.filter((t) => t.isFocus);
  }

  if (filtered.length === 0) {
    return `<div class="empty-state">No hay tareas que coincidan con el filtro "${escapeHtml(activeFilter)}".</div>`;
  }

  return filtered.map((t) => {
    const focusClass = t.isFocus ? 'is-focus' : '';
    const completedClass = t.status === 'Completada' ? 'completed' : '';
    const focusBadge = t.isFocus ? `<span class="focus-badge">⭐ DAILY FOCUS</span>` : '';
    const safeTitle = escapeHtml(t.title);
    const priorityClass = `priority-${t.priority}`;

    return `
      <div class="card task-card ${focusClass} ${completedClass}" data-id="${escapeHtml(t.id)}">
        <div class="task-header">
          <div class="task-badges">
            <span class="priority-badge ${priorityClass}">${escapeHtml(t.priority)}</span>
            ${focusBadge}
          </div>
          <button class="btn btn-sm btn-outline btn-toggle-focus" data-id="${escapeHtml(t.id)}" data-focus="${!t.isFocus}" title="Alternar Enfoque del Día">
            ${t.isFocus ? '⭐ Quitar Focus' : '☆ Marcar Focus'}
          </button>
        </div>

        <div class="task-title">${safeTitle}</div>

        <div class="task-actions">
          <select class="select-status" data-id="${escapeHtml(t.id)}">
            <option value="Pendiente" ${t.status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
            <option value="En Progreso" ${t.status === 'En Progreso' ? 'selected' : ''}>⚡ En Progreso</option>
            <option value="Completada" ${t.status === 'Completada' ? 'selected' : ''}>✅ Completada</option>
          </select>

          <button class="btn btn-sm btn-danger btn-delete-task" data-id="${escapeHtml(t.id)}" title="Eliminar tarea">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}
