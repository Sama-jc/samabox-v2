import { escapeHtml, sanitizeUrl } from './briefing-view.js';

/**
 * Dedicated Security Briefing Screen Component (V2)
 * Full-width executive security intelligence screen with real-time keyword search,
 * source filtering, on-demand refresh, and structured Resumen / Comentarios blocks.
 */
export function renderNewsScreenView(briefing = {}, options = {}) {
  const items = Array.isArray(briefing.items) ? briefing.items : [];
  const mode = briefing.mode || 'HEURISTIC_LOCAL';
  const searchQuery = (options.searchQuery || '').trim().toLowerCase();
  const selectedSource = (options.selectedSource || 'Todas').trim();

  // Extract unique sources for filter selector
  const availableSources = ['Todas', ...new Set(items.map(i => i.source).filter(Boolean))];

  // Apply filters
  const filteredItems = items.filter(item => {
    // 1. Source filter
    if (selectedSource && selectedSource !== 'Todas' && item.source !== selectedSource) {
      return false;
    }
    // 2. Search query filter
    if (searchQuery) {
      const titleMatch = (item.title || '').toLowerCase().includes(searchQuery);
      const summaryMatch = (item.summary || '').toLowerCase().includes(searchQuery);
      const commentaryMatch = (item.commentary || '').toLowerCase().includes(searchQuery);
      if (!titleMatch && !summaryMatch && !commentaryMatch) {
        return false;
      }
    }
    return true;
  });

  const cardsHtml = filteredItems.length > 0
    ? filteredItems.map(item => `
        <article class="news-screen-card card">
          <div class="news-card-header">
            <div class="news-meta">
              <span class="source-tag">${escapeHtml(item.source || 'Ciberseguridad')}</span>
              ${item.publishedAt ? `<span class="news-date text-muted">${new Date(item.publishedAt).toLocaleDateString()}</span>` : ''}
              <span class="badge ${item.analysisMode === 'LLM_CLOUD' ? 'badge-cloud' : 'badge-neutral'}">
                ${item.analysisMode === 'LLM_CLOUD' ? 'Cloud LLM' : 'Heurístico'}
              </span>
            </div>
          </div>

          <h3 class="news-title">
            <a href="${sanitizeUrl(item.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(item.title)}
            </a>
          </h3>

          <div class="news-blocks-container">
            <div class="news-block news-summary-block">
              <span class="block-label">Resumen a leer:</span>
              <p>${escapeHtml(item.summary || 'Sin resumen disponible.')}</p>
            </div>

            <div class="news-block news-commentary-block">
              <span class="block-label">Comentarios al respecto:</span>
              <p>${escapeHtml(item.commentary || 'Sin comentarios tácticos registrados.')}</p>
            </div>
          </div>
        </article>
      `).join('')
    : '<div class="empty-state text-muted">No se encontraron noticias de seguridad con los filtros aplicados.</div>';

  return `
    <div class="news-screen-container">
      <!-- Filter and Control Bar -->
      <div class="news-header-bar card">
        <div class="news-header-title">
          <h2>🛡️ Daily Security Briefing</h2>
          <span class="badge ${mode === 'LLM_CLOUD' ? 'badge-cloud' : 'badge-neutral'}">
            ${mode === 'LLM_CLOUD' ? 'Modo: Cloud LLM' : 'Modo: Heurístico Local'}
          </span>
        </div>

        <div class="news-filters-row">
          <div class="search-group flex-2">
            <input type="search"
                   id="input-search-news"
                   class="input-search"
                   placeholder="Buscar noticias por CVE, actor o palabra clave..."
                   value="${escapeHtml(options.searchQuery || '')}">
          </div>

          <div class="source-filter-group flex-1">
            <select id="select-news-source" class="select-source" aria-label="Filtrar por fuente">
              ${availableSources.map(s => `
                <option value="${escapeHtml(s)}" ${s === selectedSource ? 'selected' : ''}>
                  ${s === 'Todas' ? 'Todas las fuentes' : escapeHtml(s)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="news-actions">
            <button id="btn-force-refresh-briefing" class="btn btn-primary btn-sm">
              ⚡ Refrescar Inteligencia
            </button>
          </div>
        </div>
      </div>

      <!-- News Cards Feed -->
      <div class="news-feed-container">
        ${cardsHtml}
      </div>
    </div>
  `;
}
