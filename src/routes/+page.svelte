<script lang="ts">
  import { addTranslation } from "$lib/firebase";
  import { history, toast, userId } from "$lib/stores";
  import HistoryPanel from "$lib/components/HistoryPanel.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import { exportToCSV } from "$lib/utils";

  let input = "";
  let output = "";
  let $userId;
  let $history;

  userId.subscribe((v) => ($userId = v));
  history.subscribe((v) => ($history = v));

  async function translate() {
    if (!input) return;

    output = input.split("").reverse().join(""); // placeholder logic

    await addTranslation({
      userId: $userId,
      input,
      output
    });

    toast.set({ message: "Saved", type: "success" });
    input = "";
  }
</script>

<div class="max-w-2xl mx-auto mt-10 p-6 bg-gray-50 rounded-xl shadow">
  <h1 class="text-3xl font-bold mb-4">Cheve Translator</h1>

  <textarea
    bind:value={input}
    rows="4"
    class="w-full p-3 border rounded mb-4"
    placeholder="Enter text..."
  ></textarea>

  <button
    on:click={translate}
    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
  >
    Translate
  </button>

  <button
    on:click={() => exportToCSV($history)}
    class="ml-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
  >
    Export CSV
  </button>

  <HistoryPanel />
  <Toast />
</div>