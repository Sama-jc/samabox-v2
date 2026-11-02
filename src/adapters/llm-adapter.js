export function generateHeuristicAnalysis(item = {}) {
  const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();

  // 1. Zero-day & Vulnerabilidades Críticas / RCE
  if (
    text.includes('zero-day') ||
    text.includes('0-day') ||
    text.includes('cve-') ||
    text.includes('rce') ||
    text.includes('remote code execution') ||
    text.includes('vulnerab')
  ) {
    return {
      summary: `Vulnerabilidad crítica reportada en "${item.title}". Los informes técnicos señalan vectores de explotación remota no autenticada capaces de otorgar control sobre la infraestructura perimetral o servicios centrales.`,
      commentary: `Impacto Crítico: Se recomienda inventariar de inmediato versiones instaladas, aplicar los parches oficiales de emergencia o reglas WAF/IPS de mitigación, y restringir interfaces de gestión expuestas a redes públicas.`,
      analysisMode: 'HEURISTIC_LOCAL'
    };
  }

  // 2. Ransomware y Extorsión
  if (
    text.includes('ransomware') ||
    text.includes('extortion') ||
    text.includes('extorsión') ||
    text.includes('cifrado') ||
    text.includes('lockbit') ||
    text.includes('leak')
  ) {
    return {
      summary: `Alerta de ransomware y extorsión vinculada a: "${item.title}". Las tácticas detectadas incluyen acceso inicial sigiloso, exfiltración previa de activos y cifrado masivo de sistemas de producción.`,
      commentary: `Riesgo de Continuidad Operativa: Es prioritario verificar el aislamiento e inmutabilidad de las copias de seguridad (backups offline), auditar cuentas con privilegios administrativos y monitorear telemetría de endpoints ante creación anómala de procesos.`,
      analysisMode: 'HEURISTIC_LOCAL'
    };
  }

  // 3. Phishing, Robo de Identidad y Evasión MFA
  if (
    text.includes('phishing') ||
    text.includes('mfa') ||
    text.includes('aitm') ||
    text.includes('credential') ||
    text.includes('identidad') ||
    text.includes('session')
  ) {
    return {
      summary: `Campaña activa de ingeniería social y suplantación de identidad señalada en: "${item.title}". Los atacantes emplean proxies inversos (AiTM) y páginas señuelo para interceptar credenciales y tokens de sesión persistentes.`,
      commentary: `Vulnerabilidad de Identidad: Adoptar llaves de seguridad resistentes al phishing (FIDO2/WebAuthn), revocar sesiones activas de usuarios comprometidos e implementar directivas estrictas de acceso condicional dependientes de dispositivo y geolocalización.`,
      analysisMode: 'HEURISTIC_LOCAL'
    };
  }

  // 4. Cadena de Suministro y Repositorios de Código
  if (
    text.includes('supply chain') ||
    text.includes('cadena de suministro') ||
    text.includes('npm') ||
    text.includes('pypi') ||
    text.includes('repository') ||
    text.includes('repositorio') ||
    text.includes('backdoor') ||
    text.includes('dependen')
  ) {
    return {
      summary: `Incidente de compromiso en la cadena de suministro de software reportado en: "${item.title}". Paquetes maliciosos fueron distribuidos en repositorios públicos para infectar dependencias aguas abajo.`,
      commentary: `Riesgo de Integridad de Código: Bloquear hashes y versiones comprometidas mediante lockfiles estables, ejecutar análisis de composición de software (SCA) y exigir firmas criptográficas en pipelines de CI/CD.`,
      analysisMode: 'HEURISTIC_LOCAL'
    };
  }

  // 5. Directriz Defensiva General
  return {
    summary: `Reporte de seguridad de la información referente a: "${item.title}". La actividad documentada presenta indicadores de riesgo y tácticas adversarias relevantes para la postura defensiva.`,
    commentary: `Directriz Preventiva: Reforzar la visibilidad en registros SIEM/EDR, revisar la segmentación de redes internas y garantizar la aplicación rigurosa del principio de menor privilegio.`,
    analysisMode: 'HEURISTIC_LOCAL'
  };
}

export class LLMAdapter {
  constructor({
    apiKey = process.env.LLM_API_KEY || '',
    baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model = process.env.LLM_MODEL || 'gpt-4o-mini',
    fetchFn = fetch
  } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
    this.fetchFn = fetchFn;
  }

  async analyzeNewsItem(item, { timeoutMs = 8000 } = {}) {
    if (!this.apiKey || !this.apiKey.trim()) {
      return generateHeuristicAnalysis(item);
    }

    try {
      const signal = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
      const prompt = `Analiza la siguiente noticia de ciberseguridad y genera un objeto JSON con dos campos obligatorios en español:\n` +
        `1. "summary": Resumen a leer (síntesis ejecutiva y clara de 1 a 2 párrafos).\n` +
        `2. "commentary": Comentarios al respecto (análisis de severidad, vectores de impacto y directrices defensivas recomendadas).\n\n` +
        `Noticia:\nTítulo: ${item.title}\nContenido: ${item.contentSnippet || ''}`;

      const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Eres un analista senior de seguridad de la información. Responde exclusivamente con un JSON válido con las claves "summary" y "commentary".'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2
        }),
        signal
      });

      if (!res.ok) {
        throw new Error(`Remote LLM error status: ${res.status}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      // Extract JSON if wrapped in markdown code blocks
      const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.summary || !parsed.commentary) {
        throw new Error('Missing summary or commentary in LLM response');
      }

      return {
        summary: String(parsed.summary).trim(),
        commentary: String(parsed.commentary).trim(),
        analysisMode: 'LLM_CLOUD'
      };
    } catch {
      // Graceful fallback to rich heuristic engine
      return generateHeuristicAnalysis(item);
    }
  }
}
