export function escapeHtml(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeUrl(url = '') {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '#';
}

export function renderBriefingView(briefing = { items: [] }) {
  const items = briefing?.items || [];

  if (items.length === 0) {
    return `<div class="empty-state">No hay noticias de seguridad disponibles para esta fecha. Haz clic en "Actualizar Briefing".</div>`;
  }

  return items.map((item) => {
    const safeUrl = sanitizeUrl(item.url);
    const safeTitle = escapeHtml(item.title);
    const safeSource = escapeHtml(item.source);
    const safeSummary = escapeHtml(item.summary);
    const safeCommentary = escapeHtml(item.commentary);
    const safeMode = item.analysisMode === 'LLM_CLOUD' ? 'Cloud LLM' : 'Heurístico Local';
    const modeBadgeClass = item.analysisMode === 'LLM_CLOUD' ? 'badge-cloud' : 'badge-heuristic';

    const formattedDate = item.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    return `
      <article class="card briefing-card" data-id="${escapeHtml(item.id)}">
        <header class="briefing-card-header">
          <div class="briefing-meta">
            <span class="metric-badge ${modeBadgeClass}">${safeMode}</span>
            <span><strong>${safeSource}</strong></span>
            ${formattedDate ? `<span>&bull; ${escapeHtml(formattedDate)}</span>` : ''}
          </div>
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="briefing-title">
            ${safeTitle} ↗
          </a>
        </header>

        <section class="briefing-section">
          <div class="briefing-section-title">📖 Resumen a leer</div>
          <p class="briefing-text">${safeSummary}</p>
        </section>

        <section class="briefing-section commentary-section">
          <div class="briefing-section-title">🛡️ Comentarios al respecto (Impacto y Mitigación)</div>
          <p class="briefing-text">${safeCommentary}</p>
        </section>
      </article>
    `;
  }).join('');
}
