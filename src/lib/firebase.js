import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const translationsRef = collection(db, "translations");

export async function addTranslation(data: {
  userId: string;
  input: string;
  output: string;
}) {
  return addDoc(translationsRef, {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function deleteTranslation(id: string) {
  return deleteDoc(doc(db, "translations", id));
}

export async function fetchTranslations(userId: string, pageSize = 10, lastDocRef: any = null) {
  let q = query(
    translationsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  if (lastDocRef) {
    q = query(
      translationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      startAfter(lastDocRef),
      limit(pageSize)
    );
  }

  const snapshot = await getDocs(q);

  return {
    docs: snapshot.docs,
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
  };
}