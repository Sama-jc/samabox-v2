import { escapeHtml } from './briefing-view.js';

/**
 * Calendar Accounts Manager Modal Component (V2)
 * Manages iCal URL subscriptions and manual offline .ics file imports.
 */
export function renderCalendarModal(sources = []) {
  const sourcesList = Array.isArray(sources) ? sources : [];

  const sourcesRowsHtml = sourcesList.length > 0
    ? sourcesList.map(source => {
        const isEnabled = Boolean(source.is_enabled);
        const color = source.color || '#388bfd';
        const isSubscription = source.type === 'subscription';

        return `
          <div class="calendar-source-item" data-id="${escapeHtml(source.id)}">
            <div class="source-info">
              <span class="color-swatch" style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; display: inline-block;"></span>
              <strong class="source-name">${escapeHtml(source.name)}</strong>
              <span class="badge badge-neutral">${isSubscription ? 'URL iCal' : 'Archivo Local'}</span>
              ${source.sync_status === 'error'
                ? `<span class="badge badge-warning" title="${escapeHtml(source.sync_error || 'Error de sincronización')}">Error</span>`
                : ''}
              ${source.last_synced_at
                ? `<small class="text-muted">Sync: ${new Date(source.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>`
                : ''}
            </div>

            <div class="source-actions">
              <label class="switch-label">
                <input type="checkbox" class="toggle-source-enabled" data-id="${escapeHtml(source.id)}" ${isEnabled ? 'checked' : ''}>
                <span class="switch-text">${isEnabled ? 'Activo' : 'Pausado'}</span>
              </label>

              ${isSubscription ? `
                <button class="btn btn-sm btn-icon btn-sync-source" data-id="${escapeHtml(source.id)}" title="Sincronizar ahora">
                  🔄
                </button>
              ` : ''}

              <button class="btn btn-sm btn-icon btn-danger btn-delete-source" data-id="${escapeHtml(source.id)}" title="Eliminar calendario">
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state text-muted">No hay calendarios externos conectados.</div>';

  return `
    <div id="calendar-modal" class="modal-backdrop calendar-modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-calendar-title">
      <div class="modal-card card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-icon">📅</span>
            <h2 id="modal-calendar-title">Gestión de Calendarios y Cuentas</h2>
          </div>
          <button id="btn-close-modal" class="btn btn-icon btn-close" aria-label="Cerrar modal">✕</button>
        </div>

        <div class="modal-body">
          <!-- Section 1: Add iCal URL Subscription -->
          <details class="modal-section-details" open>
            <summary class="details-summary"><strong>🔗 Conectar Suscripción iCal (URL)</strong></summary>
            <form id="form-add-subscription" class="form-panel form-subscription" style="margin-top: 0.75rem;">
              <div class="form-row">
                <div class="form-group flex-2">
                  <label for="input-sub-name">Nombre de la cuenta:</label>
                  <input type="text" id="input-sub-name" required placeholder="Ej: Google SecOps / Outlook Empresa">
                </div>
                <div class="form-group flex-1">
                  <label for="input-sub-color">Color distintivo:</label>
                  <input type="color" id="input-sub-color" value="#ea4335">
                </div>
              </div>
              <div class="form-group">
                <label for="input-sub-url">URL de suscripción iCal (webcal:// o https://):</label>
                <input type="url" id="input-sub-url" required placeholder="https://calendar.google.com/calendar/ical/.../basic.ics">
              </div>
              <button type="submit" class="btn btn-primary btn-sm">➕ Añadir y Sincronizar</button>
            </form>
          </details>

          <!-- Section 2: Upload Offline .ics File -->
          <details class="modal-section-details" style="margin-top: 1rem;">
            <summary class="details-summary"><strong>📁 Importar Archivo .ics Local (Offline)</strong></summary>
            <form id="form-import-ics" class="form-panel form-upload-ics" style="margin-top: 0.75rem;">
              <div class="form-row">
                <div class="form-group flex-2">
                  <label for="input-import-name">Nombre del calendario:</label>
                  <input type="text" id="input-import-name" required placeholder="Ej: Eventos Conferencia Offline">
                </div>
                <div class="form-group flex-1">
                  <label for="input-import-color">Color distintivo:</label>
                  <input type="color" id="input-import-color" value="#8250df">
                </div>
              </div>
              <div class="form-group">
                <label for="input-ics-file">Seleccionar archivo .ics:</label>
                <input type="file" id="input-ics-file" accept=".ics,text/calendar" required>
              </div>
              <button type="submit" class="btn btn-secondary btn-sm">📥 Importar Archivo Offline</button>
            </form>
          </details>

          <!-- Section 3: Connected Sources List -->
          <div class="modal-section" style="margin-top: 1.5rem;">
            <h3 class="section-title">Calendarios Conectados</h3>
            <div id="calendar-sources-list" class="calendar-sources-list">
              ${sourcesRowsHtml}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button id="btn-modal-done" class="btn btn-primary">Listo</button>
        </div>
      </div>
    </div>
  `;
}
