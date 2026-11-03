import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCalendarUrl,
  isPrivateIP,
  validateUrlForSSRF,
  safeFetchICS,
  SSRFError
} from '../../src/domain/ssrf-guard.js';

describe('SSRF Mitigation Engine (ssrf-guard.js)', () => {
  describe('normalizeCalendarUrl', () => {
    it('should normalize webcal:// to https://', () => {
      assert.equal(
        normalizeCalendarUrl('webcal://calendar.google.com/feed.ics'),
        'https://calendar.google.com/feed.ics'
      );
    });

    it('should normalize uppercase WEBCAL:// to https://', () => {
      assert.equal(
        normalizeCalendarUrl('WEBCAL://CALENDAR.EXAMPLE.COM/CAL'),
        'https://CALENDAR.EXAMPLE.COM/CAL'
      );
    });

    it('should preserve valid https:// and http:// URLs', () => {
      assert.equal(
        normalizeCalendarUrl('https://example.com/calendar.ics'),
        'https://example.com/calendar.ics'
      );
      assert.equal(
        normalizeCalendarUrl('http://example.com/calendar.ics'),
        'http://example.com/calendar.ics'
      );
    });

    it('should trim surrounding whitespace', () => {
      assert.equal(
        normalizeCalendarUrl('   webcal://example.com/events.ics   '),
        'https://example.com/events.ics'
      );
    });
  });

  describe('isPrivateIP', () => {
    it('should identify IPv4 loopback (127.0.0.0/8)', () => {
      assert.equal(isPrivateIP('127.0.0.1'), true);
      assert.equal(isPrivateIP('127.0.0.2'), true);
      assert.equal(isPrivateIP('127.255.255.255'), true);
    });

    it('should identify RFC 1918 10.0.0.0/8', () => {
      assert.equal(isPrivateIP('10.0.0.1'), true);
      assert.equal(isPrivateIP('10.254.1.1'), true);
      assert.equal(isPrivateIP('10.255.255.255'), true);
    });

    it('should identify RFC 1918 172.16.0.0/12', () => {
      assert.equal(isPrivateIP('172.16.0.1'), true);
      assert.equal(isPrivateIP('172.24.10.5'), true);
      assert.equal(isPrivateIP('172.31.255.255'), true);
      // Boundaries
      assert.equal(isPrivateIP('172.15.255.255'), false);
      assert.equal(isPrivateIP('172.32.0.1'), false);
    });

    it('should identify RFC 1918 192.168.0.0/16', () => {
      assert.equal(isPrivateIP('192.168.0.1'), true);
      assert.equal(isPrivateIP('192.168.1.100'), true);
      assert.equal(isPrivateIP('192.168.255.255'), true);
    });

    it('should identify Link-Local and Cloud Metadata (169.254.0.0/16)', () => {
      assert.equal(isPrivateIP('169.254.169.254'), true);
      assert.equal(isPrivateIP('169.254.1.1'), true);
      assert.equal(isPrivateIP('169.254.255.255'), true);
    });

    it('should identify 0.0.0.0/8, CG-NAT (100.64.0.0/10), Broadcast and Multicast', () => {
      assert.equal(isPrivateIP('0.0.0.0'), true);
      assert.equal(isPrivateIP('0.1.2.3'), true);
      assert.equal(isPrivateIP('100.64.0.1'), true);
      assert.equal(isPrivateIP('100.127.255.255'), true);
      assert.equal(isPrivateIP('100.63.255.255'), false);
      assert.equal(isPrivateIP('100.128.0.1'), false);
      assert.equal(isPrivateIP('224.0.0.1'), true);
      assert.equal(isPrivateIP('240.0.0.1'), true);
      assert.equal(isPrivateIP('255.255.255.255'), true);
    });

    it('should return false for valid public IPv4 addresses', () => {
      assert.equal(isPrivateIP('8.8.8.8'), false);
      assert.equal(isPrivateIP('1.1.1.1'), false);
      assert.equal(isPrivateIP('93.184.216.34'), false);
      assert.equal(isPrivateIP('142.250.180.46'), false);
    });

    it('should identify IPv6 loopback (::1) and unspecified (::)', () => {
      assert.equal(isPrivateIP('::1'), true);
      assert.equal(isPrivateIP('0:0:0:0:0:0:0:1'), true);
      assert.equal(isPrivateIP('::'), true);
      assert.equal(isPrivateIP('0:0:0:0:0:0:0:0'), true);
    });

    it('should identify IPv6 Unique Local Addresses (fc00::/7)', () => {
      assert.equal(isPrivateIP('fc00::1'), true);
      assert.equal(isPrivateIP('fd12:3456:789a::1'), true);
    });

    it('should identify IPv6 Link-Local (fe80::/10)', () => {
      assert.equal(isPrivateIP('fe80::1'), true);
      assert.equal(isPrivateIP('fe80::200:5aee:feaa:20a2'), true);
    });

    it('should identify IPv4-mapped IPv6 addresses for private ranges', () => {
      assert.equal(isPrivateIP('::ffff:127.0.0.1'), true);
      assert.equal(isPrivateIP('::ffff:10.0.0.1'), true);
      assert.equal(isPrivateIP('::ffff:169.254.169.254'), true);
      assert.equal(isPrivateIP('::ffff:192.168.1.1'), true);
      assert.equal(isPrivateIP('::ffff:8.8.8.8'), false);
    });

    it('should return false for public IPv6 addresses', () => {
      assert.equal(isPrivateIP('2606:4700:4700::1111'), false);
      assert.equal(isPrivateIP('2001:4860:4860::8888'), false);
    });

    it('should return true for invalid or unparseable IP input', () => {
      assert.equal(isPrivateIP('invalid-ip'), true);
      assert.equal(isPrivateIP(''), true);
      assert.equal(isPrivateIP(null), true);
    });
  });

  describe('validateUrlForSSRF', () => {
    it('should reject unsafe protocols (file, ftp, javascript, data, gopher)', async () => {
      const unsafe = [
        'file:///etc/passwd',
        'ftp://server/file',
        'javascript:alert(1)',
        'data:text/calendar,...',
        'gopher://gopher.floodgap.com/'
      ];

      for (const u of unsafe) {
        await assert.rejects(
          async () => validateUrlForSSRF(u),
          (err) => err instanceof SSRFError && /protocol|scheme/i.test(err.message),
          `Expected ${u} to be rejected with SSRFError`
        );
      }
    });

    it('should reject localhost and *.localhost domains immediately', async () => {
      const targets = [
        'http://localhost/cal.ics',
        'https://localhost:8080/events',
        'http://app.localhost/feed'
      ];

      for (const t of targets) {
        await assert.rejects(
          async () => validateUrlForSSRF(t),
          (err) => err instanceof SSRFError && /localhost/i.test(err.message),
          `Expected ${t} to be rejected`
        );
      }
    });

    it('should reject direct private IP literals in URL', async () => {
      const directIPs = [
        'http://127.0.0.1/cal.ics',
        'http://169.254.169.254/latest/meta-data',
        'https://10.0.1.2/events.ics',
        'http://192.168.1.1/cal.ics',
        'http://[::1]/cal.ics',
        'http://[fe80::1]/cal.ics'
      ];

      for (const ipUrl of directIPs) {
        await assert.rejects(
          async () => validateUrlForSSRF(ipUrl),
          (err) => err instanceof SSRFError,
          `Expected ${ipUrl} to be rejected`
        );
      }
    });

    it('should support injectable dnsLookup and block domains resolving to private IPs', async () => {
      // Mock DNS resolver returning AWS metadata IP
      const mockCloudMetadataDns = async () => [{ address: '169.254.169.254', family: 4 }];

      await assert.rejects(
        async () => validateUrlForSSRF('https://evil-cloud-hack.com/cal.ics', { dnsLookup: mockCloudMetadataDns }),
        (err) => err instanceof SSRFError && /private|forbidden/i.test(err.message)
      );

      // Mock DNS resolver returning loopback
      const mockLoopbackDns = async () => [{ address: '127.0.0.1', family: 4 }];

      await assert.rejects(
        async () => validateUrlForSSRF('https://sneaky-localhost.com/feed', { dnsLookup: mockLoopbackDns }),
        (err) => err instanceof SSRFError
      );

      // Mock DNS resolver returning private 10.x.x.x
      const mockInternalDns = async () => [{ address: '10.50.1.10', family: 4 }];

      await assert.rejects(
        async () => validateUrlForSSRF('https://internal.corp/cal.ics', { dnsLookup: mockInternalDns }),
        (err) => err instanceof SSRFError
      );
    });

    it('should support injectable dnsLookup and accept domains resolving to public IPs', async () => {
      const mockPublicDns = async () => [{ address: '93.184.216.34', family: 4 }];

      const validated = await validateUrlForSSRF('https://calendar.example.com/public.ics', {
        dnsLookup: mockPublicDns
      });

      assert.equal(validated.valid, true);
      assert.equal(validated.hostname, 'calendar.example.com');
      assert.equal(validated.ip, '93.184.216.34');
      assert.equal(validated.normalizedUrl, 'https://calendar.example.com/public.ics');
    });

    it('should normalize webcal:// scheme before validating', async () => {
      const mockPublicDns = async () => [{ address: '142.250.180.46', family: 4 }];

      const validated = await validateUrlForSSRF('webcal://calendar.google.com/events.ics', {
        dnsLookup: mockPublicDns
      });

      assert.equal(validated.valid, true);
      assert.equal(validated.normalizedUrl, 'https://calendar.google.com/events.ics');
    });

    it('should reject unresolvable hostnames', async () => {
      const mockFailingDns = async () => {
        const err = new Error('getaddrinfo ENOTFOUND nxdomain.invalid');
        err.code = 'ENOTFOUND';
        throw err;
      };

      await assert.rejects(
        async () => validateUrlForSSRF('https://nxdomain.invalid/cal.ics', { dnsLookup: mockFailingDns }),
        (err) => err instanceof SSRFError && /resolve|DNS/i.test(err.message)
      );
    });
  });

  describe('safeFetchICS', () => {
    it('should reject SSRF attempts before any HTTP request is performed', async () => {
      let fetchCalled = false;
      const mockFetch = async () => {
        fetchCalled = true;
        return new Response('ok');
      };

      await assert.rejects(
        async () => safeFetchICS('http://169.254.169.254/latest/meta-data', { fetchFn: mockFetch }),
        (err) => err instanceof SSRFError
      );

      assert.equal(fetchCalled, false, 'Fetch should NEVER be called for blocked SSRF URL');
    });

    it('should download ICS content when URL resolves to public IP', async () => {
      const sampleIcs = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      const mockDns = async () => [{ address: '93.184.216.34', family: 4 }];
      const mockFetch = async (url) => {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': String(sampleIcs.length) }),
          text: async () => sampleIcs
        };
      };

      const content = await safeFetchICS('https://calendar.example.com/feed.ics', {
        dnsLookup: mockDns,
        fetchFn: mockFetch
      });

      assert.equal(content, sampleIcs);
    });

    it('should enforce max payload size (5MB) via content-length header', async () => {
      const mockDns = async () => [{ address: '93.184.216.34', family: 4 }];
      const hugeSize = 6 * 1024 * 1024; // 6 MB
      const mockFetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(hugeSize) }),
        text: async () => 'huge'
      });

      await assert.rejects(
        async () => safeFetchICS('https://calendar.example.com/huge.ics', {
          dnsLookup: mockDns,
          fetchFn: mockFetch
        }),
        (err) => err instanceof SSRFError && /payload|size|5MB/i.test(err.message)
      );
    });

    it('should validate redirect target against SSRF before following', async () => {
      const mockDns = async (host) => {
        if (host === 'legit.com') return [{ address: '93.184.216.34', family: 4 }];
        if (host === 'evil.internal') return [{ address: '127.0.0.1', family: 4 }];
        return [{ address: '93.184.216.34', family: 4 }];
      };

      const mockFetch = async (url) => {
        if (url.includes('legit.com')) {
          return {
            status: 302,
            headers: new Headers({ location: 'http://127.0.0.1/secret.ics' })
          };
        }
        return { ok: true, status: 200, text: async () => 'secret' };
      };

      await assert.rejects(
        async () => safeFetchICS('https://legit.com/cal.ics', {
          dnsLookup: mockDns,
          fetchFn: mockFetch
        }),
        (err) => err instanceof SSRFError && /private|forbidden|SSRF/i.test(err.message)
      );
    });
  });
});
