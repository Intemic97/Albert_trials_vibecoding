const { spawn } = require('child_process');
const path = require('path');

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[\.\!\?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function runHeuristicExtraction(text) {
  const normalized = normalizeWhitespace(text);
  const sentences = splitSentences(normalized);
  const sentenceSnippets = sentences.slice(0, 120);

  const parameterPatterns = [
    { key: 'pressure', re: /(\d+(?:[\.,]\d+)?)\s*(?:bar|barg)\b/gi, unit: 'bar' },
    { key: 'temperature', re: /(\d+(?:[\.,]\d+)?)\s*(?:\u00b0c|c)\b/gi, unit: 'C' },
    { key: 'humidity', re: /(\d+(?:[\.,]\d+)?)\s*%/gi, unit: '%' },
    { key: 'mfi', re: /\bMFI\b[^0-9]{0,12}(\d+(?:[\.,]\d+)?)/gi, unit: 'g/10min' },
  ];

  const extractedParameters = [];
  for (const sentence of sentenceSnippets) {
    for (const pattern of parameterPatterns) {
      let match;
      while ((match = pattern.re.exec(sentence)) !== null) {
        extractedParameters.push({
          extraction_class: 'process_parameter',
          extraction_text: match[0],
          attributes: {
            parameter: pattern.key,
            value: Number(String(match[1]).replace(',', '.')),
            unit: pattern.unit,
          },
          source_sentence: sentence,
        });
      }
      pattern.re.lastIndex = 0;
    }
  }

  const categoryKeywords = [
    { label: 'operations', terms: ['arranque', 'parada', 'setpoint', 'extrusion', 'corrida'] },
    { label: 'hse', terms: ['loto', 'permiso', 'incidente', 'emergencia', 'riesgo'] },
    { label: 'quality', terms: ['calidad', 'mfi', 'densidad', 'deltae', 'spec', 'ensayo'] },
    { label: 'maintenance', terms: ['mantenimiento', 'vibracion', 'rodamiento', 'mtbf', 'mttr'] },
    { label: 'circularity', terms: ['circular', 'recicl', 'pcr', 'pir', 'regranulado'] },
  ];

  const lower = normalized.toLowerCase();
  const categories = categoryKeywords
    .map((c) => ({
      label: c.label,
      score: c.terms.reduce((acc, t) => (lower.includes(t) ? acc + 1 : acc), 0),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    provider: 'heuristic-fallback',
    generatedAt: new Date().toISOString(),
    categories,
    extractedParameters,
    stats: {
      sourceChars: normalized.length,
      sentencesAnalyzed: sentenceSnippets.length,
      extractedItems: extractedParameters.length,
    },
  };
}

function runLangExtractPython(text, maxChars = 60000, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '..', 'langextract', 'extract_structured.py');
    const python = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      python.kill('SIGKILL');
      reject(new Error('LangExtract timeout'));
    }, timeoutMs);

    python.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    python.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    python.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    python.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(stderr || `LangExtract exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON from LangExtract python script'));
      }
    });

    const payload = JSON.stringify({
      text: String(text || '').slice(0, maxChars),
    });
    python.stdin.write(payload);
    python.stdin.end();
  });
}

async function extractStructuredFromText(text, options = {}) {
  const mode = options.mode || 'auto';
  const maxChars = Number(options.maxChars || 60000);

  if (!text || !String(text).trim()) {
    throw new Error('No hay texto para extraer.');
  }

  if (mode === 'heuristic') {
    return runHeuristicExtraction(text);
  }

  if (mode === 'langextract') {
    const result = await runLangExtractPython(text, maxChars);
    return {
      provider: 'langextract',
      generatedAt: new Date().toISOString(),
      ...result,
    };
  }

  // auto: try langextract first, fallback to heuristic
  try {
    const result = await runLangExtractPython(text, maxChars);
    return {
      provider: 'langextract',
      generatedAt: new Date().toISOString(),
      ...result,
    };
  } catch (err) {
    return {
      ...runHeuristicExtraction(text),
      fallbackReason: err.message || 'Unknown LangExtract error',
    };
  }
}

module.exports = {
  extractStructuredFromText,
};
