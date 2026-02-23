import { writable } from "svelte/store";

export const history = writable<any[]>([]);
export const toast = writable<{ message: string; type: string } | null>(null);
export const loading = writable(false);

export const userId = writable("demo-user-123"); // replace later with auth