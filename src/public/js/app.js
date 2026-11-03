import { api } from './api.js';
import { renderBriefingView } from './components/briefing-view.js';
import { renderAgendaView } from './components/agenda-view.js';
import { renderTaskView } from './components/task-view.js';
import { renderSummaryView } from './components/summary-view.js';
import { renderCalendarView } from './components/calendar-view.js';
import { renderCalendarModal } from './components/calendar-modal.js';
import { renderTasksKanbanView } from './components/tasks-view.js';
import { renderNewsScreenView } from './components/news-view.js';
import { Router } from './router.js';

// Application State
const state = {
  currentDate: new Date().toISOString().slice(0, 10),
  activeTaskFilter: 'Todas',
  theme: localStorage.getItem('samabox-theme') || 'dark',
  briefing: null,
  meetings: [],
  tasks: [],
  summary: null,
  unifiedCalendar: null,
  calendarSources: [],
  newsLimit: 3,
  newsSearchQuery: '',
  newsSelectedSource: 'Todas',
  currentRoute: 'summary'
};

let router = null;

// Initialize Dashboard & SPA Hash Router
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

  // Setup SPA Router
  setupRouter();

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

// SPA Router setup and route dispatcher
export function setupRouter() {
  router = new Router({
    routes: {
      summary: () => renderActiveView('summary'),
      calendar: () => renderActiveView('calendar'),
      tasks: () => renderActiveView('tasks'),
      news: () => renderActiveView('news')
    },
    defaultRoute: 'summary',
    onRouteChange: (route) => {
      state.currentRoute = route;
    }
  });

  router.start();
}

export function renderActiveView(route = 'summary') {
  const container = document.getElementById('view-container');
  if (!container) return;

  state.currentRoute = route;

  if (route === 'summary') {
    container.innerHTML = renderSummaryView({
      ...(state.summary || {}),
      newsLimit: state.newsLimit,
      date: state.currentDate
    });

    const newsLimitSelect = document.getElementById('select-news-limit');
    if (newsLimitSelect) {
      newsLimitSelect.value = String(state.newsLimit);
      newsLimitSelect.addEventListener('change', async (e) => {
        const newLimit = parseInt(e.target.value, 10) || 3;
        state.newsLimit = newLimit;
        try {
          state.summary = await api.getDashboardSummary(state.currentDate, { newsLimit: state.newsLimit });
          renderActiveView('summary');
        } catch (err) {
          console.error('Error updating news limit:', err);
        }
      });
    }
  } else if (route === 'calendar') {
    const unified = state.unifiedCalendar || {
      date: state.currentDate,
      meetings: state.meetings,
      allDayEvents: [],
      projectedTasks: state.tasks,
      calendarSources: state.calendarSources
    };
    container.innerHTML = renderCalendarView(unified);
    setupCalendarControls();
  } else if (route === 'tasks') {
    container.innerHTML = renderTasksKanbanView(state.tasks, state.activeTaskFilter);
    setupKanbanControls();
  } else if (route === 'news') {
    container.innerHTML = renderNewsScreenView(state.briefing, {
      searchQuery: state.newsSearchQuery,
      selectedSource: state.newsSelectedSource
    });
    setupNewsScreenControls();
  }
}

export function setupKanbanControls() {
  const container = document.getElementById('view-container');
  if (!container) return;

  // Toggle quick add task form
  const toggleBtn = container.querySelector('#btn-toggle-task-form');
  const form = container.querySelector('#form-quick-add-task');
  const cancelBtn = container.querySelector('#btn-cancel-task');

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
      const title = form.querySelector('#task-title')?.value;
      const priority = form.querySelector('#task-priority')?.value || 'Media';
      const date = form.querySelector('#task-date')?.value || state.currentDate;
      const isFocus = Boolean(form.querySelector('#task-focus')?.checked);

      try {
        await api.createTask({
          title,
          priority,
          date,
          isFocus
        });
        form.reset();
        form.classList.add('hidden');
        await loadDashboard();
      } catch (err) {
        alert('Error al crear tarea: ' + err.message);
      }
    });
  }

  // HTML5 Drag & Drop setup
  const cards = container.querySelectorAll('.kanban-task-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  const dropzones = container.querySelectorAll('.kanban-dropzone');
  dropzones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const targetStatus = zone.dataset.columnStatus;
      if (!taskId || !targetStatus) return;

      try {
        await api.updateTask(taskId, { status: targetStatus });
        await loadDashboard();
      } catch (err) {
        alert('Error al mover tarea: ' + err.message);
      }
    });
  });

  // Accessible buttons delegation (move status, toggle focus, delete)
  container.addEventListener('click', async (e) => {
    const moveBtn = e.target.closest('.btn-move-status');
    if (moveBtn) {
      const id = moveBtn.dataset.id;
      const newStatus = moveBtn.dataset.status;
      try {
        await api.updateTask(id, { status: newStatus });
        await loadDashboard();
      } catch (err) {
        alert('Error al actualizar tarea: ' + err.message);
      }
      return;
    }

    const focusBtn = e.target.closest('.btn-toggle-focus');
    if (focusBtn) {
      const id = focusBtn.dataset.id;
      const newFocus = focusBtn.dataset.focus === 'true';
      try {
        await api.updateTask(id, { isFocus: newFocus });
        await loadDashboard();
      } catch (err) {
        alert('Error al alternar Daily Focus: ' + err.message);
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-task');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (confirm('¿Eliminar esta tarea?')) {
        try {
          await api.deleteTask(id);
          await loadDashboard();
        } catch (err) {
          alert('Error al eliminar tarea: ' + err.message);
        }
      }
    }
  });
}

export function setupNewsScreenControls() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const searchInput = container.querySelector('#input-search-news');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.newsSearchQuery = e.target.value;
      container.innerHTML = renderNewsScreenView(state.briefing, {
        searchQuery: state.newsSearchQuery,
        selectedSource: state.newsSelectedSource
      });
      setupNewsScreenControls();
      const updatedInput = container.querySelector('#input-search-news');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });
  }

  const sourceSelect = container.querySelector('#select-news-source');
  if (sourceSelect) {
    sourceSelect.addEventListener('change', (e) => {
      state.newsSelectedSource = e.target.value;
      container.innerHTML = renderNewsScreenView(state.briefing, {
        searchQuery: state.newsSearchQuery,
        selectedSource: state.newsSelectedSource
      });
      setupNewsScreenControls();
    });
  }

  const refreshBtn = container.querySelector('#btn-force-refresh-briefing');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Actualizando inteligencia...';
      try {
        state.briefing = await api.refreshBriefing(state.currentDate);
        await loadDashboard();
      } catch (err) {
        alert('Error al refrescar briefing: ' + err.message);
        refreshBtn.disabled = false;
        refreshBtn.textContent = '⚡ Refrescar Inteligencia';
      }
    });
  }
}

export function changeCurrentDate(newDate) {
  state.currentDate = newDate;
  const topDateInput = document.getElementById('dashboard-date');
  if (topDateInput) topDateInput.value = newDate;
  loadDashboard();
}

export function setupCalendarControls() {
  const prevBtn = document.getElementById('btn-calendar-prev');
  const nextBtn = document.getElementById('btn-calendar-next');
  const todayBtn = document.getElementById('btn-calendar-today');
  const dateInput = document.getElementById('calendar-date-input');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const d = new Date(state.currentDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      changeCurrentDate(d.toISOString().slice(0, 10));
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const d = new Date(state.currentDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      changeCurrentDate(d.toISOString().slice(0, 10));
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      changeCurrentDate(new Date().toISOString().slice(0, 10));
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      changeCurrentDate(e.target.value);
    });
  }

  const manageBtn = document.getElementById('btn-manage-calendars');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      openCalendarAccountsModal();
    });
  }

  // Toggle & create meeting form
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
      const entryType = document.getElementById('meeting-entry-type')?.value || 'meeting';
      const startTime = entryType === 'reminder' ? '00:00' : (document.getElementById('meeting-start')?.value || '09:00');
      const endTime = entryType === 'reminder' ? '23:59' : (document.getElementById('meeting-end')?.value || '10:00');
      const allDay = entryType === 'reminder';
      const location = document.getElementById('meeting-location')?.value || '';
      const notes = document.getElementById('meeting-notes')?.value || '';

      try {
        await api.createMeeting({
          title,
          startTime,
          endTime,
          location,
          notes,
          date: state.currentDate,
          entryType,
          allDay
        });
        form.reset();
        form.classList.add('hidden');
        await loadDashboard();
      } catch (err) {
        alert('Error al agendar compromiso: ' + err.message);
      }
    });
  }

  // Projected Tasks status switcher delegation
  const viewContainer = document.getElementById('view-container');
  if (viewContainer) {
    viewContainer.addEventListener('change', async (e) => {
      if (e.target.classList.contains('select-projected-task-status')) {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          await api.updateTask(id, { status: newStatus });
          await loadDashboard();
        } catch (err) {
          alert('Error al actualizar tarea: ' + err.message);
        }
      }
    });

    viewContainer.addEventListener('click', async (e) => {
      const deleteMeetingBtn = e.target.closest('.btn-delete-meeting');
      if (deleteMeetingBtn) {
        const id = deleteMeetingBtn.dataset.id;
        if (confirm('¿Eliminar esta reunión?')) {
          try {
            await api.deleteMeeting(id);
            await loadDashboard();
          } catch (err) {
            alert('Error al eliminar reunión: ' + err.message);
          }
        }
      }
    });
  }
}

export async function openCalendarAccountsModal() {
  let modalEl = document.getElementById('calendar-modal-container');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'calendar-modal-container';
    document.body.appendChild(modalEl);
  }

  const sources = await api.getCalendarSources().catch(() => []);
  state.calendarSources = sources;
  modalEl.innerHTML = renderCalendarModal(sources);

  const closeModal = () => {
    modalEl.innerHTML = '';
  };

  const closeBtn = modalEl.querySelector('#btn-close-modal');
  const doneBtn = modalEl.querySelector('#btn-modal-done');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (doneBtn) doneBtn.addEventListener('click', closeModal);

  // Form: add subscription
  const subForm = modalEl.querySelector('#form-add-subscription');
  if (subForm) {
    subForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalEl.querySelector('#input-sub-name')?.value?.trim();
      const url = modalEl.querySelector('#input-sub-url')?.value?.trim();
      const color = modalEl.querySelector('#input-sub-color')?.value || '#ea4335';
      try {
        const created = await api.createCalendarSource({ name, url, color, type: 'subscription' });
        const sourceId = created?.calendarSource?.id || created?.id;
        if (sourceId) {
          await api.syncCalendarSource(sourceId).catch(() => {});
        }
        await loadDashboard();
        await openCalendarAccountsModal();
      } catch (err) {
        alert('Error al agregar calendario: ' + err.message);
      }
    });
  }

  // Form: import offline .ics
  const importForm = modalEl.querySelector('#form-import-ics');
  if (importForm) {
    importForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalEl.querySelector('#input-import-name')?.value?.trim();
      const color = modalEl.querySelector('#input-import-color')?.value || '#8250df';
      const fileInput = modalEl.querySelector('#input-ics-file');
      const file = fileInput?.files?.[0];
      if (!file) {
        alert('Por favor selecciona un archivo .ics');
        return;
      }
      try {
        const icsContent = await file.text();
        await api.importCalendar({ name, color, icsContent });
        await loadDashboard();
        await openCalendarAccountsModal();
      } catch (err) {
        alert('Error al importar archivo .ics: ' + err.message);
      }
    });
  }

  // Sources list actions delegation
  const sourcesListEl = modalEl.querySelector('#calendar-sources-list');
  if (sourcesListEl) {
    sourcesListEl.addEventListener('change', async (e) => {
      if (e.target.classList.contains('toggle-source-enabled')) {
        const id = e.target.dataset.id;
        const isEnabled = e.target.checked;
        try {
          await api.updateCalendarSource(id, { is_enabled: isEnabled });
          await loadDashboard();
        } catch (err) {
          alert('Error al actualizar fuente: ' + err.message);
        }
      }
    });

    sourcesListEl.addEventListener('click', async (e) => {
      const syncBtn = e.target.closest('.btn-sync-source');
      if (syncBtn) {
        const id = syncBtn.dataset.id;
        syncBtn.textContent = '⏳';
        try {
          await api.syncCalendarSource(id);
          await loadDashboard();
          await openCalendarAccountsModal();
        } catch (err) {
          alert('Error de sincronización: ' + err.message);
          await openCalendarAccountsModal();
        }
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-source');
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (confirm('¿Eliminar este calendario y sus eventos importados?')) {
          try {
            await api.deleteCalendarSource(id);
            await loadDashboard();
            await openCalendarAccountsModal();
          } catch (err) {
            alert('Error al eliminar fuente: ' + err.message);
          }
        }
      }
    });
  }
}

// Load all dashboard components concurrently
export async function loadDashboard() {
  try {
    const [summary, briefing, meetings, tasks, unifiedCalendar] = await Promise.all([
      api.getDashboardSummary(state.currentDate, { newsLimit: state.newsLimit }).catch(() => null),
      api.getBriefing(state.currentDate).catch(() => ({ items: [], mode: 'HEURISTIC_LOCAL' })),
      api.getMeetings(state.currentDate).catch(() => []),
      api.getTasks(state.currentDate).catch(() => []),
      api.getUnifiedCalendar(state.currentDate).catch(() => null)
    ]);

    state.summary = summary;
    state.briefing = briefing;
    state.meetings = meetings;
    state.tasks = tasks;
    state.unifiedCalendar = unifiedCalendar;

    updateSummaryBar();
    updateBriefingColumn();
    updateAgendaColumn();
    updateTasksColumn();

    const currentRoute = router ? router.getCurrentRoute() : state.currentRoute;
    renderActiveView(currentRoute || 'summary');
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
  const spaContainer = document.getElementById('spa-briefing-container');
  const items = state.briefing?.items || [];

  if (badgeEl) {
    badgeEl.textContent = `${items.length} noticias`;
  }

  const html = renderBriefingView(state.briefing);
  if (container) {
    container.innerHTML = html;
  }
  if (spaContainer) {
    spaContainer.innerHTML = html;
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
  const spaContainer = document.getElementById('spa-agenda-container');
  const meetings = state.meetings || [];

  if (badgeEl) {
    badgeEl.textContent = `${meetings.length} compromisos`;
  }

  const html = renderAgendaView(meetings);
  if (container) {
    container.innerHTML = html;
  }
  if (spaContainer) {
    spaContainer.innerHTML = html;
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
  const spaContainer = document.getElementById('spa-tasks-container');
  const tasks = state.tasks || [];

  if (badgeEl) {
    badgeEl.textContent = `${tasks.length} tareas`;
  }

  const html = renderTaskView(tasks, state.activeTaskFilter);
  if (container) {
    container.innerHTML = html;
  }
  if (spaContainer) {
    spaContainer.innerHTML = html;
  }
}

// Auto-init in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initApp);
}
