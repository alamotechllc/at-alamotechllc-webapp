import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function projectId(): string {
  return process.env.FIREBASE_PROJECT_ID ?? "demo-raas-cp";
}

export function firestore(): Firestore {
  ensureApp();
  return getFirestore();
}

export function auth(): Auth {
  ensureApp();
  return getAuth();
}

function ensureApp(): void {
  if (getApps().length === 0) {
    initializeApp({ projectId: projectId() });
  }
}
