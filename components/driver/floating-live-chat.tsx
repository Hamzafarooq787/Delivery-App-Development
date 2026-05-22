"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getOrCreateChatSession,
  getChatMessages,
  sendChatMessage,
  markChatSessionRead,
} from "@/app/actions/chat"
import type { ChatMessage } from "@/app/actions/chat"

export function FloatingLiveChat() {
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [driverUnread, setDriverUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = useMemo(() => createClient(), [])

  // Init session
  useEffect(() => {
    getOrCreateChatSession().then(({ sessionId: sid }) => {
      if (sid) {
        setSessionId(sid)
        getChatMessages(sid).then(({ data }) => {
          setMessages(data)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })
  }, [])

  // Realtime subscription for chat_messages
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`chat-driver-${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage
        setMessages((prev) => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (msg.sender_role === "admin") {
          if (open) {
            // auto-mark read if panel open
            markChatSessionRead(sessionId, "driver")
          } else {
            setDriverUnread((n) => n + 1)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, sessionId, open])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  // Open chat when notification is clicked
  useEffect(() => {
    function onOpenChat() { setOpen(true) }
    window.addEventListener("open-driver-chat", onOpenChat)
    return () => window.removeEventListener("open-driver-chat", onOpenChat)
  }, [])

  // Mark read on open
  useEffect(() => {
    if (open && sessionId) {
      setDriverUnread(0)
      markChatSessionRead(sessionId, "driver")
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, sessionId])

  async function handleSend() {
    const text = input.trim()
    if (!text || !sessionId || sending) return
    setInput("")
    setSending(true)
    await sendChatMessage(sessionId, text, "driver")
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Live chat"
        className="fixed bottom-24 lg:bottom-8 right-4 lg:right-6 z-50 w-14 h-14 rounded-full bg-[#a3a6ff] text-[#0f00a4] shadow-[0_0_24px_rgba(163,166,255,0.45)] flex items-center justify-center transition-transform active:scale-90 hover:scale-105"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {open ? "close" : "chat_bubble"}
        </span>
        {driverUnread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#ff6e84] text-white text-[10px] font-black flex items-center justify-center shadow-lg">
            {driverUnread > 9 ? "9+" : driverUnread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-40 lg:bottom-24 right-4 lg:right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl overflow-hidden shadow-2xl border border-[#494847]/20 flex flex-col"
          style={{ height: "min(500px, 70vh)", background: "#131313" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#494847]/20 shrink-0 bg-[#1a1919]">
            <div className="w-9 h-9 rounded-full bg-[#a3a6ff]/20 flex items-center justify-center text-[#a3a6ff] font-bold text-xs shrink-0">AD</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-none">Support Team</p>
              <p className="text-[10px] text-[#6ee7b7] mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6ee7b7] inline-block animate-pulse" />
                Online
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#adaaaa] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-[#a3a6ff] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1a1919] border border-[#494847]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>support_agent</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Hi there! 👋</p>
                  <p className="text-xs text-[#adaaaa] mt-1 max-w-[220px]">Send a message to start chatting with our support team.</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_role === "driver" ? "justify-end" : "justify-start"}`}>
                  {msg.sender_role === "admin" && (
                    <div className="w-6 h-6 rounded-full bg-[#a3a6ff]/20 flex items-center justify-center text-[#a3a6ff] text-[9px] font-bold shrink-0 mr-2 mt-auto mb-0.5">AD</div>
                  )}
                  <div
                    className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender_role === "driver"
                        ? "bg-[#a3a6ff] text-[#0f00a4] rounded-br-sm font-medium"
                        : "bg-[#262626] text-white rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                    <p className={`text-[9px] mt-1 ${msg.sender_role === "driver" ? "text-[#0f00a4]/60 text-right" : "text-[#adaaaa]"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#494847]/20 bg-[#1a1919] shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                rows={1}
                disabled={sending || !sessionId}
                className="flex-1 resize-none bg-[#262626] border border-[#494847]/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[#a3a6ff]/40 transition-all min-h-[38px] max-h-[100px]"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !sessionId}
                className="w-9 h-9 rounded-xl bg-[#a3a6ff] text-[#0f00a4] flex items-center justify-center disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-[#0f00a4] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-[#494847] text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </>
  )
}
