"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

function playChime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination); osc.type = "sine"; osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35)
      osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.35)
    })
  } catch {}
}
import {
  getAdminChatSessions,
  getChatMessages,
  sendChatMessage,
  markChatSessionRead,
} from "@/app/actions/chat"
import type { ChatMessage, ChatSession } from "@/app/actions/chat"

export function AdminChatPanel({ userId }: { userId: string }) {
  const [open, setOpen]                 = useState(false)
  const [sessions, setSessions]         = useState<ChatSession[]>([])
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState("")
  const [sending, setSending]           = useState(false)
  const [loadingMsgs, setLoadingMsgs]   = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)
  const supabase   = useMemo(() => createClient(), [])

  const totalUnread = sessions.reduce((s, sess) => s + (sess.admin_unread ?? 0), 0)

  const loadSessions = useCallback(() => {
    getAdminChatSessions().then(({ data }) => setSessions(data))
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Open panel when a chat notification is clicked in the notifications bell
  useEffect(() => {
    function onOpenChat() {
      setOpen(true)
      loadSessions()
    }
    window.addEventListener("open-admin-chat", onOpenChat)
    return () => window.removeEventListener("open-admin-chat", onOpenChat)
  }, [loadSessions])

  // Realtime: new messages (admin sees all)
  useEffect(() => {
    const channel = supabase
      .channel(`admin-chat-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
      }, (payload) => {
        const msg = payload.new as ChatMessage
        if (msg.sender_role === "driver") {
          // Play chime for every incoming driver message
          playChime()
        }
        if (msg.session_id === selectedId) {
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.sender_role === "driver") {
            markChatSessionRead(msg.session_id, "admin")
          }
        }
        loadSessions()
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "chat_sessions",
      }, () => { loadSessions() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, selectedId, loadSessions])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    return () => document.removeEventListener("mousedown", onMouse)
  }, [open])

  async function selectSession(sess: ChatSession) {
    setSelectedId(sess.id)
    setLoadingMsgs(true)
    const { data } = await getChatMessages(sess.id)
    setMessages(data)
    setLoadingMsgs(false)
    await markChatSessionRead(sess.id, "admin")
    setSessions((prev) => prev.map((s) => s.id === sess.id ? { ...s, admin_unread: 0 } : s))
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function handleSend() {
    if (!selectedId || !input.trim() || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    await sendChatMessage(selectedId, text, "admin")
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null

  return (
    <div className="relative" ref={panelRef}>
      {/* Chat icon button */}
      <button
        onClick={() => { setOpen((o) => !o); loadSessions() }}
        aria-label="Driver chats"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]"
            : "text-[#adaaaa] hover:text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/10"
        }`}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: totalUnread > 0 ? "'FILL' 1" : "'FILL' 0" }}
        >
          chat
        </span>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-secondary)] text-[#1a0030] text-[9px] font-black flex items-center justify-center leading-none shadow-lg shadow-[var(--color-secondary)]/40">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 z-[500] rounded-2xl overflow-hidden border border-[#494847]/25 shadow-2xl flex"
          style={{
            width: "clamp(320px, 90vw, 520px)",
            height: "480px",
            background: "#111111",
            boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--brand-rgb),0.08)",
          }}
        >
          {/* ── Sessions sidebar ── */}
          <div className="w-[155px] shrink-0 border-r border-[#494847]/20 flex flex-col">
            <div className="px-3 py-3 border-b border-[#494847]/20 shrink-0">
              <p className="text-xs font-bold text-white">Driver Chats</p>
              <p className="text-[10px] text-[#adaaaa] mt-0.5">
                {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="overflow-y-auto flex-1">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <span className="material-symbols-outlined text-[#494847] text-3xl mb-2">chat_bubble_outline</span>
                  <p className="text-[10px] text-[#494847]">No driver chats yet</p>
                </div>
              ) : (
                sessions.map((sess) => {
                  const initials = (sess.driver_name ?? "D").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={sess.id}
                      onClick={() => selectSession(sess)}
                      className={`w-full text-left px-3 py-2.5 border-b border-[#494847]/10 transition-colors ${
                        selectedId === sess.id ? "bg-[var(--color-secondary)]/10" : "hover:bg-[#1a1919]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] text-[8px] font-bold shrink-0">
                          {initials}
                        </div>
                        <p className="text-xs font-semibold text-white truncate flex-1">
                          {sess.driver_name ?? "Driver"}
                        </p>
                        {sess.admin_unread > 0 && (
                          <span className="min-w-[16px] h-4 px-0.5 rounded-full bg-[var(--color-secondary)] text-[#1a0030] text-[8px] font-black flex items-center justify-center shrink-0">
                            {sess.admin_unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#adaaaa] truncate">{sess.last_message || "No messages yet"}</p>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Chat view ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedSession ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a1919] border border-[#494847]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#494847] text-2xl">forum</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Select a conversation</p>
                  <p className="text-xs text-[#adaaaa] mt-1">Choose a driver from the left to view their messages</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b border-[#494847]/20 shrink-0 flex items-center gap-3 bg-[#1a1919]">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] text-xs font-bold shrink-0">
                    {(selectedSession.driver_name ?? "D").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-none">{selectedSession.driver_name}</p>
                    <p className="text-[10px] text-[#adaaaa] mt-0.5">Driver</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-5 h-5 border-2 border-[var(--color-secondary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-[#494847]">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                            msg.sender_role === "admin"
                              ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-br-sm font-medium"
                              : "bg-[#262626] text-white rounded-bl-sm"
                          }`}
                        >
                          {msg.content}
                          <p className={`text-[9px] mt-1 ${msg.sender_role === "admin" ? "text-[var(--color-on-primary)]/60 text-right" : "text-[#adaaaa]"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-[#494847]/20 bg-[#1a1919] shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Reply to driver…"
                      rows={1}
                      disabled={sending}
                      className="flex-1 resize-none bg-[#262626] border border-[#494847]/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#494847] focus:outline-none focus:border-[var(--color-secondary)]/40 transition-all min-h-[36px] max-h-[80px]"
                      style={{ fieldSizing: "content" } as React.CSSProperties}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="w-8 h-8 rounded-xl bg-[var(--color-secondary)] text-[#1a0030] flex items-center justify-center disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shrink-0"
                    >
                      {sending ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#1a0030] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#494847] text-center mt-1">Enter to send · Shift+Enter for new line</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

