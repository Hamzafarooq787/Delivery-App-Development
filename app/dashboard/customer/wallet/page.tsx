"use client"

import { useEffect, useState, useTransition } from "react"
import Header from "@/components/customer/Header"
import { getWalletBalance, getWalletTransactions, topUpWallet } from "@/app/actions/wallet"
import type { WalletTransaction } from "@/app/actions/wallet"

const QUICK_AMOUNTS = [5, 10, 20, 50]

const TX_META: Record<
  WalletTransaction["type"],
  { icon: string; iconColor: string; bgColor: string; label: string }
> = {
  topup: {
    icon: "add_circle",
    iconColor: "text-[#6ee7b7]",
    bgColor: "bg-[#6ee7b7]/10",
    label: "Top Up",
  },
  cashback: {
    icon: "replay",
    iconColor: "text-[#60a5fa]",
    bgColor: "bg-[#60a5fa]/10",
    label: "Cashback",
  },
  cancellation_fee: {
    icon: "remove_circle",
    iconColor: "text-[#ff6e84]",
    bgColor: "bg-[#ff6e84]/10",
    label: "Cancellation Fee",
  },
  deduction: {
    icon: "remove_circle",
    iconColor: "text-[#fb923c]",
    bgColor: "bg-[#fb923c]/10",
    label: "Deduction",
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // Top-up modal state
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<number>(10)
  const [customAmount, setCustomAmount] = useState("")
  const [isPending, startTransition] = useTransition()
  const [topUpResult, setTopUpResult] = useState<{ success: boolean; message: string } | null>(null)

  async function loadData() {
    setLoading(true)
    const [balRes, txRes] = await Promise.all([getWalletBalance(), getWalletTransactions()])
    setBalance(balRes.balance)
    setTransactions(txRes.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleQuickAmount(amt: number) {
    setTopUpAmount(amt)
    setCustomAmount("")
  }

  function handleCustomAmountChange(val: string) {
    setCustomAmount(val)
    const parsed = parseFloat(val)
    if (!isNaN(parsed) && parsed > 0) setTopUpAmount(parsed)
  }

  function handleTopUp() {
    const finalAmount = customAmount ? parseFloat(customAmount) : topUpAmount
    if (isNaN(finalAmount) || finalAmount < 1 || finalAmount > 500) {
      setTopUpResult({ success: false, message: "Please enter an amount between £1 and £500." })
      return
    }
    startTransition(async () => {
      const res = await topUpWallet(finalAmount)
      if (res.success) {
        setTopUpResult({ success: true, message: `£${finalAmount.toFixed(2)} added to your wallet!` })
        setTimeout(() => {
          setShowTopUp(false)
          setTopUpResult(null)
          setCustomAmount("")
          setTopUpAmount(10)
          loadData()
        }, 1800)
      } else {
        setTopUpResult({ success: false, message: res.error ?? "Top-up failed. Please try again." })
      }
    })
  }

  const isNegative = balance < 0

  return (
    <>
      <Header />
      <main className="pt-16 pb-28 md:pb-8 px-4 md:pl-72 md:pr-8 min-h-screen bg-[#0e0e0e]">
        <div className="pt-5 md:pt-8 max-w-2xl mx-auto md:mx-0">

          {/* ── Page Title ── */}
          <div className="mb-6 md:mb-8">
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Wallet
            </h2>
            <p className="text-[#adaaaa] text-sm mt-1">
              Manage your balance and view transaction history.
            </p>
          </div>

          {/* ── Balance Card ── */}
          <div className="bg-[#1a1919] border border-[#494847]/20 rounded-2xl p-6 mb-4">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs text-[#adaaaa] uppercase tracking-widest font-semibold mb-2">
                  Available Balance
                </p>
                {loading ? (
                  <div className="h-10 w-32 bg-[#262626] rounded-xl animate-pulse" />
                ) : (
                  <p className={`text-4xl font-black tracking-tight ${isNegative ? "text-[#ff6e84]" : "text-white"}`}>
                    {isNegative ? "-" : ""}£{Math.abs(balance).toFixed(2)}
                  </p>
                )}
                {isNegative && (
                  <p className="text-xs text-[#ff6e84] mt-1 font-semibold">
                    Outstanding balance — will be deducted from next top-up
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#6ee7b7]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#6ee7b7] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  account_balance_wallet
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowTopUp(true)}
              className="w-full bg-[#6ee7b7] text-[#052e16] font-bold text-sm py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                add_circle
              </span>
              Add Funds
            </button>
          </div>

          {/* ── Non-refundable notice ── */}
          <div className="bg-[#262626] border border-[#494847]/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#fb923c] text-lg mt-0.5 shrink-0">info</span>
            <p className="text-xs text-[#adaaaa] leading-relaxed">
              <strong className="text-white">Wallet balance is non-refundable</strong> and can only be used for shipments.
              For withdrawal requests or serious issues, please{" "}
              <span className="text-[#60a5fa] font-semibold">contact admin support</span>.
            </p>
          </div>

          {/* ── Transaction History ── */}
          <div>
            <h3 className="text-sm font-bold text-[#adaaaa] uppercase tracking-widest mb-3">
              Transaction History
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[#1a1919] rounded-xl h-16 animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-[#1a1919] border border-[#494847]/20 rounded-2xl px-6 py-12 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#262626] flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[#adaaaa] text-2xl">receipt_long</span>
                </div>
                <p className="text-sm font-bold text-white">No transactions yet</p>
                <p className="text-xs text-[#adaaaa] mt-1">
                  Top up your wallet to get started.
                </p>
              </div>
            ) : (
              <div className="bg-[#1a1919] border border-[#494847]/20 rounded-2xl overflow-hidden">
                {transactions.map((tx, idx) => {
                  const meta = TX_META[tx.type] ?? TX_META.deduction
                  const isCredit = tx.amount > 0
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-4 px-4 py-4 ${idx < transactions.length - 1 ? "border-b border-[#494847]/10" : ""}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bgColor}`}>
                        <span className={`material-symbols-outlined text-xl ${meta.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {meta.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {tx.description ?? meta.label}
                        </p>
                        <p className="text-xs text-[#adaaaa] mt-0.5">{formatDate(tx.created_at)}</p>
                      </div>
                      <p className={`text-sm font-black tabular-nums shrink-0 ${isCredit ? "text-[#6ee7b7]" : "text-[#ff6e84]"}`}>
                        {isCredit ? "+" : ""}£{Math.abs(tx.amount).toFixed(2)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Top Up Modal ── */}
      {showTopUp && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { if (!isPending) { setShowTopUp(false); setTopUpResult(null) } }}
          />
          <div className="relative w-full max-w-sm bg-[#1a1919] border border-[#494847]/20 rounded-2xl overflow-hidden shadow-2xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/15">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#6ee7b7]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#6ee7b7] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    add_circle
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">Add Funds</h2>
              </div>
              {!isPending && (
                <button
                  onClick={() => { setShowTopUp(false); setTopUpResult(null) }}
                  className="text-[#adaaaa] hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            <div className="px-5 py-5 space-y-4">
              {topUpResult ? (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${topUpResult.success ? "bg-[#6ee7b7]/10 border border-[#6ee7b7]/20" : "bg-[#ff6e84]/10 border border-[#ff6e84]/20"}`}>
                  <span className={`material-symbols-outlined ${topUpResult.success ? "text-[#6ee7b7]" : "text-[#ff6e84]"}`}>
                    {topUpResult.success ? "check_circle" : "error"}
                  </span>
                  <p className="text-sm font-semibold text-white">{topUpResult.message}</p>
                </div>
              ) : (
                <>
                  {/* Quick amounts */}
                  <div>
                    <p className="text-xs text-[#adaaaa] mb-2 font-semibold uppercase tracking-wider">Quick Select</p>
                    <div className="grid grid-cols-4 gap-2">
                      {QUICK_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          onClick={() => handleQuickAmount(amt)}
                          className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                            topUpAmount === amt && !customAmount
                              ? "bg-[#6ee7b7] text-[#052e16]"
                              : "bg-[#262626] text-[#adaaaa] hover:text-white"
                          }`}
                        >
                          £{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount */}
                  <div>
                    <p className="text-xs text-[#adaaaa] mb-2 font-semibold uppercase tracking-wider">Custom Amount</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#adaaaa] font-bold">£</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full bg-[#262626] border border-[#494847]/30 rounded-xl py-3 pl-8 pr-4 text-sm text-white placeholder:text-[#adaaaa]/50 focus:outline-none focus:border-[#6ee7b7]/50 transition-colors"
                      />
                    </div>
                    <p className="text-[10px] text-[#adaaaa]/60 mt-1">Min £1 — Max £500</p>
                  </div>

                  {/* Selected summary */}
                  <div className="bg-[#262626] rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-[#adaaaa] font-semibold">Amount to Add</span>
                    <span className="text-lg font-black text-[#6ee7b7]">
                      £{customAmount ? (parseFloat(customAmount) || 0).toFixed(2) : topUpAmount.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#adaaaa]/60 text-center leading-relaxed">
                    This is a demo top-up. No real payment will be processed.
                  </p>

                  <button
                    onClick={handleTopUp}
                    disabled={isPending}
                    className="w-full bg-[#6ee7b7] text-[#052e16] font-bold text-sm py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isPending ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Processing…</>
                    ) : (
                      <><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>Top Up Wallet</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
