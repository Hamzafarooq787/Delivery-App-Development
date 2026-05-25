# Push Notifications Setup Guide
## Kinetic Void — Firebase Cloud Messaging (FCM)

This guide walks you through the one-time setup required to enable full push
notifications (foreground + background + browser closed + mobile).

---

## Architecture Overview

```
Browser/App
  ├── usePushNotifications hook     → requests permission, generates FCM token
  ├── /firebase-messaging-sw.js     → FCM service worker (dynamic route, env vars injected)
  ├── /sw.js                        → caching/offline service worker (unchanged)
  └── /api/notifications/token      → saves FCM token to Supabase

Server (Next.js)
  ├── lib/firebase/admin.ts         → Firebase Admin SDK (server-only)
  ├── lib/notifications/send.ts     → sendPushNotification() helper
  ├── app/actions/notifications.ts  → notifyUser() / notifyMultipleUsers()
  └── app/actions/delivery.ts       → triggers on delivery events

Database (Supabase)
  └── user_notification_tokens      → stores FCM tokens per user per device
```

---

## Step 1 — Firebase Console Setup

### 1.1 Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Enter project name: `kinetic-void` (or any name)
4. Disable Google Analytics (optional)
5. Click **Create project**

### 1.2 Register a Web App

1. In the Firebase Console, click the **Web** icon (`</>`)
2. App nickname: `Kinetic Void Web`
3. ✅ Check **Also set up Firebase Hosting** — **NO** (we use Vercel)
4. Click **Register app**
5. Copy the `firebaseConfig` object — you'll need these values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 1.3 Enable Cloud Messaging

1. In Firebase Console → **Project Settings** (gear icon)
2. Click the **Cloud Messaging** tab
3. Under **Web Push certificates**, click **Generate key pair**
4. Copy the **Key pair** value — this is your VAPID key

### 1.4 Create a Service Account (for Admin SDK)

1. In Firebase Console → **Project Settings** → **Service accounts** tab
2. Click **Generate new private key**
3. A JSON file downloads — open it and copy these values:
   - `project_id`
   - `client_email`
   - `private_key`

---

## Step 2 — Supabase Database Setup

Run this SQL in your Supabase project → **SQL Editor**:

```sql
-- Copy from scripts/002_notification_tokens.sql
-- or run the file directly
```

The file is at: `scripts/002_notification_tokens.sql`

This creates the `user_notification_tokens` table with proper RLS policies.

---

## Step 3 — Environment Variables

### Local development (.env.local)

Create `.env.local` in the project root (it's gitignored):

```bash
# ── Firebase Client SDK (NEXT_PUBLIC = safe to expose) ────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# ── Firebase VAPID key (Web Push Certificate) ─────────────────────────────────
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BNa...your-vapid-key...

# ── Firebase Admin SDK (SERVER SIDE ONLY — never NEXT_PUBLIC) ─────────────────
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
# Paste the entire private key including -----BEGIN and -----END lines
# Keep the \n escaped (do NOT replace with actual newlines in .env.local)
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n"
```

> **⚠️ Security note:** Never commit `.env.local`. The `FIREBASE_ADMIN_*` vars
> are secret service account credentials. The `NEXT_PUBLIC_FIREBASE_*` vars
> are intentionally public (Firebase API keys are not secrets).

### Vercel production deployment

1. Go to **Vercel Dashboard** → your project → **Settings** → **Environment Variables**
2. Add each variable from the list above
3. For `FIREBASE_ADMIN_PRIVATE_KEY`:
   - Paste the full key value **including** the `-----BEGIN` and `-----END` lines
   - Vercel stores newlines as `\n` — the admin SDK handles this automatically
     (see `lib/firebase/admin.ts` where we do `.replace(/\\n/g, "\n")`)

---

## Step 4 — Allowed Domains in Firebase Console

Push notifications only work on HTTPS origins registered in Firebase.

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your domains:
   - `localhost` (already there by default)
   - `your-app.vercel.app`
   - Your custom domain (e.g., `kineticvoid.com`)

---

## Step 5 — PWA Manifest (already configured)

The app already has a `manifest.ts` at `app/manifest.ts`. Confirm these are set:

- `display: "standalone"`
- `start_url: "/dashboard"`
- Icons at `/icons/icon-192.png` and `/icons/icon-512.png`

---

## Step 6 — Test the implementation

### Test 1: Permission flow
1. Log in to the app
2. After ~4.5 seconds, a banner should appear at the bottom of the dashboard
3. Click **Enable** — the browser permission dialog should appear
4. Grant permission
5. Check browser DevTools → Application → Service Workers — both SWs should be registered

### Test 2: Foreground notification
Open the browser console and run:
```javascript
// Simulate a foreground message (for testing only)
// The real flow is triggered by sendPushNotification() on the server
```

Or use the Firebase Console → **Cloud Messaging** → **Send your first message**:
1. Notification title: `Test notification`
2. Target: **Device registration token**
3. Paste the FCM token from browser console (logged by the hook)
4. Click **Review** → **Publish**

### Test 3: Background notification
1. Switch to a different browser tab
2. Trigger a delivery creation in the app
3. You should see a system notification appear

### Test 4: Closed browser notification
1. Close the app tab completely
2. Trigger a delivery from another session (or use Firebase Console)
3. The notification should appear as a system notification

---

## How Notifications Are Triggered

### Automatic triggers (already implemented)

| Event | Recipient | Trigger location |
|-------|-----------|-----------------|
| Customer creates a new delivery | All online/approved drivers | `createDeliveryRequest()` |
| Driver accepts a delivery | Customer | `acceptDelivery()` |
| Driver marks as `collected` | Customer | `updateDeliveryStatus()` |
| Driver marks as `in_transit` | Customer | `updateDeliveryStatus()` |
| Driver marks as `delivered` | Customer | `updateDeliveryStatus()` |
| Delivery `cancelled` | Customer | `updateDeliveryStatus()` |

### Send manually from server code

```typescript
import { notifyUser, notifyMultipleUsers } from "@/app/actions/notifications"

// Send to one user
await notifyUser({
  userId: "supabase-user-uuid",
  title: "Your package arrived!",
  body: "Delivery completed successfully.",
  url: "/dashboard/customer",
  tag: "delivery-complete",
})

// Broadcast to multiple users
await notifyMultipleUsers({
  userIds: ["uuid1", "uuid2", "uuid3"],
  title: "System maintenance",
  body: "App will be down for 5 minutes at midnight.",
  tag: "system",
})
```

### Send from a Supabase Edge Function (advanced)

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req) => {
  const { userId, title, body, url } = await req.json()

  // Call your Next.js API route
  const res = await fetch(`${Deno.env.get("NEXT_PUBLIC_APP_URL")}/api/notifications/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add your internal API secret here for auth
    },
    body: JSON.stringify({ userId, title, body, url }),
  })

  return new Response(await res.text(), { status: res.status })
})
```

---

## Notification Badge Count

The badge count (`/icons/icon-72.png`) is shown in the status bar on Android.
To increment it, use the `badge` field in the FCM payload — already configured
in `lib/notifications/send.ts`.

For PWA badge count (Chrome on Android/desktop):
```typescript
// In a service worker or client component
if ('setAppBadge' in navigator) {
  await navigator.setAppBadge(unreadCount)
}
```

---

## Spam Prevention

Duplicate notifications are prevented by:
1. **`tag` field** — each notification type has a unique tag. A new notification with
   the same tag replaces the previous one instead of stacking.
2. **Database deduplication** — the `UNIQUE (user_id, fcm_token)` constraint prevents
   storing the same token twice.
3. **Token cleanup** — `sendPushNotification()` auto-removes invalid tokens (stale
   tokens from uninstalled apps, logged-out devices) to avoid wasted FCM calls.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "VAPID key not set" in console | Set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in env vars |
| SW registration fails | Check browser DevTools → Application → Service Workers for errors |
| Token not saved to Supabase | Check `/api/notifications/token` response in Network tab |
| Admin SDK throws "Missing credentials" | Verify `FIREBASE_ADMIN_*` env vars are set in Vercel |
| Notifications not arriving (background) | Ensure the domain is in Firebase Authorized Domains |
| iOS notifications not working | iOS Safari requires the app to be installed as a PWA (Add to Home Screen) |
| "Registration failed — push service error" | FCM may be blocked by browser/OS. Check Chrome flags: `chrome://flags/#enable-web-push` |

---

## File Structure Reference

```
lib/
  firebase/
    client.ts              ← Firebase client SDK (browser-only)
    admin.ts               ← Firebase Admin SDK (server-only, secret credentials)
  notifications/
    types.ts               ← TypeScript types and NotificationTag constants
    send.ts                ← sendPushNotification() — core server utility

app/
  firebase-messaging-sw.js/
    route.ts               ← Dynamic FCM service worker with injected config
  api/notifications/
    token/route.ts         ← POST/DELETE FCM token storage
    send/route.ts          ← POST send notification (auth-gated)
  actions/
    notifications.ts       ← Server actions: saveDeviceToken, notifyUser, etc.
    delivery.ts            ← Modified: triggers notifications on delivery events
  dashboard/
    layout.tsx             ← Modified: renders NotificationPermission banner

hooks/
  use-push-notifications.ts ← React hook: permission + token + foreground listener

components/pwa/
  sw-register.tsx           ← Modified: registers both SWs
  notification-permission.tsx ← Banner UI for permission opt-in

public/
  sw.js                     ← Caching SW (unchanged)

scripts/
  002_notification_tokens.sql ← Supabase migration
```
