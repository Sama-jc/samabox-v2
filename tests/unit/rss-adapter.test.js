import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RSSAdapter,
  parseRssXml,
  parseAtomXml,
  CURATED_SECURITY_NEWS
} from '../../src/adapters/rss-adapter.js';

describe('RSSAdapter', () => {
  const sampleRssXml = `
    <rss version="2.0">
      <channel>
        <title>The Hacker News</title>
        <link>https://thehackernews.com</link>
        <item>
          <title><![CDATA[Critical Zero-Day in Gateway Controller Exploit Active]]></title>
          <link>https://thehackernews.com/2026/11/gateway-zero-day.html</link>
          <pubDate>Mon, 02 Nov 2026 07:30:00 +0000</pubDate>
          <description><![CDATA[<p>Security researchers discovered active exploitation of an unauthenticated RCE flaw.</p>]]></description>
        </item>
        <item>
          <title>Supply Chain Backdoor Found in Popular Open Source Repository</title>
          <link>https://thehackernews.com/2026/11/supply-chain-backdoor.html</link>
          <pubDate>Mon, 02 Nov 2026 08:15:00 +0000</pubDate>
          <description>Attackers injected malicious obfuscated payloads into core dependency modules.</description>
        </item>
      </channel>
    </rss>
  `;

  const sampleAtomXml = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>CISA Cybersecurity Advisories</title>
      <entry>
        <title>AA26-306A: Phishing Campaign Targeting Industrial Infrastructure</title>
        <link rel="alternate" type="text/html" href="https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-306a" />
        <id>urn:cisa:aa26-306a</id>
        <updated>2026-11-02T06:00:00Z</updated>
        <summary>CISA and international partners released a joint advisory warning of credential harvesting.</summary>
      </entry>
    </feed>
  `;

  describe('XML Parsers', () => {
    it('should parse RSS 2.0 items including CDATA and strip HTML from descriptions', () => {
      const items = parseRssXml(sampleRssXml, 'The Hacker News');
      assert.equal(items.length, 2);
      assert.equal(items[0].title, 'Critical Zero-Day in Gateway Controller Exploit Active');
      assert.equal(items[0].url, 'https://thehackernews.com/2026/11/gateway-zero-day.html');
      assert.equal(items[0].source, 'The Hacker News');
      assert.equal(items[0].contentSnippet, 'Security researchers discovered active exploitation of an unauthenticated RCE flaw.');
      assert.ok(items[0].publishedAt);
    });

    it('should parse Atom entries extracting link href and summary', () => {
      const items = parseAtomXml(sampleAtomXml, 'CISA Alerts');
      assert.equal(items.length, 1);
      assert.equal(items[0].title, 'AA26-306A: Phishing Campaign Targeting Industrial Infrastructure');
      assert.equal(items[0].url, 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-306a');
      assert.equal(items[0].source, 'CISA Alerts');
      assert.equal(items[0].contentSnippet, 'CISA and international partners released a joint advisory warning of credential harvesting.');
      assert.ok(items[0].publishedAt.startsWith('2026-11-02T06:00:00'));
    });
  });

  describe('fetchNews', () => {
    it('should return parsed remote news when feeds succeed', async () => {
      const mockFetch = async (url) => {
        if (url.includes('hackernews')) {
          return { ok: true, text: async () => sampleRssXml };
        }
        if (url.includes('cisa')) {
          return { ok: true, text: async () => sampleAtomXml };
        }
        throw new Error('Unknown feed');
      };

      const adapter = new RSSAdapter({
        fetchFn: mockFetch,
        feedUrls: [
          { url: 'https://thehackernews.com/rss', source: 'The Hacker News', type: 'rss' },
          { url: 'https://cisa.gov/atom', source: 'CISA Alerts', type: 'atom' }
        ]
      });

      const news = await adapter.fetchNews();
      assert.ok(news.length >= 3);
      assert.equal(news[0].title, 'Critical Zero-Day in Gateway Controller Exploit Active');
      assert.equal(news[1].title, 'Supply Chain Backdoor Found in Popular Open Source Repository');
      assert.equal(news[2].title, 'AA26-306A: Phishing Campaign Targeting Industrial Infrastructure');
    });

    it('should gracefully fall back to curated catalog when all feeds fail', async () => {
      const failingFetch = async () => {
        throw new Error('Network timeout / connection refused');
      };

      const adapter = new RSSAdapter({
        fetchFn: failingFetch,
        feedUrls: [{ url: 'https://offline-source.local/rss', source: 'Offline Feed' }]
      });

      const news = await adapter.fetchNews();
      assert.ok(news.length >= 3, 'Must return at least 3 curated items');
      assert.ok(news.some((n) => n.title.includes('Zero-day') || n.title.includes('Ransomware') || n.title.includes('CISA')));
    });

    it('should supplement curated items if remote feeds return fewer than 3 items', async () => {
      // Feed returns only 1 item
      const mockFetch = async () => ({
        ok: true,
        text: async () => sampleAtomXml
      });

      const adapter = new RSSAdapter({
        fetchFn: mockFetch,
        feedUrls: [{ url: 'https://cisa.gov/atom', source: 'CISA Alerts', type: 'atom' }]
      });

      const news = await adapter.fetchNews();
      assert.ok(news.length >= 3, 'Must supplement to at least 3 items');
      assert.equal(news[0].title, 'AA26-306A: Phishing Campaign Targeting Industrial Infrastructure');
    });
  });
});
