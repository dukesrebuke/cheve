import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { TranslationMode } from './gemini';

export interface Translation {
  id: string;
  userId: string;
  inputText: string;
  outputText: string;
  mode: TranslationMode;
  createdAt: Date;
}

export interface PaginatedResult {
  translations: Translation[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

const PAGE_SIZE = 10;

export async function saveTranslation(
  userId: string,
  inputText: string,
  outputText: string,
  mode: TranslationMode
): Promise<Translation> {
  const docRef = await addDoc(collection(db, 'translations'), {
    userId,
    inputText,
    outputText,
    mode,
    createdAt: serverTimestamp()
  });

  return {
    id: docRef.id,
    userId,
    inputText,
    outputText,
    mode,
    createdAt: new Date()
  };
}

export async function getTranslations(
  userId: string,
  cursor: QueryDocumentSnapshot | null = null
): Promise<PaginatedResult> {
  const translationsRef = collection(db, 'translations');

  let q = query(
    translationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE + 1)
  );

  if (cursor) {
    q = query(
      translationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(PAGE_SIZE + 1)
    );
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > PAGE_SIZE;
  const pageDocs = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  const translations: Translation[] = pageDocs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      inputText: data.inputText,
      outputText: data.outputText,
      mode: data.mode,
      createdAt: data.createdAt?.toDate?.() ?? new Date()
    };
  });

  return {
    translations,
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore
  };
}