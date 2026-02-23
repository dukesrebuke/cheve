const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

export type TranslationMode = 'en-paisa' | 'en-boricua' | 'paisa-boricua';

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

export async function translateText(text: string, mode: TranslationMode): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not set in environment variables.');
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nTranslate this:\n${text}` }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!result) {
    throw new Error('Gemini returned an empty response.');
  }

  return result.trim();
}