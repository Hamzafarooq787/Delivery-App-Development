/**
 * lib/firebase/client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase client-side SDK initialisation.
 * Safe to import in browser/client components only.
 *
 * NOTE: Firebase config values prefixed with NEXT_PUBLIC_ are intentionally
 * public. Firebase security is enforced via Firebase Security Rules and
 * Supabase RLS — NOT by keeping these keys secret.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getMessaging, type Messaging } from "firebase/messaging"

// ── Firebase project configuration ───────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// ── Singleton Firebase app instance ──────────────────────────────────────────
let firebaseApp: FirebaseApp | null = null

/**
 * Returns (or creates) the singleton Firebase App instance.
 * Safe to call multiple times — subsequent calls return the cached instance.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    // Guard against double-initialisation in development HMR
    firebaseApp = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0]
  }
  return firebaseApp
}

// ── Singleton Firebase Messaging instance ────────────────────────────────────
let messagingInstance: Messaging | null = null

/**
 * Returns the Firebase Messaging instance for the browser.
 * Returns null when called server-side (SSR guard) or when the browser
 * does not support the Push API.
 */
export function getFirebaseMessaging(): Messaging | null {
  // Server-side guard — messaging is browser-only
  if (typeof window === "undefined") return null

  // Check for Push API / Notification support
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return null
  }

  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(getFirebaseApp())
    } catch (error) {
      console.error("[Firebase] Failed to initialise messaging:", error)
      return null
    }
  }

  return messagingInstance
}
