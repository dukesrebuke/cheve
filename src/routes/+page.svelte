<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { translateText, type TranslationMode } from '$lib/services/gemini';
  import { saveTranslation, getTranslations, type Translation } from '$lib/services/firestore';
  import {
    userId,
    inputText,
    outputText,
    selectedMode,
    isTranslating,
    historyItems,
    historyLoading,
    historyHasMore,
    historyCursor,
    sidebarOpen,
    toasts,
    addToast
  } from '$lib/stores';

  const MODES: { value: TranslationMode; label: string }[] = [
    { value: 'en-paisa', label: 'English → Paisa' },
    { value: 'en-boricua', label: 'English → Boricua' },
    { value: 'paisa-boricua', label: 'Paisa → Boricua' }
  ];

  async function loadHistory(reset = false) {
    const uid = get(userId);
    if (!uid) return;

    historyLoading.set(true);
    try {
      const cursor = reset ? null : get(historyCursor);
      const result = await getTranslations(uid, cursor);

      if (reset) {
        historyItems.set(result.translations);
      } else {
        historyItems.update((items) => [...items, ...result.translations]);
      }

      historyCursor.set(result.lastDoc);
      historyHasMore.set(result.hasMore);
    } catch (e: any) {
      addToast('Failed to load history: ' + e.message, 'error');
    } finally {
      historyLoading.set(false);
    }
  }

  async function handleTranslate() {
    const input = get(inputText).trim();
    const mode = get(selectedMode);
    const uid = get(userId);

    if (!input) {
      addToast('Please enter some text to translate.', 'info');
      return;
    }

    isTranslating.set(true);
    outputText.set('');

    try {
      const result = await translateText(input, mode);
      outputText.set(result);

      const saved = await saveTranslation(uid, input, result, mode);
      historyItems.update((items) => [saved, ...items]);
      addToast('Translation saved!', 'success');
    } catch (e: any) {
      addToast('Translation failed: ' + e.message, 'error');
      outputText.set('');
    } finally {
      isTranslating.set(false);
    }
  }

  function exportCSV() {
    const items = get(historyItems);
    if (!items.length) {
      addToast('No history to export.', 'info');
      return;
    }

    const header = ['Date', 'Mode', 'Input', 'Output'];
    const rows = items.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.mode,
      `"${t.inputText.replace(/"/g, '""')}"`,
      `"${t.outputText.replace(/"/g, '""')}"`
    ]);

    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cheve-translations.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV exported!', 'success');
  }

  function handleHistoryClick(item: Translation) {
    inputText.set(item.inputText);
    outputText.set(item.outputText);
    selectedMode.set(item.mode);
  }

  onMount(() => {
    loadHistory(true);
  });
</script>

<div class="app-shell">
  <!-- Toast container -->
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast toast--{toast.type}">{toast.message}</div>
    {/each}
  </div>

  <!-- Sidebar toggle -->
  <button class="sidebar-toggle" onclick={() => sidebarOpen.update((v) => !v)}>
    {$sidebarOpen ? '◀' : '▶'}
  </button>

  <!-- Sidebar -->
  {#if $sidebarOpen}
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>History</h2>
        <button class="btn btn--ghost btn--sm" onclick={exportCSV}>Export CSV</button>
      </div>

      <div class="sidebar-list">
        {#if $historyLoading && !$historyItems.length}
          <p class="sidebar-empty">Loading...</p>
        {:else if !$historyItems.length}
          <p class="sidebar-empty">No translations yet.</p>
        {:else}
          {#each $historyItems as item (item.id)}
            <button class="history-item" onclick={() => handleHistoryClick(item)}>
              <span class="history-mode">{item.mode}</span>
              <span class="history-text">{item.inputText.slice(0, 60)}…</span>
              <span class="history-date">
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </button>
          {/each}

          {#if $historyHasMore}
            <button
              class="btn btn--ghost btn--sm load-more"
              onclick={() => loadHistory(false)}
              disabled={$historyLoading}
            >
              {$historyLoading ? 'Loading…' : 'Load more'}
            </button>
          {/if}
        {/if}
      </div>
    </aside>
  {/if}

  <!-- Main -->
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
          >
            {m.label}
          </button>
        {/each}
      </div>

      <!-- Text areas -->
      <div class="panels">
        <div class="panel">
          <label for="input">Input</label>
          <textarea
            id="input"
            bind:value={$inputText}
            placeholder="Type your text here…"
            rows={6}
          ></textarea>
        </div>

        <div class="panel">
          <label for="output">Translation</label>
          <textarea
            id="output"
            readonly
            value={$outputText}
            placeholder={$isTranslating ? 'Translating…' : 'Translation will appear here…'}
            rows={6}
          ></textarea>
        </div>
      </div>

      <button class="btn btn--primary" onclick={handleTranslate} disabled={$isTranslating}>
        {$isTranslating ? 'Translating…' : 'Translate'}
      </button>
    </div>
  </main>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: 'Georgia', serif;
    background: #0e0c0a;
    color: #f0ede8;
    min-height: 100vh;
  }

  .app-shell {
    display: flex;
    min-height: 100vh;
    position: relative;
  }

  /* Sidebar */
  .sidebar {
    width: 300px;
    min-width: 300px;
    background: #181410;
    border-right: 1px solid #2a2520;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid #2a2520;
  }

  .sidebar-header h2 {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #8a7e72;
  }

  .sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .sidebar-empty {
    padding: 2rem 1rem;
    color: #5a5248;
    font-size: 0.875rem;
    text-align: center;
  }

  .history-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 1px solid #1e1c18;
    cursor: pointer;
    text-align: left;
    color: #f0ede8;
    transition: background 0.15s;
  }

  .history-item:hover { background: #201e1a; }

  .history-mode {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #c8954a;
  }

  .history-text {
    font-size: 0.8rem;
    color: #a09890;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-date {
    font-size: 0.7rem;
    color: #5a5248;
  }

  .load-more {
    display: block;
    margin: 0.75rem auto;
  }

  /* Sidebar toggle */
  .sidebar-toggle {
    position: fixed;
    top: 1.25rem;
    left: 1rem;
    z-index: 100;
    background: #c8954a;
    color: #0e0c0a;
    border: none;
    border-radius: 4px;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 0.15s;
  }

  .sidebar-toggle:hover { background: #e0a85a; }

  /* Main */
  .main {
    flex: 1;
    padding: 3rem 2rem 2rem;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .main-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .logo {
    font-size: 3.5rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    color: #f0ede8;
  }

  .tagline {
    font-size: 0.85rem;
    color: #6a6058;
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  /* Card */
  .card {
    background: #141210;
    border: 1px solid #2a2520;
    border-radius: 8px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Mode selector */
  .mode-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .mode-btn {
    padding: 0.4rem 1rem;
    border: 1px solid #2a2520;
    border-radius: 100px;
    background: none;
    color: #8a7e72;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-btn:hover { border-color: #c8954a; color: #c8954a; }
  .mode-btn--active {
    background: #c8954a;
    border-color: #c8954a;
    color: #0e0c0a;
  }

  /* Panels */
  .panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .panels { grid-template-columns: 1fr; }
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .panel label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6a6058;
  }

  .panel textarea {
    background: #0a0908;
    border: 1px solid #2a2520;
    border-radius: 6px;
    color: #f0ede8;
    font-size: 0.95rem;
    font-family: inherit;
    padding: 0.75rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }

  .panel textarea:focus { border-color: #c8954a; }

  /* Buttons */
  .btn {
    padding: 0.6rem 1.5rem;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  .btn--primary {
    background: #c8954a;
    color: #0e0c0a;
    font-weight: 600;
    border-color: #c8954a;
    align-self: flex-start;
  }

  .btn--primary:hover:not(:disabled) { background: #e0a85a; }
  .btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn--ghost {
    background: none;
    border-color: #2a2520;
    color: #8a7e72;
  }

  .btn--ghost:hover:not(:disabled) { border-color: #c8954a; color: #c8954a; }
  .btn--sm { padding: 0.3rem 0.75rem; font-size: 0.75rem; }

  /* Toasts */
  .toast-container {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }

  .toast {
    padding: 0.75rem 1.25rem;
    border-radius: 6px;
    font-size: 0.85rem;
    backdrop-filter: blur(4px);
    animation: slideIn 0.2s ease;
  }

  .toast--success { background: #1a3a1a; color: #6ecf6e; border: 1px solid #2a5a2a; }
  .toast--error   { background: #3a1a1a; color: #cf6e6e; border: 1px solid #5a2a2a; }
  .toast--info    { background: #1a2a3a; color: #6e9ecf; border: 1px solid #2a3a5a; }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>