<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { translateText, explainTranslation, type TranslationMode, type TranslationExplanation } from '$lib/services/gemini';
  import { saveTranslation, getTranslations, type Translation } from '$lib/services/firestore';
  import {
    userId, inputText, outputText, selectedMode, isTranslating,
    historyItems, historyLoading, historyHasMore, historyCursor,
    sidebarOpen, toasts, addToast
  } from '$lib/stores';

  const MODES: { value: TranslationMode; label: string }[] = [
    { value: 'en-paisa',     label: 'English → Paisa'   },
    { value: 'en-boricua',   label: 'English → Boricua' },
    { value: 'paisa-boricua',label: 'Paisa → Boricua'   }
  ];

  // Explanation state
  let explanation         = $state<TranslationExplanation | null>(null);
  let explanationVisible  = $state(false);
  let explanationLoading  = $state(false);

  // History preview state
  let previewItem    = $state<Translation | null>(null);
  let previewVisible = $state(false);
  let restoring      = $state(false);

  // ── History ──────────────────────────────────────────
  async function loadHistory(reset = false) {
    const uid = get(userId);
    if (!uid) return;
    historyLoading.set(true);
    try {
      const cursor = reset ? null : get(historyCursor);
      const result = await getTranslations(uid, cursor);
      if (reset) historyItems.set(result.translations);
      else historyItems.update(items => [...items, ...result.translations]);
      historyCursor.set(result.lastDoc);
      historyHasMore.set(result.hasMore);
    } catch (e: any) {
      addToast('Failed to load history: ' + e.message, 'error');
    } finally {
      historyLoading.set(false);
    }
  }

  // ── Translation ───────────────────────────────────────
  async function handleTranslate() {
    const input = get(inputText).trim();
    const mode  = get(selectedMode);
    const uid   = get(userId);
    if (!input) { addToast('Please enter some text to translate.', 'info'); return; }

    // reset
    isTranslating.set(true);
    outputText.set('');
    explanation        = null;
    explanationVisible = false;

    try {
      const result = await translateText(input, mode);
      outputText.set(result);

      const saved = await saveTranslation(uid, input, result, mode);
      historyItems.update(items => [saved, ...items]);
      addToast('Translation saved!', 'success');

      // fire explanation after a beat — feels natural, not racing
      fetchExplanation(input, result, mode);

    } catch (e: any) {
      addToast('Translation failed: ' + e.message, 'error');
      outputText.set('');
    } finally {
      isTranslating.set(false);
    }
  }

  async function fetchExplanation(input: string, output: string, mode: TranslationMode) {
    explanationLoading = true;
    explanationVisible = false;
    try {
      await new Promise(r => setTimeout(r, 400)); // brief breath
      const result = await explainTranslation(input, output, mode);
      explanation        = result;
      explanationVisible = true;
    } catch (e: any) {
      // explanation is non-critical — fail silently
      console.warn('Explanation failed:', e.message);
    } finally {
      explanationLoading = false;
    }
  }

  // ── History preview ───────────────────────────────────
  function handleHistoryClick(item: Translation) {
    if (previewItem?.id === item.id) { closePreview(); return; }
    previewItem    = item;
    previewVisible = true;
  }

  function closePreview() {
    previewVisible = false;
    setTimeout(() => { previewItem = null; }, 300);
  }

  async function restoreFromPreview() {
    if (!previewItem) return;
    restoring = true;
    await new Promise(r => setTimeout(r, 180));
    inputText.set(previewItem.inputText);
    outputText.set(previewItem.outputText);
    selectedMode.set(previewItem.mode);
    explanation        = null;
    explanationVisible = false;
    restoring          = false;
    closePreview();
    addToast('Translation restored to editor', 'success');
  }

  // ── CSV Export ────────────────────────────────────────
  function exportCSV() {
    const items = get(historyItems);
    if (!items.length) { addToast('No history to export.', 'info'); return; }
    const header = ['Date', 'Mode', 'Input', 'Output'];
    const rows   = items.map(t => [
      new Date(t.createdAt).toISOString(), t.mode,
      `"${t.inputText.replace(/"/g,'""')}"`,
      `"${t.outputText.replace(/"/g,'""')}"`
    ]);
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'cheve-translations.csv'; a.click();
    URL.revokeObjectURL(url);
    addToast('CSV exported!', 'success');
  }

  onMount(() => { loadHistory(true); });
</script>

<!-- ── Toasts ─────────────────────────────────────────── -->
<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast--{toast.type}">{toast.message}</div>
  {/each}
</div>

<div class="app-shell">
  <button class="sidebar-toggle" onclick={() => sidebarOpen.update(v => !v)}>
    {$sidebarOpen ? '◀' : '▶'}
  </button>

  <!-- ── Sidebar ────────────────────────────────────── -->
  {#if $sidebarOpen}
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>History</h2>
        <button class="btn btn--ghost btn--sm" onclick={exportCSV}>Export CSV</button>
      </div>
      <div class="sidebar-list">
        {#if $historyLoading && !$historyItems.length}
          <p class="sidebar-empty">Loading…</p>
        {:else if !$historyItems.length}
          <p class="sidebar-empty">No translations yet.</p>
        {:else}
          {#each $historyItems as item (item.id)}
            <button
              class="history-item"
              class:history-item--active={previewItem?.id === item.id}
              onclick={() => handleHistoryClick(item)}
            >
              <span class="history-mode">{item.mode}</span>
              <span class="history-text">{item.inputText.slice(0,60)}{item.inputText.length > 60 ? '…' : ''}</span>
              <span class="history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
            </button>
          {/each}
          {#if $historyHasMore}
            <div class="btn-row">
              <button class="btn btn--ghost btn--sm" onclick={() => loadHistory(false)} disabled={$historyLoading}>
                {$historyLoading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </aside>
  {/if}

  <!-- ── Main ──────────────────────────────────────── -->
  <main class="main">
    <header class="main-header">
      <h1 class="logo">Cheve</h1>
      <p class="tagline">Authentic dialect translation</p>
    </header>

    <div class="card">
      <!-- Mode selector -->
      <div class="mode-selector">
        {#each MODES as m}
          <button
            class="mode-btn"
            class:mode-btn--active={$selectedMode === m.value}
            onclick={() => selectedMode.set(m.value)}
          >{m.label}</button>
        {/each}
      </div>

      <!-- Text panels -->
      <div class="panels">
        <div class="panel">
          <label for="input">Input</label>
          <textarea id="input" bind:value={$inputText} placeholder="Type your text here…" rows={6}></textarea>
        </div>
        <div class="panel">
          <label for="output">Translation</label>
          <textarea id="output" readonly value={$outputText}
            placeholder={$isTranslating ? 'Translating…' : 'Translation will appear here…'}
            rows={6}></textarea>
        </div>
      </div>

      <!-- ── Cultural Explanation ────────────────────── -->
      {#if explanationLoading}
        <div class="explanation explanation--loading">
          <span class="explanation-pulse"></span>
          <span class="explanation-loading-text">Reading between the lines…</span>
        </div>
      {/if}

      {#if explanation && !explanationLoading}
        <div class="explanation" class:explanation--visible={explanationVisible}>
          <div class="explanation-header">
            <span class="explanation-icon">◈</span>
            <span class="explanation-label">Cultural Notes</span>
            <span class="explanation-tone">{explanation.tone}</span>
          </div>

          <p class="explanation-context">{explanation.context}</p>

          {#if explanation.annotations.length}
            <div class="annotations">
              {#each explanation.annotations as ann}
                <div class="annotation">
                  <span class="annotation-word">{ann.word}</span>
                  <span class="annotation-meaning">{ann.meaning}</span>
                  <p class="annotation-note">{ann.note}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- History preview panel -->
      {#if previewItem}
        <div class="preview-panel" class:preview-panel--visible={previewVisible}>
          <div class="preview-header">
            <span class="preview-badge">{previewItem.mode}</span>
            <span class="preview-date">{new Date(previewItem.createdAt).toLocaleString()}</span>
            <button class="preview-close" onclick={closePreview}>✕</button>
          </div>
          <div class="preview-body">
            <div class="preview-col">
              <span class="preview-col-label">Original</span>
              <p class="preview-text">{previewItem.inputText}</p>
            </div>
            <div class="preview-divider"></div>
            <div class="preview-col">
              <span class="preview-col-label">Translation</span>
              <p class="preview-text">{previewItem.outputText}</p>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn--primary" onclick={restoreFromPreview} disabled={restoring}>
              {restoring ? 'Restoring…' : '↩ Restore to editor'}
            </button>
          </div>
        </div>
      {/if}

      <!-- Translate button -->
      <div class="btn-row">
        <button class="btn btn--primary btn--translate" onclick={handleTranslate} disabled={$isTranslating}>
          {$isTranslating ? 'Translating…' : 'Translate'}
        </button>
      </div>
    </div>
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: 'Georgia', serif;
    background: #1c1814;
    color: #ede8e0;
    min-height: 100vh;
  }

  .app-shell { display: flex; min-height: 100vh; }

  /* ── Sidebar ── */
  .sidebar {
    width: 300px; min-width: 300px;
    background: #221e19;
    border-right: 1px solid #362e24;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .sidebar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid #362e24;
  }
  .sidebar-header h2 {
    font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.14em; color: #9a8e7e;
  }
  .sidebar-list { flex: 1; overflow-y: auto; padding: 0.5rem 0; }
  .sidebar-empty { padding: 2rem 1rem; color: #6a5e4e; font-size: 0.875rem; text-align: center; }

  .history-item {
    display: flex; flex-direction: column; gap: 0.25rem;
    width: 100%; padding: 0.8rem 1rem;
    background: none; border: none;
    border-bottom: 1px solid #2a241e;
    border-left: 3px solid transparent;
    cursor: pointer; text-align: left; color: #ede8e0;
    transition: background 0.15s, border-left-color 0.15s;
  }
  .history-item:hover { background: #2a241e; border-left-color: #c8954a88; }
  .history-item--active { background: #2e271f; border-left-color: #c8954a; }
  .history-mode { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: #c8954a; }
  .history-text { font-size: 0.82rem; color: #b0a494; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-date { font-size: 0.68rem; color: #6a5e4e; }

  .sidebar-toggle {
    position: fixed; top: 1.25rem; left: 1rem; z-index: 100;
    background: #c8954a; color: #1c1814;
    border: none; border-radius: 4px;
    width: 2rem; height: 2rem;
    cursor: pointer; font-size: 0.75rem;
    transition: background 0.15s;
  }
  .sidebar-toggle:hover { background: #dba55e; }

  /* ── Main ── */
  .main { flex: 1; padding: 3rem 2rem 2rem; max-width: 900px; margin: 0 auto; width: 100%; }
  .main-header { text-align: center; margin-bottom: 2.5rem; }
  .logo { font-size: 3.5rem; font-weight: 400; letter-spacing: 0.05em; color: #ede8e0; }
  .tagline { font-size: 0.8rem; color: #7a6e5e; margin-top: 0.3rem; text-transform: uppercase; letter-spacing: 0.18em; }

  /* ── Card ── */
  .card {
    background: #211d18; border: 1px solid #362e24;
    border-radius: 10px; padding: 1.75rem;
    display: flex; flex-direction: column; gap: 1.5rem;
  }

  /* ── Mode selector ── */
  .mode-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
  .mode-btn {
    padding: 0.4rem 1.1rem; border: 1px solid #362e24;
    border-radius: 100px; background: none;
    color: #9a8e7e; font-size: 0.8rem; font-family: inherit;
    cursor: pointer; transition: all 0.15s;
  }
  .mode-btn:hover { border-color: #c8954a; color: #c8954a; }
  .mode-btn--active { background: #c8954a; border-color: #c8954a; color: #1c1814; font-weight: 600; }

  /* ── Text panels ── */
  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 640px) { .panels { grid-template-columns: 1fr; } }
  .panel { display: flex; flex-direction: column; gap: 0.4rem; }
  .panel label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: #7a6e5e; }
  .panel textarea {
    background: #18140f; border: 1px solid #362e24; border-radius: 6px;
    color: #ede8e0; font-size: 0.95rem; font-family: inherit;
    padding: 0.75rem; resize: vertical; outline: none;
    transition: border-color 0.15s; width: 100%;
  }
  .panel textarea:focus { border-color: #c8954a; }

  /* ── Cultural Explanation ── */
  .explanation {
    background: #18140f;
    border: 1px solid #c8954a33;
    border-left: 3px solid #c8954a;
    border-radius: 8px;
    padding: 1.25rem 1.5rem;
    display: flex; flex-direction: column; gap: 1rem;
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .explanation--visible { opacity: 1; transform: translateY(0); }

  .explanation--loading {
    opacity: 1; transform: none;
    flex-direction: row; align-items: center; gap: 0.75rem;
    padding: 0.9rem 1.5rem;
  }

  .explanation-pulse {
    display: inline-block;
    width: 8px; height: 8px; border-radius: 50%;
    background: #c8954a;
    animation: pulse 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.85); }
    50%       { opacity: 1;   transform: scale(1.15); }
  }

  .explanation-loading-text { font-size: 0.8rem; color: #7a6e5e; font-style: italic; }

  .explanation-header { display: flex; align-items: center; gap: 0.6rem; }
  .explanation-icon { color: #c8954a; font-size: 0.9rem; }
  .explanation-label {
    font-size: 0.72rem; text-transform: uppercase;
    letter-spacing: 0.12em; color: #9a8e7e; flex: 1;
  }
  .explanation-tone {
    font-size: 0.72rem; font-style: italic;
    color: #c8954a; background: #c8954a14;
    border: 1px solid #c8954a33; border-radius: 100px;
    padding: 0.15rem 0.65rem;
  }

  .explanation-context {
    font-size: 0.9rem; color: #c8bfb0;
    line-height: 1.65; font-style: italic;
  }

  .annotations { display: flex; flex-direction: column; gap: 0.75rem; }

  .annotation {
    display: grid;
    grid-template-columns: auto auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 0.6rem; row-gap: 0.2rem;
    align-items: baseline;
  }

  .annotation-word {
    font-size: 0.92rem; font-weight: 600;
    color: #dba55e; grid-row: 1;
  }
  .annotation-meaning {
    font-size: 0.78rem; color: #7a6e5e;
    font-style: italic; grid-row: 1;
    padding-top: 0.05rem;
  }
  .annotation-note {
    font-size: 0.82rem; color: #a09488;
    line-height: 1.55;
    grid-column: 1 / -1; grid-row: 2;
    padding-left: 0.1rem;
  }

  /* ── Preview panel ── */
  .preview-panel {
    background: #18140f; border: 1px solid #c8954a44;
    border-radius: 8px; padding: 1.25rem;
    display: flex; flex-direction: column; gap: 1rem;
    opacity: 0; transform: translateY(-6px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
  }
  .preview-panel--visible { opacity: 1; transform: translateY(0); pointer-events: all; }

  .preview-header { display: flex; align-items: center; gap: 0.75rem; }
  .preview-badge {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: #c8954a; background: #c8954a18;
    border: 1px solid #c8954a44; border-radius: 100px; padding: 0.2rem 0.65rem;
  }
  .preview-date { font-size: 0.72rem; color: #6a5e4e; flex: 1; }
  .preview-close { background: none; border: none; color: #6a5e4e; cursor: pointer; font-size: 0.85rem; transition: color 0.15s; }
  .preview-close:hover { color: #ede8e0; }

  .preview-body { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: start; }
  .preview-col { display: flex; flex-direction: column; gap: 0.4rem; }
  .preview-col-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: #7a6e5e; }
  .preview-text { font-size: 0.875rem; color: #c8bfb0; line-height: 1.6; }
  .preview-divider { width: 1px; background: #362e24; align-self: stretch; margin-top: 1.25rem; }

  /* ── Buttons ── */
  .btn-row { display: flex; justify-content: center; }
  .btn {
    padding: 0.6rem 1.5rem; border-radius: 6px;
    border: 1px solid transparent; cursor: pointer;
    font-size: 0.875rem; font-family: inherit; transition: all 0.15s;
  }
  .btn--primary { background: #c8954a; color: #1c1814; font-weight: 600; border-color: #c8954a; }
  .btn--primary:hover:not(:disabled) { background: #dba55e; border-color: #dba55e; }
  .btn--primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn--translate { padding: 0.7rem 3rem; font-size: 0.95rem; letter-spacing: 0.05em; }
  .btn--ghost { background: none; border-color: #362e24; color: #9a8e7e; }
  .btn--ghost:hover:not(:disabled) { border-color: #c8954a; color: #c8954a; }
  .btn--sm { padding: 0.3rem 0.75rem; font-size: 0.75rem; }

  /* ── Toasts ── */
  .toast-container {
    position: fixed; bottom: 1.5rem; right: 1.5rem;
    z-index: 999; display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none;
  }
  .toast { padding: 0.75rem 1.25rem; border-radius: 6px; font-size: 0.85rem; animation: slideIn 0.2s ease; }
  .toast--success { background: #1e3220; color: #7ed87e; border: 1px solid #2e5230; }
  .toast--error   { background: #32201e; color: #d87e7e; border: 1px solid #52302e; }
  .toast--info    { background: #1e2832; color: #7eaed8; border: 1px solid #2e3852; }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>