<script lang="ts">
  export let hasMore = false;
  export let loadMore: () => void;
</script>

{#if hasMore}
  <div class="flex justify-center mt-4">
    <button
      on:click={loadMore}
      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
    >
      Load More
    </button>
  </div>
{/if}