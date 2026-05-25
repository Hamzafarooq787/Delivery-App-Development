/**
 * lib/firebase/admin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase Admin SDK initialisation — SERVER-SIDE ONLY.
 * Uses a service account to send push notifications via FCM.
 *
 * ⚠️  NEVER import this file in client components or pages.
 *     It contains secret credentials that must stay on the server.
 *
 * Required environment variables (set in Vercel / .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID    — Firebase project ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL  — Service account email
 *   FIREBASE_ADMIN_PRIVATE_KEY   — Service account private key
 *                                  (Vercel escapes \n, handled below)
 */

import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app"
import { getMessaging, type Messaging } from "firebase-admin/messaging"

// ── Singleton instances ───────────────────────────────────────────────────────
let adminApp: App | null = null
let adminMessagingInstance: Messaging | null = null

/**
 * Returns (or creates) the singleton Firebase Admin App.
 * Vercel stores multiline env vars with literal \n — replace them with
 * actual newlines so the private key is parsed correctly.
 */
function getAdminApp(): App {
  if (adminApp) return adminApp

  if (getApps().length > 0) {
    adminApp = getApps()[0]
    return adminApp
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!privateKey || !process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    throw new Error(
      "[Firebase Admin] Missing required environment variables. " +
      "Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
    )
  }

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  })

  return adminApp
}

/**
 * Returns the Firebase Admin Messaging instance.
 * Call this to send push notifications from server-side code.
 *
 * @example
 * const messaging = getFirebaseAdminMessaging()
 * await messaging.send({ token, notification: { title, body } })
 */
export function getFirebaseAdminMessaging(): Messaging {
  if (!adminMessagingInstance) {
    adminMessagingInstance = getMessaging(getAdminApp())
  }
  return adminMessagingInstance
}
