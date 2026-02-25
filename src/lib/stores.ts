import { writable, derived } from 'svelte/store';
import type { Translation } from './services/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { TranslationMode } from './services/gemini';

// User identity — use a stable anonymous ID persisted in localStorage
function createUserIdStore() {
  const STORAGE_KEY = 'cheve_user_id';

  let initialId: string;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    initialId = stored ?? crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, initialId);
  } else {
    initialId = 'ssr-placeholder';
  }

  return writable<string>(initialId);
}

export const userId = createUserIdStore();

// Translation state
export const inputText = writable<string>('');
export const outputText = writable<string>('');
export const selectedMode = writable<TranslationMode>('en-paisa');
export const isTranslating = writable<boolean>(false);

// History state
export const historyItems = writable<Translation[]>([]);
export const historyLoading = writable<boolean>(false);
export const historyHasMore = writable<boolean>(false);
export const historyCursor = writable<QueryDocumentSnapshot | null>(null);
export const sidebarOpen = writable<boolean>(true);

// Toast notifications
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
export const toasts = writable<Toast[]>([]);

export function addToast(message: string, type: Toast['type'] = 'info', duration = 3500) {
  const id = crypto.randomUUID();
  toasts.update((t) => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((toast) => toast.id !== id));
  }, duration);
}