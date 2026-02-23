<script lang="ts">
  import { onMount } from "svelte";
  import { history, userId } from "$lib/stores";
  import { fetchTranslations } from "$lib/firebase";
  import HistoryItem from "./HistoryItem.svelte";
  import Pagination from "./Pagination.svelte";
  import { slide } from "svelte/transition";

  let open = true;
  let lastDoc: any = null;
  let hasMore = false;

  let $history;
  let $userId;

  history.subscribe((v) => ($history = v));
  userId.subscribe((v) => ($userId = v));

  async function loadInitial() {
    const result = await fetchTranslations($userId);
    history.set(result.docs.map((d) => ({ id: d.id, ...d.data() })));
    lastDoc = result.lastDoc;
    hasMore = !!result.lastDoc;
  }

  async function loadMore() {
    const result = await fetchTranslations($userId, 10, lastDoc);
    history.update((h) => [
      ...h,
      ...result.docs.map((d) => ({ id: d.id, ...d.data() }))
    ]);
    lastDoc = result.lastDoc;
    hasMore = !!result.lastDoc;
  }

  onMount(loadInitial);
</script>

<div class="mt-6">
  <button
    on:click={() => (open = !open)}
    class="text-lg font-semibold mb-2"
  >
    Translation History
  </button>

  {#if open}
    <div transition:slide>
      {#each $history as item}
        <HistoryItem {item} />
      {/each}

      <Pagination {hasMore} {loadMore} />
    </div>
  {/if}
</div>