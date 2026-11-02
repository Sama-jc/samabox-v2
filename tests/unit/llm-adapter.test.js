import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LLMAdapter, generateHeuristicAnalysis } from '../../src/adapters/llm-adapter.js';

describe('LLMAdapter & Heuristic Engine', () => {
  describe('generateHeuristicAnalysis', () => {
    it('should generate zero-day / CVE specific analysis', () => {
      const item = {
        title: 'Zero-day flaw in VPN appliance allows RCE (CVE-2026-999)',
        contentSnippet: 'Exploitation allows unauthenticated remote attackers to execute arbitrary commands.'
      };
      const result = generateHeuristicAnalysis(item);
      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.summary.length > 20, 'Summary must not be empty');
      assert.ok(result.commentary.length > 20, 'Commentary must not be empty');
      assert.ok(result.commentary.toLowerCase().includes('parche') || result.commentary.toLowerCase().includes('crítico'));
    });

    it('should generate ransomware specific analysis', () => {
      const item = {
        title: 'New Ransomware variant encrypts healthcare networks',
        contentSnippet: 'Double extortion group threatens data leak.'
      };
      const result = generateHeuristicAnalysis(item);
      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.commentary.toLowerCase().includes('backup') || result.commentary.toLowerCase().includes('copias'));
    });

    it('should generate phishing / identity specific analysis', () => {
      const item = {
        title: 'AiTM Phishing campaign bypasses MFA tokens',
        contentSnippet: 'Reverse proxy captures session cookies.'
      };
      const result = generateHeuristicAnalysis(item);
      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.commentary.toLowerCase().includes('identidad') || result.commentary.toLowerCase().includes('mfa'));
    });

    it('should generate supply chain specific analysis', () => {
      const item = {
        title: 'Malicious npm package injects backdoor in supply chain',
        contentSnippet: 'Package compromised through maintainer account takeover.'
      };
      const result = generateHeuristicAnalysis(item);
      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.commentary.toLowerCase().includes('dependencia') || result.commentary.toLowerCase().includes('código'));
    });
  });

  describe('analyzeNewsItem', () => {
    it('should use heuristic local mode when no apiKey is configured', async () => {
      const adapter = new LLMAdapter({ apiKey: '' });
      const item = {
        title: 'Critical CVE Vulnerability in Cloud Gateway',
        contentSnippet: 'Vulnerability details disclosed.'
      };

      const result = await adapter.analyzeNewsItem(item);
      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.summary);
      assert.ok(result.commentary);
    });

    it('should call remote LLM and return LLM_CLOUD mode when apiKey is present and call succeeds', async () => {
      const mockFetch = async (url, options) => {
        assert.ok(url.includes('/chat/completions'));
        assert.equal(options.headers.Authorization, 'Bearer test-api-key');
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: 'Resumen ejecutivo generado por IA sobre la noticia.',
                    commentary: 'Análisis táctico: revisar la configuración de seguridad y aislar el servicio.'
                  })
                }
              }
            ]
          })
        };
      };

      const adapter = new LLMAdapter({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.openai.test/v1',
        model: 'test-model',
        fetchFn: mockFetch
      });

      const result = await adapter.analyzeNewsItem({
        title: 'Zero-day vulnerability',
        contentSnippet: 'Snippet text'
      });

      assert.equal(result.analysisMode, 'LLM_CLOUD');
      assert.equal(result.summary, 'Resumen ejecutivo generado por IA sobre la noticia.');
      assert.equal(result.commentary, 'Análisis táctico: revisar la configuración de seguridad y aislar el servicio.');
    });

    it('should gracefully fallback to HEURISTIC_LOCAL when remote LLM call fails or times out', async () => {
      const failingFetch = async () => {
        throw new Error('500 Internal Server Error from LLM provider');
      };

      const adapter = new LLMAdapter({
        apiKey: 'test-api-key',
        fetchFn: failingFetch
      });

      const result = await adapter.analyzeNewsItem({
        title: 'Ransomware outbreak in hospital sector',
        contentSnippet: 'Operations disrupted.'
      });

      assert.equal(result.analysisMode, 'HEURISTIC_LOCAL');
      assert.ok(result.summary);
      assert.ok(result.commentary);
    });
  });
});
