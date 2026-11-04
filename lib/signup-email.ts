export const signupEmailPending = { success: true, next: "email" } as const
export const signupEmailRequested = { success: true, next: "email", delivery: "unverified" } as const

export function signupEmailAddress(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const email = value.trim()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
