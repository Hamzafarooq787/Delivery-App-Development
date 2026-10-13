"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function submitContactForm(data: {
  firstName: string
  lastName: string
  email: string
  subject: string
  message: string
}): Promise<{ error?: string }> {
  const { firstName, lastName, email, subject, message } = data

  if (!firstName || !lastName || !email || !subject || !message) {
    return { error: "All fields are required." }
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(email)) {
    return { error: "Please enter a valid email address." }
  }

  const admin = createAdminClient()
  const { error } = await admin.from("contact_requests").insert({
    first_name: firstName,
    last_name:  lastName,
    email,
    subject,
    message,
  })

  if (error) {
    console.error("contact_requests insert error:", error.message)
    return { error: "Failed to send your message. Please try again later." }
  }

  return {}
}
