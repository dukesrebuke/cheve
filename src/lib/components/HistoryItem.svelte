<script lang="ts">
  import { deleteTranslation } from "$lib/firebase";
  import { toast } from "$lib/stores";
  import { formatDate } from "$lib/utils";

  export let item: any;

  async function handleDelete() {
    await deleteTranslation(item.id);
    toast.set({ message: "Deleted", type: "info" });
  }
</script>

<div class="border rounded p-3 mb-2 bg-white shadow-sm">
  <div class="text-sm text-gray-500 mb-1">
    {formatDate(item.createdAt)}
  </div>

  <div class="font-medium">{item.input}</div>
  <div class="text-blue-600 mt-1">{item.output}</div>

  <button
    on:click={handleDelete}
    class="mt-2 text-red-500 text-sm hover:underline"
  >
    Delete
  </button>
</div>