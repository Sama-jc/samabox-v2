import dns from 'node:dns';
import net from 'node:net';

/**
 * SSRF Mitigation Guard Engine
 * Pure native Node.js implementation without external dependencies.
 */

export class SSRFError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SSRFError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Normalizes calendar URLs by converting webcal:// or webcals:// schemes to https://.
 */
export function normalizeCalendarUrl(rawUrl = '') {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (/^webcal:\/\//i.test(trimmed)) {
    return trimmed.replace(/^webcal:\/\//i, 'https://');
  }
  if (/^webcals:\/\//i.test(trimmed)) {
    return trimmed.replace(/^webcals:\/\//i, 'https://');
  }
  return trimmed;
}

/**
 * Parses IPv4 octets from string. Returns null if invalid.
 */
function parseIPv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) return null;
    // Disallow leading zeros (octal notation ambiguity)
    if (part.length > 1 && part.startsWith('0')) return null;
    octets.push(num);
  }
  return octets;
}

/**
 * Validates if an IPv4 octet array falls within private, loopback, or reserved ranges.
 */
function isPrivateIPv4Octets(octets) {
  const [a, b, c] = octets;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata AWS/GCP/Azure)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast 224-239)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use / Broadcast 255.255.255.255)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks whether an IP address (IPv4 or IPv6) belongs to a private, loopback,
 * link-local, cloud metadata, or reserved non-routable address space.
 */
export function isPrivateIP(ipString = '') {
  if (typeof ipString !== 'string' || !ipString.trim()) {
    return true; // Unknown / invalid inputs are blocked by default
  }

  const cleanIp = ipString.trim().toLowerCase();
  const ipVersion = net.isIP(cleanIp);

  if (ipVersion === 0) {
    return true; // Malformed or unparseable IP
  }

  // IPv4 Evaluation
  if (ipVersion === 4) {
    const octets = parseIPv4(cleanIp);
    if (!octets) return true;
    return isPrivateIPv4Octets(octets);
  }

  // IPv6 Evaluation
  if (ipVersion === 6) {
    // 1. Loopback (::1 or 0:0:0:0:0:0:0:1)
    if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return true;

    // 2. Unspecified (:: or 0:0:0:0:0:0:0:0)
    if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;

    // 3. IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    const v4MappedMatch = cleanIp.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (v4MappedMatch) {
      const v4Octets = parseIPv4(v4MappedMatch[1]);
      if (!v4Octets) return true;
      return isPrivateIPv4Octets(v4Octets);
    }

    if (cleanIp.startsWith('::ffff:') || cleanIp.startsWith('0:0:0:0:0:ffff:')) {
      // Check dotted-quad representation at the end
      const lastColonIdx = cleanIp.lastIndexOf(':');
      const suffix = cleanIp.slice(lastColonIdx + 1);
      if (suffix.includes('.')) {
        const v4Octets = parseIPv4(suffix);
        if (v4Octets && isPrivateIPv4Octets(v4Octets)) return true;
      }
    }

    // 4. Unique Local Addresses (ULA: fc00::/7 -> fc00:... to fdff:...)
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp) || cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return true;
    }

    // 5. Link-Local Unicast (fe80::/10 -> fe80:... to febf:...)
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIp) || cleanIp.startsWith('fe80:')) {
      return true;
    }

    // 6. Multicast (ff00::/8)
    if (cleanIp.startsWith('ff')) {
      return true;
    }

    // 7. Documentation (2001:db8::/32)
    if (cleanIp.startsWith('2001:db8:')) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Default production DNS resolver using Node.js dns.promises.lookup.
 */
async function defaultDnsLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true });
}

/**
 * Validates a target URL against SSRF attacks:
 * 1. Checks protocol (only https: and http: allowed; webcal:// is normalized).
 * 2. Blocks localhost and *.localhost hostnames.
 * 3. Validates direct IP hostnames against private ranges.
 * 4. Resolves domain via injectable DNS lookup and validates all resolved IPs.
 */
export async function validateUrlForSSRF(rawUrl, { dnsLookup = defaultDnsLookup } = {}) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new SSRFError('Invalid or empty URL provided.');
  }

  const normalizedUrl = normalizeCalendarUrl(rawUrl);

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch (err) {
    throw new SSRFError(`Malformed URL: ${err.message}`);
  }

  // 1. Enforce allowed protocols
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
    throw new SSRFError(`Forbidden URL scheme/protocol "${parsed.protocol}". Only HTTP, HTTPS, and Webcal are allowed.`);
  }

  const rawHostname = parsed.hostname.toLowerCase();
  // Strip IPv6 brackets [::1] -> ::1
  const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
    ? rawHostname.slice(1, -1)
    : rawHostname;

  // 2. Reject localhost and *.localhost
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new SSRFError('Access to localhost or local loopback domains is strictly forbidden.');
  }

  // 3. Direct IP address literal check
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SSRFError(`Access to private, loopback, or reserved IP address "${hostname}" is forbidden.`);
    }
    return {
      valid: true,
      hostname,
      ip: hostname,
      normalizedUrl
    };
  }

  // 4. DNS Resolution & Rebinding protection
  let addresses = [];
  try {
    const lookupResult = await dnsLookup(hostname);
    if (Array.isArray(lookupResult)) {
      addresses = lookupResult;
    } else if (lookupResult && typeof lookupResult === 'object') {
      addresses = [lookupResult];
    }
  } catch (err) {
    throw new SSRFError(`Could not resolve DNS for hostname "${hostname}": ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new SSRFError(`No IP address records found for hostname "${hostname}".`);
  }

  for (const entry of addresses) {
    const resolvedIp = typeof entry === 'string' ? entry : entry.address;
    if (isPrivateIP(resolvedIp)) {
      throw new SSRFError(`Resolved IP address "${resolvedIp}" for hostname "${hostname}" is in a private, loopback, or forbidden network range.`);
    }
  }

  const primaryIp = typeof addresses[0] === 'string' ? addresses[0] : addresses[0].address;

  return {
    valid: true,
    hostname,
    ip: primaryIp,
    normalizedUrl
  };
}

/**
 * Downloads iCal feed content safely, enforcing:
 * - Anti-SSRF URL validation before request.
 * - Maximum response timeout (8 seconds default).
 * - Maximum payload size limit (5 MB default).
 * - Secure redirection handling (re-validating every redirect target against SSRF).
 */
export async function safeFetchICS(rawUrl, {
  dnsLookup = defaultDnsLookup,
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxSizeBytes = MAX_PAYLOAD_SIZE,
  maxRedirects = 5
} = {}) {
  let currentUrl = rawUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // 1. SSRF pre-connection validation
    const validation = await validateUrlForSSRF(currentUrl, { dnsLookup });
    const targetUrl = validation.normalizedUrl;

    // 2. Set timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchFn(targetUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Samabox/2.0 (Morning Kickoff Dashboard iCal Sync)',
          'Accept': 'text/calendar, text/plain, */*'
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new SSRFError(`Request to "${targetUrl}" timed out after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // 3. Handle redirects securely
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new SSRFError(`Too many redirects (limit is ${maxRedirects}).`);
      }

      const locationHeader = response.headers.get('location');
      if (!locationHeader) {
        throw new SSRFError(`Redirect status ${response.status} returned without Location header.`);
      }

      // Resolve relative redirect against targetUrl
      currentUrl = new URL(locationHeader, targetUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new SSRFError(`Remote server returned HTTP ${response.status} ${response.statusText || ''}`);
    }

    // 4. Content length payload limit check
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
        throw new SSRFError(`Response payload size (${contentLength} bytes) exceeds maximum allowed size of 5MB.`);
      }
    }

    // 5. Read body text and enforce payload cap
    const bodyText = await response.text();
    if (Buffer.byteLength(bodyText, 'utf8') > maxSizeBytes) {
      throw new SSRFError('Response body exceeded maximum allowed payload size of 5MB.');
    }

    return bodyText;
  }

  throw new SSRFError(`Too many redirects (limit is ${maxRedirects}).`);
}
