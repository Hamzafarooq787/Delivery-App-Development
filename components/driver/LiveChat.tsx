"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, X, Loader2 } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function LiveChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        setMessages([
          {
            role: "assistant",
            content:
              "Hi! I'm your driver support assistant. How can I help you today?",
          },
        ])
      }
    }
  }, [open])

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput("")
    setError(null)

    const updated: Message[] = [...messages, { role: "user", content: trimmed }]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ])
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Start Chat
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
            style={{ height: "min(600px, 90vh)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-strong)]/10">
                  <MessageSquare className="h-4 w-4 text-[var(--brand-soft)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-on-surface)]">Driver Support</p>
                  <p className="text-xs text-green-500">AI Assistant · Online</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--brand-strong)] text-[var(--brand-ink)] rounded-br-sm"
                        : "bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-surface-container-highest)] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Typing…</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border bg-card">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[38px] max-h-[120px]"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  disabled={loading}
                />
                <Button
                  size="icon-sm"
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
