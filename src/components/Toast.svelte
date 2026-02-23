<script lang="ts">
  import { toast } from "$lib/stores";
  import { fly } from "svelte/transition";

  let $toast;
  toast.subscribe((v) => ($toast = v));

  $: if ($toast) {
    setTimeout(() => toast.set(null), 3000);
  }
</script>

{#if $toast}
  <div
    transition:fly={{ y: -40, duration: 200 }}
    class="fixed top-4 right-4 bg-black text-white px-4 py-2 rounded shadow-lg z-50"
  >
    {$toast.message}
  </div>
{/if}