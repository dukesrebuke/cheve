<script lang="ts">
	import "../app.css";
	import favicon from "$lib/assets/favicon.svg";
	import { userId } from "$lib/stores";

	// temporary dev user until auth exists
	userId.set("dev-user-123");

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}