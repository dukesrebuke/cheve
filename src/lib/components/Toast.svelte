<script lang="ts">
  import { fly } from "svelte/transition";
  import { toast } from "$lib/stores";
</script>

{#if $toast}
  <div
    class="fixed bottom-4 right-4 px-4 py-2 rounded-xl shadow-lg text-white
      { $toast.type === 'success' ? 'bg-green-600' : 'bg-red-600' }"
    in:fly={{ y: 20, duration: 200 }}
    out:fly={{ y: 20, duration: 200 }}
  >
    {$toast.message}
  </div>
{/if}