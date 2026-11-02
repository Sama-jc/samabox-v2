import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHtmlText,
  stripHtmlTags,
  sanitizeUrl,
  isSafeUrl,
  decodeHtmlEntities,
  escapeHtml
} from '../../src/utils/sanitizer.js';

describe('Sanitizer Utility', () => {
  describe('stripHtmlTags / cleanHtmlText', () => {
    it('should strip standard HTML tags and collapse whitespace', () => {
      const input = '<p>Critical <strong>vulnerability</strong> discovered in   OpenSSL.</p>';
      const expected = 'Critical vulnerability discovered in OpenSSL.';
      assert.strictEqual(stripHtmlTags(input), expected);
      assert.strictEqual(cleanHtmlText(input), expected);
    });

    it('should unwrap CDATA content cleanly', () => {
      const input = '<title><![CDATA[Ransomware Campaign Targets Healthcare]]></title>';
      assert.strictEqual(stripHtmlTags(input), 'Ransomware Campaign Targets Healthcare');
    });

    it('should strip <script> tags and their dangerous executable content', () => {
      const input = '<div>Normal news <script>alert("xssAttack()"); document.location="evil.com";</script>continues here.</div>';
      assert.strictEqual(stripHtmlTags(input), 'Normal news continues here.');
    });

    it('should strip <style> blocks and their content', () => {
      const input = 'Header <style>body { display: none; }</style>Content';
      assert.strictEqual(stripHtmlTags(input), 'Header Content');
    });

    it('should remove malicious event attributes and self-closing tags', () => {
      const input = 'Alert <img src="x" onerror="evil()" /> found';
      assert.strictEqual(stripHtmlTags(input), 'Alert found');
    });

    it('should decode named, decimal, and hex HTML entities', () => {
      const input = '&lt;b&gt;LockBit &amp; BlackCat&lt;/b&gt; &#39;affiliates&#39; &#x22;warned&#x22; &nbsp; &copy;';
      const output = cleanHtmlText(input);
      assert.strictEqual(output, 'LockBit & BlackCat \'affiliates\' "warned" ©');
    });

    it('should handle empty, null, undefined or non-string gracefully', () => {
      assert.strictEqual(stripHtmlTags(''), '');
      assert.strictEqual(stripHtmlTags(null), '');
      assert.strictEqual(stripHtmlTags(undefined), '');
      assert.strictEqual(stripHtmlTags(12345), '');
    });
  });

  describe('decodeHtmlEntities', () => {
    it('should decode entities correctly', () => {
      assert.strictEqual(decodeHtmlEntities('Tom &amp; Jerry'), 'Tom & Jerry');
      assert.strictEqual(decodeHtmlEntities('&#65;lice in &#x57;onderland'), 'Alice in Wonderland');
    });
  });

  describe('sanitizeUrl and isSafeUrl', () => {
    it('should allow valid http and https URLs', () => {
      assert.strictEqual(sanitizeUrl('https://thehackernews.com/2026/05/cve.html'), 'https://thehackernews.com/2026/05/cve.html');
      assert.strictEqual(sanitizeUrl('http://cisa.gov/alerts/123'), 'http://cisa.gov/alerts/123');
      assert.strictEqual(isSafeUrl('https://bleepingcomputer.com'), true);
      assert.strictEqual(isSafeUrl('http://insecure.org'), true);
    });

    it('should reject javascript:, data:, vbscript:, and file: URLs', () => {
      assert.strictEqual(isSafeUrl('javascript:alert(1)'), false);
      assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');

      assert.strictEqual(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), false);
      assert.strictEqual(sanitizeUrl('data:text/html,...'), '#');

      assert.strictEqual(isSafeUrl('vbscript:msgbox("test")'), false);
      assert.strictEqual(sanitizeUrl('vbscript:msgbox("test")'), '#');

      assert.strictEqual(isSafeUrl('file:///etc/passwd'), false);
      assert.strictEqual(sanitizeUrl('file:///etc/passwd'), '#');
    });

    it('should reject invalid or non-string inputs', () => {
      assert.strictEqual(isSafeUrl(null), false);
      assert.strictEqual(isSafeUrl('not a url'), false);
      assert.strictEqual(sanitizeUrl(null), '#');
      assert.strictEqual(sanitizeUrl(undefined), '#');
      assert.strictEqual(sanitizeUrl(''), '#');
    });
  });

  describe('escapeHtml', () => {
    it('should escape dangerous characters for safe HTML inclusion', () => {
      const input = '<script>alert("XSS & attack\'s")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; attack&#39;s&quot;)&lt;/script&gt;';
      assert.strictEqual(escapeHtml(input), expected);
    });

    it('should handle non-strings safely', () => {
      assert.strictEqual(escapeHtml(null), '');
      assert.strictEqual(escapeHtml(undefined), '');
    });
  });
});
