/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },

  // firebase-admin uses native Node.js modules (crypto, http2, etc.) that cannot
  // be bundled by webpack. Marking it external tells Next.js to require() it at
  // runtime instead of bundling — required for Vercel deployment to succeed.
  serverExternalPackages: ["firebase-admin"],

  // ── HTTP response headers ───────────────────────────────────────────────────
  async headers() {
    return [
      // FCM service worker — served by the dynamic route handler
      // but these headers act as a fallback / reinforce the correct MIME type
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Content-Type",           value: "application/javascript; charset=utf-8" },
          // Allow this SW script (served at root) to control scope /
          { key: "Service-Worker-Allowed", value: "/" },
          // Never cache — always fetch the latest version with current env config
          { key: "Cache-Control",          value: "no-cache, no-store, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // Main caching service worker
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type",           value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control",          value: "no-cache, no-store, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ]
  },
}

export default nextConfig
