import { api } from './api.js';
import { renderBriefingView } from './components/briefing-view.js';
import { renderAgendaView } from './components/agenda-view.js';
import { renderTaskView } from './components/task-view.js';

// Application State
const state = {
  currentDate: new Date().toISOString().slice(0, 10),
  activeTaskFilter: 'Todas',
  theme: localStorage.getItem('samabox-theme') || 'dark',
  briefing: null,
  meetings: [],
  tasks: [],
  summary: null
};

// Initialize Dashboard
export async function initApp() {
  // Apply saved theme
  applyTheme(state.theme);

  // Setup Date Input
  const dateInput = document.getElementById('dashboard-date');
  if (dateInput) {
    dateInput.value = state.currentDate;
    dateInput.addEventListener('change', (e) => {
      state.currentDate = e.target.value;
      loadDashboard();
    });
  }

  // Setup Controls
  setupHeaderControls();
  setupBriefingControls();
  setupAgendaControls();
  setupTaskControls();

  // Load initial data
  await loadDashboard();
}

// Theme handling
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('samabox-theme', theme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

function setupHeaderControls() {
  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  const refreshAllBtn = document.getElementById('btn-refresh-all');
  if (refreshAllBtn) {
    refreshAllBtn.addEventListener('click', () => loadDashboard());
  }
}

// Load all dashboard components concurrently
export async function loadDashboard() {
  try {
    const [summary, briefing, meetings, tasks] = await Promise.all([
      api.getDashboardSummary(state.currentDate).catch(() => null),
      api.getBriefing(state.currentDate).catch(() => ({ items: [], mode: 'HEURISTIC_LOCAL' })),
      api.getMeetings(state.currentDate).catch(() => []),
      api.getTasks(state.currentDate).catch(() => [])
    ]);

    state.summary = summary;
    state.briefing = briefing;
    state.meetings = meetings;
    state.tasks = tasks;

    updateSummaryBar();
    updateBriefingColumn();
    updateAgendaColumn();
    updateTasksColumn();
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Update Top Metrics Bar
function updateSummaryBar() {
  const briefingCountEl = document.getElementById('metric-briefing-count');
  const aiModeEl = document.getElementById('metric-ai-mode');
  const meetingsCountEl = document.getElementById('metric-meetings-count');
  const conflictsBadgeEl = document.getElementById('metric-conflicts-badge');
  const tasksProgressEl = document.getElementById('metric-tasks-progress');
  const progressFillEl = document.getElementById('metric-progress-fill');

  const briefingItems = state.briefing?.items || [];
  const mode = state.briefing?.mode || state.summary?.mode || 'HEURISTIC_LOCAL';
  const meetings = state.meetings || [];
  const tasks = state.tasks || [];

  if (briefingCountEl) {
    briefingCountEl.textContent = `${briefingItems.length} Noticias Críticas`;
  }

  if (aiModeEl) {
    if (mode === 'LLM_CLOUD') {
      aiModeEl.textContent = 'Modo: Cloud LLM';
      aiModeEl.className = 'metric-badge badge-cloud';
    } else {
      aiModeEl.textContent = 'Modo: Heurístico Local';
      aiModeEl.className = 'metric-badge badge-heuristic';
    }
  }

  const conflictsCount = meetings.filter((m) => m.hasConflict).length;
  if (meetingsCountEl) {
    meetingsCountEl.textContent = `${meetings.length} Reuniones`;
  }

  if (conflictsBadgeEl) {
    if (conflictsCount > 0) {
      conflictsBadgeEl.textContent = `⚠️ ${conflictsCount} Solapamiento${conflictsCount > 1 ? 's' : ''}`;
      conflictsBadgeEl.className = 'metric-badge badge-warning';
    } else {
      conflictsBadgeEl.textContent = 'Sin Solapamientos';
      conflictsBadgeEl.className = 'metric-badge badge-success';
    }
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Completada').length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  if (tasksProgressEl) {
    tasksProgressEl.textContent = `${completedTasks} de ${totalTasks} completadas (${percent}%)`;
  }

  if (progressFillEl) {
    progressFillEl.style.width = `${percent}%`;
  }
}

// Column 1: Briefing
function setupBriefingControls() {
  const refreshBriefingBtn = document.getElementById('btn-refresh-briefing');
  if (refreshBriefingBtn) {
    refreshBriefingBtn.addEventListener('click', async () => {
      const container = document.getElementById('briefing-container');
      if (container) {
        container.innerHTML = '<div class="loading-state">Actualizando inteligencia de ciberseguridad...</div>';
      }
      try {
        state.briefing = await api.refreshBriefing(state.currentDate);
        updateBriefingColumn();
        updateSummaryBar();
      } catch (err) {
        alert('Error al actualizar briefing: ' + err.message);
        loadDashboard();
      }
    });
  }
}

function updateBriefingColumn() {
  const badgeEl = document.getElementById('briefing-badge-count');
  const container = document.getElementById('briefing-container');
  const items = state.briefing?.items || [];

  if (badgeEl) {
    badgeEl.textContent = `${items.length} noticias`;
  }

  if (container) {
    container.innerHTML = renderBriefingView(state.briefing);
  }
}

// Column 2: Agenda
function setupAgendaControls() {
  const toggleBtn = document.getElementById('btn-toggle-meeting-form');
  const form = document.getElementById('form-create-meeting');
  const cancelBtn = document.getElementById('btn-cancel-meeting');

  if (toggleBtn && form) {
    toggleBtn.addEventListener('click', () => {
      form.classList.toggle('hidden');
    });
  }

  if (cancelBtn && form) {
    cancelBtn.addEventListener('click', () => {
      form.classList.add('hidden');
      form.reset();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('meeting-title')?.value;
      const startTime = document.getElementById('meeting-start')?.value;
      const endTime = document.getElementById('meeting-end')?.value;
      const location = document.getElementById('meeting-location')?.value || '';
      const notes = document.getElementById('meeting-notes')?.value || '';

      try {
        await api.createMeeting({
          title,
          startTime,
          endTime,
          location,
          notes,
          date: state.currentDate
        });
        form.reset();
        form.classList.add('hidden');
        state.meetings = await api.getMeetings(state.currentDate);
        updateAgendaColumn();
        updateSummaryBar();
      } catch (err) {
        alert('Error al agendar reunión: ' + err.message);
      }
    });
  }

  const container = document.getElementById('agenda-container');
  if (container) {
    container.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('.btn-delete-meeting');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('¿Eliminar esta reunión?')) {
          try {
            await api.deleteMeeting(id);
            state.meetings = await api.getMeetings(state.currentDate);
            updateAgendaColumn();
            updateSummaryBar();
          } catch (err) {
            alert('Error al eliminar reunión: ' + err.message);
          }
        }
      }
    });
  }
}

function updateAgendaColumn() {
  const badgeEl = document.getElementById('agenda-badge-count');
  const container = document.getElementById('agenda-container');
  const meetings = state.meetings || [];

  if (badgeEl) {
    badgeEl.textContent = `${meetings.length} compromisos`;
  }

  if (container) {
    container.innerHTML = renderAgendaView(meetings);
  }
}

// Column 3: Tasks
function setupTaskControls() {
  const toggleBtn = document.getElementById('btn-toggle-task-form');
  const form = document.getElementById('form-create-task');
  const cancelBtn = document.getElementById('btn-cancel-task');

  if (toggleBtn && form) {
    toggleBtn.addEventListener('click', () => {
      form.classList.toggle('hidden');
    });
  }

  if (cancelBtn && form) {
    cancelBtn.addEventListener('click', () => {
      form.classList.add('hidden');
      form.reset();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('task-title')?.value;
      const priority = document.getElementById('task-priority')?.value || 'Media';
      const isFocus = Boolean(document.getElementById('task-focus')?.checked);

      try {
        await api.createTask({
          title,
          priority,
          isFocus,
          date: state.currentDate
        });
        form.reset();
        form.classList.add('hidden');
        state.tasks = await api.getTasks(state.currentDate);
        updateTasksColumn();
        updateSummaryBar();
      } catch (err) {
        alert('Error al crear tarea: ' + err.message);
      }
    });
  }

  // Filter tabs
  const filterTabs = document.querySelectorAll('.task-filters .filter-tab');
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeTaskFilter = tab.dataset.filter || 'Todas';
      updateTasksColumn();
    });
  });

  // Task item actions delegation
  const container = document.getElementById('tasks-container');
  if (container) {
    container.addEventListener('change', async (e) => {
      if (e.target.classList.contains('select-status')) {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          await api.updateTask(id, { status: newStatus });
          state.tasks = await api.getTasks(state.currentDate);
          updateTasksColumn();
          updateSummaryBar();
        } catch (err) {
          alert('Error al actualizar estado de tarea: ' + err.message);
        }
      }
    });

    container.addEventListener('click', async (e) => {
      const focusBtn = e.target.closest('.btn-toggle-focus');
      if (focusBtn) {
        const id = focusBtn.dataset.id;
        const newFocus = focusBtn.dataset.focus === 'true';
        try {
          await api.updateTask(id, { isFocus: newFocus });
          state.tasks = await api.getTasks(state.currentDate);
          updateTasksColumn();
          updateSummaryBar();
        } catch (err) {
          alert('Error al actualizar Enfoque del Día: ' + err.message);
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-task');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('¿Eliminar esta tarea?')) {
          try {
            await api.deleteTask(id);
            state.tasks = await api.getTasks(state.currentDate);
            updateTasksColumn();
            updateSummaryBar();
          } catch (err) {
            alert('Error al eliminar tarea: ' + err.message);
          }
        }
      }
    });
  }
}

function updateTasksColumn() {
  const badgeEl = document.getElementById('tasks-badge-count');
  const container = document.getElementById('tasks-container');
  const tasks = state.tasks || [];

  if (badgeEl) {
    badgeEl.textContent = `${tasks.length} tareas`;
  }

  if (container) {
    container.innerHTML = renderTaskView(tasks, state.activeTaskFilter);
  }
}

// Auto-init in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}
