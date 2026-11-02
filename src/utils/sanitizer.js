/**
 * Samabox Sanitizer Utility
 * Operational hardening for untrusted external RSS feeds and user content.
 */

const NAMED_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&mdash;': '—',
  '&ndash;': '–'
};

/**
 * Safely decodes HTML entities (named, decimal, hex).
 */
export function decodeHtmlEntities(text = '') {
  if (typeof text !== 'string') return '';

  let decoded = text;

  // Replace common named entities
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    decoded = decoded.replaceAll(entity, char);
  }

  // Decimal entities: &#65;
  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
    try {
      const code = parseInt(dec, 10);
      return String.fromCodePoint(code);
    } catch {
      return '';
    }
  });

  // Hexadecimal entities: &#x41; or &#X41;
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCodePoint(code);
    } catch {
      return '';
    }
  });

  return decoded;
}

/**
 * Robustly strips HTML tags, script/style blocks, unwraps CDATA,
 * and decodes HTML entities into clean plaintext.
 */
export function stripHtmlTags(raw = '') {
  if (typeof raw !== 'string') return '';

  // 1. Unwrap CDATA sections
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

  // 2. Strip <script> ... </script> and content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');

  // 3. Strip <style> ... </style> and content
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // 4. Strip all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. Decode HTML entities
  text = decodeHtmlEntities(text);

  // 6. Strip any residual or decoded HTML tags (e.g. from &lt;b&gt;)
  text = text.replace(/<[^>]+>/g, ' ');

  // 7. Collapse duplicate whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Alias for stripHtmlTags for compatibility.
 */
export const cleanHtmlText = stripHtmlTags;

/**
 * Checks if a URL has an allowed safe protocol (http/https).
 */
export function isSafeUrl(url = '', allowedProtocols = ['http:', 'https:']) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return allowedProtocols.includes(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Sanitizes external URLs, guaranteeing only valid http: or https: URLs are returned.
 * Returns fallback (default '#') if unsafe or invalid.
 */
export function sanitizeUrl(url = '', fallback = '#') {
  if (isSafeUrl(url)) {
    return url.trim();
  }
  return fallback;
}

/**
 * Escapes characters for safe inclusion within HTML markup.
 */
export function escapeHtml(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
