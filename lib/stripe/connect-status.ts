import "server-only"
export function isConnectWebhookConfigured() {
  return Boolean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim())
}
