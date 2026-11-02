import { escapeHtml } from './briefing-view.js';

/**
 * Kanban Tasks Planner Screen Component (V2)
 * Renders interactive 3-column Kanban board (Pendiente, En Progreso, Completada)
 * with native HTML5 Drag & Drop support and accessible mobile/keyboard controls.
 */
export function renderTasksKanbanView(tasks = [], activeFilter = 'Todas') {
  const allTasks = Array.isArray(tasks) ? tasks : [];

  const columns = [
    { id: 'Pendiente', title: 'Pendiente', icon: '⏳', color: 'var(--accent-amber)' },
    { id: 'En Progreso', title: 'En Progreso', icon: '⚡', color: 'var(--accent-cyan)' },
    { id: 'Completada', title: 'Completada', icon: '✅', color: 'var(--accent-green)' }
  ];

  const columnsHtml = columns.map(col => {
    const colTasks = allTasks.filter(t => t.status === col.id);

    const cardsHtml = colTasks.length > 0
      ? colTasks.map(task => {
          const isFocus = Boolean(task.isFocus);
          const priority = task.priority || 'Media';

          return `
            <article class="kanban-task-card card ${isFocus ? 'is-focus' : ''}"
                     draggable="true"
                     data-id="${escapeHtml(task.id)}"
                     data-status="${escapeHtml(task.status)}"
                     data-date="${escapeHtml(task.date || '')}">
              <div class="card-top-row">
                <div class="badges-group">
                  <button class="btn btn-icon btn-sm btn-toggle-focus"
                          data-id="${escapeHtml(task.id)}"
                          data-focus="${isFocus ? 'false' : 'true'}"
                          title="Alternar Enfoque del Día">
                    ${isFocus ? '⭐ DAILY FOCUS' : '☆ Marcar Focus'}
                  </button>
                  <span class="priority-badge priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span>
                </div>
                <button class="btn btn-icon btn-sm btn-delete-task"
                        data-id="${escapeHtml(task.id)}"
                        title="Eliminar tarea">
                  🗑️
                </button>
              </div>

              <h4 class="task-title ${task.status === 'Completada' ? 'task-completed-text' : ''}">
                ${escapeHtml(task.title)}
              </h4>

              <div class="task-metadata">
                <span class="task-date text-muted">📅 ${escapeHtml(task.date || 'Sin fecha')}</span>
              </div>

              <div class="card-accessible-actions">
                ${col.id === 'Pendiente' ? `
                  <button class="btn btn-sm btn-outline btn-move-status" data-id="${escapeHtml(task.id)}" data-status="En Progreso" title="Mover a En Progreso">
                    Iniciar ▶
                  </button>
                ` : ''}

                ${col.id === 'En Progreso' ? `
                  <button class="btn btn-sm btn-outline btn-move-status" data-id="${escapeHtml(task.id)}" data-status="Pendiente" title="Regresar a Pendiente">
                    ◀ Pausar
                  </button>
                  <button class="btn btn-sm btn-outline btn-move-status" data-id="${escapeHtml(task.id)}" data-status="Completada" title="Marcar como Completada">
                    ✔ Completar
                  </button>
                ` : ''}

                ${col.id === 'Completada' ? `
                  <button class="btn btn-sm btn-outline btn-move-status" data-id="${escapeHtml(task.id)}" data-status="En Progreso" title="Reabrir tarea">
                    ◀ Reabrir
                  </button>
                ` : ''}
              </div>
            </article>
          `;
        }).join('')
      : `<div class="empty-column text-muted">Sin tareas en ${col.title}. Arrastra aquí para mover.</div>`;

    return `
      <section class="kanban-column" data-column-status="${col.id}">
        <div class="column-header">
          <div class="column-title-group">
            <span class="column-icon">${col.icon}</span>
            <h3>${col.title}</h3>
            <span class="column-count badge badge-neutral">${colTasks.length}</span>
          </div>
        </div>

        <div class="kanban-dropzone" data-column-status="${col.id}">
          ${cardsHtml}
        </div>
      </section>
    `;
  }).join('');

  return `
    <div class="tasks-planner-screen-container">
      <div class="planner-header-bar">
        <div class="header-title-group">
          <h2>📋 Planner Táctico de Tareas (Kanban)</h2>
          <p class="text-muted">Arrastra tarjetas entre columnas o usa los botones de transición rápida</p>
        </div>
        <div class="planner-actions">
          <button id="btn-toggle-task-form" class="btn btn-sm btn-primary">
            ➕ Nueva Tarea
          </button>
        </div>
      </div>

      <!-- Quick Add Task Form -->
      <form id="form-quick-add-task" class="form-panel card hidden" style="margin-bottom: 1.25rem;">
        <h3 class="form-title">Crear Nueva Tarea</h3>
        <div class="form-row">
          <div class="form-group flex-2">
            <label for="task-title">Título de la tarea:</label>
            <input type="text" id="task-title" required placeholder="Ej: Implementar reglas de detección para CVE-2026-1102">
          </div>
          <div class="form-group flex-1">
            <label for="task-priority">Prioridad:</label>
            <select id="task-priority">
              <option value="Alta">Alta</option>
              <option value="Media" selected>Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label for="task-date">Fecha asignada:</label>
            <input type="date" id="task-date" value="${new Date().toISOString().slice(0, 10)}">
          </div>
        </div>
        <div class="form-row form-checkbox-row" style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
          <input type="checkbox" id="task-focus">
          <label for="task-focus">⭐ Establecer como Daily Focus (Enfoque del Día)</label>
        </div>
        <div class="form-actions" style="margin-top: 0.75rem;">
          <button type="submit" class="btn btn-primary">Guardar Tarea</button>
          <button type="button" id="btn-cancel-task" class="btn btn-secondary">Cancelar</button>
        </div>
      </form>

      <!-- 3-Column Kanban Board Grid -->
      <div class="kanban-board">
        ${columnsHtml}
      </div>
    </div>
  `;
}
