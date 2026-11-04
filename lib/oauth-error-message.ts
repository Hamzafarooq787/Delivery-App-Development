const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_oauth_code: "OAuth sign-in failed: no authorisation code received. Please try again.",
  no_user: "Could not retrieve your account after sign-in. Please try again.",
  oauth_unavailable: "Sign-in is temporarily unavailable. Start again using the Google sign-in button.",
  profile_unavailable: "We could not load your account. Please try signing in again.",
  oauth_failed: "OAuth sign-in failed. Please try again.",
}

export function oauthErrorMessage(code: string | null) {
  if (!code) return null
  const message = OAUTH_ERROR_MESSAGES[code]
  return typeof message === "string" ? message : OAUTH_ERROR_MESSAGES.oauth_failed
}
