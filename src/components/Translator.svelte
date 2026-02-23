<script>
import { db, auth, collection, addDoc, serverTimestamp } from '../lib/firebase';
import { toast } from '../lib/stores';

let inputText = '';
let outputText = '';
let loading = false;

const API_URL = "/.netlify/functions/translate";

async function translate() {
  if (!inputText.trim()) return;

  loading = true;

  const systemPrompt = `You are a master linguist specializing exclusively in colloquial and idiomatic translation between English (USA/Intl), Boricua Spanish (Puerto Rican Spanish), and Paisa Spanish (Medellín/Antioquia, Colombia Spanish).

RULES:
1. Your translations must prioritize the deepest, most authentic, and current slang/idiomatic equivalent, not a literal word-for-word translation.
2. If a recognized deep-cut idiom exists, use it.
3. Your output MUST provide the full, paragraph-by-paragraph colloquial translation.
4. After the translation, you MUST output the separator "---CONTEXT---".
5. After the separator, provide a concise explanation of the most important colloquial terms used and their context.
6. Do NOT include any extra greetings, numbering, or wrapping text.`;

  const payload = {
    contents: [{ parts: [{ text: inputText }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  outputText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';

  loading = false;
}

async function saveTranslation() {
  if (!outputText) return;

  await addDoc(collection(db, "translations"), {
    userId: auth.currentUser.uid,
    inputText,
    outputText,
    createdAt: serverTimestamp()
  });

  toast.set("Saved to history.");
}
</script>

<div class="space-y-4">
  <textarea bind:value={inputText} class="w-full p-4 border rounded"></textarea>

  <button on:click={translate} class="bg-emerald-600 text-white px-6 py-2 rounded">
    {loading ? "Translating..." : "Translate"}
  </button>

  {#if outputText}
    <div class="p-4 bg-gray-50 border rounded">
      {outputText}
      <button on:click={saveTranslation} class="ml-4 text-blue-600 text-sm">
        Save
      </button>
    </div>
  {/if}
</div>