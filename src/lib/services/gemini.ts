const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

export type TranslationMode = 'en-paisa' | 'en-boricua' | 'paisa-boricua';
export type TranslationDirection = 'forward' | 'reverse';

export interface WordAnnotation {
  word: string;
  meaning: string;
  note: string;
}

export interface TranslationExplanation {
  context: string;
  tone: string;
  annotations: WordAnnotation[];
}

const SYSTEM_PROMPTS: Record<TranslationMode, Record<TranslationDirection, string>> = {
  'en-paisa': {
    forward: `You are a native translator from Medellín, Antioquia. 
Translate the input from English into authentic Paisa Spanish. 
STRICT LINGUISTIC RULES:
1. Use "Voseo" (vos) exclusively instead of "tú". 
2. Use "usted" only for formal respect or specific emphasis.
3. Use typical rhythmic fillers: "pues", "oíste", "hágale", "entonces qué".
4. Vocabulary: Use "parce", "chimba", "bacano", "berraco", "gonorrea" (as emphasis/affection), and "nea".
5. Tone: Warm, street-smart, and highly expressive.
Return ONLY the translated text, no preamble or quotes.`,
    reverse: `You are a native translator from Medellín, Antioquia. 
Translate the input from authentic Paisa Spanish into natural English.
Preserve the tone, warmth and expressiveness of the original.
Return ONLY the translated text, no preamble or quotes.`
  },
  'en-boricua': {
    forward: `You are a native translator from Puerto Rico. 
Translate the input from English into authentic Boricua Spanish.
STRICT LINGUISTIC RULES:
1. Reflect the Caribbean rhythm: incorporate Spanglish where natural (e.g., "vibe", "party", "cool").
2. Use "tú" instead of "usted". 
3. Phonetic styling: Use "l" for "r" in word endings (e.g., "puelco", "hablal") and drop the "s" at the end of words (e.g., "gracia" instead of "gracias").
4. Vocabulary: Use "acho", "bicho", "corillo", "jangueo", "puñeta", "wepa", and "mera".
5. Tone: High energy, rhythmic, and island-centric.
Return ONLY the translated text, no preamble or quotes.`,
    reverse: `You are a native translator from Puerto Rico.
Translate the input from authentic Boricua Spanish into natural English.
Preserve the Caribbean energy and tone of the original.
Return ONLY the translated text, no preamble or quotes.`
  },
  'paisa-boricua': {
    forward: `You are a dual-dialect cultural bridge. 
Translate the input from Paisa Colombian slang into authentic Boricua Puerto Rican slang.
STRICT LINGUISTIC RULES:
1. Switch from "Voseo" (Colombia) to "Tú/Spanglish" (Puerto Rico).
2. Transpose the cultural weight: If the input uses "parce", use "corillo" or "mano". If it uses "chimba", use "duro" or "brutísimo".
3. Maintain the intensity and level of vulgarity or affection from the original.
Return ONLY the translated text, no preamble or quotes.`,
    reverse: `You are a dual-dialect cultural bridge.
Translate the input from Boricua Puerto Rican slang into authentic Paisa Colombian slang.
STRICT LINGUISTIC RULES:
1. Switch from "Tú/Spanglish" (Puerto Rico) to "Voseo" (Colombia).
2. Transpose the cultural weight: If the input uses "corillo" or "mano", use "parce". If it uses "duro" or "brutísimo", use "chimba".
3. Maintain the intensity and level of vulgarity or affection from the original.
Return ONLY the translated text, no preamble or quotes.`
  }
};

const EXPLANATION_PROMPT = (mode: TranslationMode, direction: TranslationDirection, input: string, output: string) => {
  const dialectLabel: Record<TranslationMode, Record<TranslationDirection, string>> = {
    'en-paisa':      { forward: 'Paisa Spanish',   reverse: 'English from Paisa' },
    'en-boricua':    { forward: 'Boricua Spanish',  reverse: 'English from Boricua' },
    'paisa-boricua': { forward: 'Boricua Spanish',  reverse: 'Paisa Spanish' }
  };
  const dialect = dialectLabel[mode][direction];

  return `You are a cultural linguist. Analyze this translation and respond with EXACTLY 3 lines.

STRICT RULES — read carefully:
- Line 1: Start with "CONTEXT:" then write one vivid sentence (max 12 words) about ${dialect} culture, then end with 2-3 tone words in parentheses.
- Line 2: Start with "WORD1:" then write: slang term - english meaning - one short sentence on cultural weight.
- Line 3: Start with "WORD2:" then write: slang term - english meaning - one short sentence on cultural weight.
- NO markdown. NO asterisks. NO bullet points. NO blank lines. NO extra lines.
- Each line MUST be complete. Do not cut off mid-sentence.

EXAMPLE (follow this format exactly):
CONTEXT: Medellín streets where hustle and loyalty define everything. (warm, street-smart)
WORD1: parce - close friend - shorthand for the deep brotherhood of Paisa street culture.
WORD2: chimba - excellent or beautiful - the highest Paisa compliment, intensity varies by tone.

NOW ANALYZE:
Mode: ${mode} (${direction})
Original: "${input}"
Translation: "${output}"

CONTEXT:`;
};

async function callGemini(prompt: string, maxTokens = 1024): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not set in environment variables.');
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) throw new Error('Gemini returned an empty response.');
  return result.trim();
}

export async function translateText(
  text: string,
  mode: TranslationMode,
  direction: TranslationDirection = 'forward'
): Promise<string> {
  return callGemini(`${SYSTEM_PROMPTS[mode][direction]}\n\nTranslate this:\n${text}`, 1024);
}

export async function explainTranslation(
  input: string,
  output: string,
  mode: TranslationMode,
  direction: TranslationDirection = 'forward'
): Promise<TranslationExplanation> {
  await new Promise(r => setTimeout(r, 2000));

  const raw = await callGemini(EXPLANATION_PROMPT(mode, direction, input, output), 400);
  console.log('[EXPLANATION RAW]', raw);

  // strip markdown artifacts
  const cleaned = raw
    .replace(/[*_`#]/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  console.log('[EXPLANATION CLEANED]', cleaned);

  // ── Parse CONTEXT ─────────────────────────────────────────
  // look for line starting with CONTEXT: first, fall back to first line
  const contextLine = cleaned.find(l => /^CONTEXT\s*:/i.test(l)) ?? cleaned[0] ?? '';
  const contextBody = contextLine.replace(/^CONTEXT\s*:\s*/i, '').trim();
  const toneMatch   = contextBody.match(/\(([^)]+)\)\s*$/);
  const tone        = toneMatch ? toneMatch[1].trim() : 'colloquial';
  const context     = contextBody.replace(/\([^)]+\)\s*$/, '').trim();

  // ── Parse WORD lines ──────────────────────────────────────
  // Strategy: find labeled lines first, then fall back to any line with 2+ separators
  const separator  = /\s*[—–\-]\s*/;

  function parseWordLine(line: string): WordAnnotation | null {
    // strip any label prefix: WORD1:, 1., *, etc.
    const body  = line.replace(/^(WORD\d\s*:|[\d]+\.|[-*•])\s*/i, '').trim();
    const parts = body.split(separator).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const [word, meaning, ...noteParts] = parts;
    const note = noteParts.join(' - ').trim();
    return { word, meaning, note: note || meaning };
  }

  // prefer labeled lines, then any non-CONTEXT line with separators
  let wordLines = cleaned.filter(l => /^WORD\d\s*:/i.test(l));

  if (wordLines.length < 2) {
    // fallback: any line that has at least 2 dash separators and isn't the context line
    const extras = cleaned.filter(l =>
      !(/^CONTEXT\s*:/i.test(l)) &&
      (l.match(/[—–\-]/g) ?? []).length >= 2
    );
    wordLines = [...wordLines, ...extras].slice(0, 2);
  }

  const annotations: WordAnnotation[] = wordLines
    .map(parseWordLine)
    .filter((a): a is WordAnnotation => a !== null && !!a.word && !!a.meaning);

  return { context, tone, annotations };
}