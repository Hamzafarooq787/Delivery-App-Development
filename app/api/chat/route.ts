import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    // Require a session — this calls a paid API on every request, and was
    // previously reachable by anyone on the internet with no auth or limit.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    const body = await req.json()
    const { messages } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must be non-empty." },
        { status: 400 }
      )
    }

    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== "string" || msg.content.trim() === "") {
        return NextResponse.json(
          { error: "Each message must have non-empty text content." },
          { status: 400 }
        )
      }
    }

    const anthropicMessages: Anthropic.MessageParam[] = messages.map(
      (msg: { role: "user" | "assistant"; content: string }) => ({
        role: msg.role,
        content: msg.content.trim(),
      })
    )

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system:
        "You are a helpful support assistant for a delivery app. Help drivers with questions about deliveries, payouts, verification, and account issues. Be concise and friendly.",
      messages: anthropicMessages,
    })

    const textBlock = response.content.find((b) => b.type === "text")
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : ""

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "API authentication failed." }, { status: 401 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limit reached. Please try again later." }, { status: 429 })
    }
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 })
  }
}
