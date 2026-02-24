const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

export type TranslationMode = 'en-paisa' | 'en-boricua' | 'paisa-boricua';

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

const SYSTEM_PROMPTS: Record<TranslationMode, string> = {
  'en-paisa': `You are a translator specializing in Colombian Paisa dialect (Antioquia region). 
Translate the input from standard English into authentic Paisa Spanish slang and expressions.
Use authentic Paisa vocabulary: parcero/a, bacano, chimba, qué más, mono/a, llave, el parche, gonorrea (as an affectionate insult), hijueputa (casual), berraco, pirobo, marica (casual), etc.
Keep the translation natural and conversational. Return ONLY the translated text, nothing else.`,

  'en-boricua': `You are a translator specializing in Puerto Rican Spanish (Boricua dialect).
Translate the input from standard English into authentic Boricua Spanish slang and expressions.
Use authentic Boricua vocabulary: ¿Qué xopa?, wepa, bicho, chavos, corillo, acho/chacho, jangueo, brutísimo, paloma, mano, coño, pendejo, puñeta, etc.
Keep the translation natural and conversational. Return ONLY the translated text, nothing else.`,

  'paisa-boricua': `You are a translator specializing in both Colombian Paisa dialect and Puerto Rican Boricua Spanish.
Translate the input from Paisa Colombian slang into authentic Boricua Puerto Rican slang.
Preserve the meaning and tone but use Boricua expressions instead of Paisa ones.
Return ONLY the translated text, nothing else.`
};

const EXPLANATION_PROMPT = (mode: TranslationMode, input: string, output: string) =>
  `You are a cultural linguist. Respond with exactly 3 lines. Each line must be complete on a single line with no line breaks within it. No markdown. No asterisks. No numbering.

Here is a completed example of the exact format:
CONTEXT: Medellín street life where loyalty and hustle define every word. (warm, street-level)
WORD1: parcero - close friend or ally - the cornerstone of Paisa identity, implying deep mutual trust.
WORD2: chimba - something excellent or beautiful - used to express admiration, can also be an insult depending on tone.

Now do the same for this translation:
Mode: ${mode}
Original: "${input}"
Translation: "${output}"

CONTEXT:`;

async function callGemini(prompt: string, maxTokens = 1024): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not set in environment variables.');
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // lower = more obedient formatting
        maxOutputTokens: maxTokens
      }
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

export async function translateText(text: string, mode: TranslationMode): Promise<string> {
  return callGemini(`${SYSTEM_PROMPTS[mode]}\n\nTranslate this:\n${text}`, 1024);
}

export async function explainTranslation(
  input: string,
  output: string,
  mode: TranslationMode
): Promise<TranslationExplanation> {
  await new Promise(r => setTimeout(r, 2000));

  const raw = await callGemini(EXPLANATION_PROMPT(mode, input, output), 800);

  // strip all markdown: asterisks, hashes, backticks
  const cleaned = raw
    .replace(/[*_`#]/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  console.log('[EXPLANATION CLEANED]', cleaned);

  // find lines by prefix — works regardless of what else Gemini adds
  const contextLine = cleaned.find(l => l.toUpperCase().startsWith('CONTEXT')) ?? '';
  const word1Line   = cleaned.find(l => l.toUpperCase().startsWith('WORD1'))   ?? '';
  const word2Line   = cleaned.find(l => l.toUpperCase().startsWith('WORD2'))   ?? '';

  // parse context: everything after "CONTEXT:" 
  const contextBody = contextLine.replace(/^CONTEXT\s*:\s*/i, '').trim();
  const toneMatch   = contextBody.match(/\(([^)]+)\)\s*$/);
  const tone        = toneMatch ? toneMatch[1] : 'colloquial';
  const context     = contextBody.replace(/\([^)]+\)\s*$/, '').trim();

  // parse word lines: "WORD1: term - meaning - note"
  function parseWordLine(line: string): WordAnnotation {
    const body  = line.replace(/^WORD\d\s*:\s*/i, '').trim();
    // split on em-dash, en-dash, or hyphen surrounded by spaces
    const parts = body.split(/\s*[—–]\s*|\s+-\s+/).map(s => s.trim());
    const [word = '', meaning = '', ...noteParts] = parts;
    return { word, meaning, note: noteParts.join(' - ').trim() };
  }

  const annotations: WordAnnotation[] = [word1Line, word2Line]
    .filter(Boolean)
    .map(parseWordLine)
    .filter(a => a.word && a.meaning);

  return { context, tone, annotations };
}