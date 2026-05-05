"use client"

import { useState, useTransition } from "react"
import { adminApproveDriver, adminRejectDriver } from "@/app/actions/delivery"

type VerificationDot = "verified" | "pending"
type Tab = "pending" | "approved" | "rejected"

export type DriverRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
  status: "pending" | "approved" | "rejected"
}

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
}

function DocDot({ status }: { status: VerificationDot }) {
  return (
    <span
      className={`w-2 h-2 rounded-full ${
        status === "verified" ? "bg-[#a3a6ff]" : "bg-[#494847]"
      }`}
    />
  )
}

function statusToDots(status: "pending" | "approved" | "rejected"): [VerificationDot, VerificationDot, VerificationDot] {
  if (status === "approved") return ["verified", "verified", "verified"]
  return ["pending", "pending", "pending"]
}

export function DriversPanel({ drivers }: { drivers: DriverRow[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("pending")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = drivers.filter((d) => d.status === activeTab)
  const pendingCount = drivers.filter((d) => d.status === "pending").length
  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null

  function handleApprove() {
    if (!selected || isPending) return
    startTransition(async () => {
      await adminApproveDriver(selected.id)
    })
  }

  function handleReject() {
    if (!selected || isPending) return
    startTransition(async () => {
      await adminRejectDriver(selected.id)
    })
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-sans">
            Driver Onboarding
          </h2>
          <p className="text-[#adaaaa] mt-1 text-sm">
            Manage and verify new fleet operator applications.
          </p>
        </div>
        <button className="self-start sm:self-auto bg-[#a3a6ff] text-[#0f00a4] px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(163,166,255,0.2)] active:scale-95 transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Manual Entry
        </button>
      </div>

      <div className="flex gap-8 mb-6 border-b border-[#494847]/20">
        {(["pending", "approved", "rejected"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedId(null) }}
            className={`pb-4 text-sm font-semibold transition-all capitalize ${
              activeTab === tab
                ? "border-b-2 border-[#a3a6ff] text-white"
                : "text-[#adaaaa] hover:text-white"
            }`}
          >
            {tab === "pending" ? (
              <>
                Pending Approval{" "}
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[#a3a6ff]/10 text-[#a3a6ff] text-[10px]">
                  {pendingCount}
                </span>
              </>
            ) : (
              tab.charAt(0).toUpperCase() + tab.slice(1)
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-1 lg:col-span-8">
          {filtered.length === 0 ? (
            <p className="text-[#adaaaa] text-sm py-8 text-center">No {activeTab} drivers.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((driver) => {
                const isSelected = driver.id === selected?.id
                const dots = statusToDots(driver.status)
                const signupDate = new Date(driver.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedId(driver.id)}
                    className={`group flex items-center p-4 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#201f1f] border border-[#a3a6ff]/20 ring-1 ring-[#a3a6ff]/10"
                        : "bg-[#1a1919] hover:bg-[#201f1f] border border-transparent hover:border-[#494847]/10"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#6f00be]/20 flex items-center justify-center text-[#c180ff] font-bold text-sm">
                      {getInitials(driver.full_name)}
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-bold text-white text-sm">{driver.full_name}</h4>
                      <p className="text-xs text-[#adaaaa]">{driver.email}</p>
                    </div>
                    <div className="hidden sm:block px-4 lg:px-6 text-right">
                      <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold">Signup Date</p>
                      <p className="text-sm text-white">{signupDate}</p>
                    </div>
                    <div className="hidden sm:block px-4 lg:px-6">
                      <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 text-center">Status</p>
                      <div className="flex gap-1 justify-center">
                        {dots.map((dot, i) => (
                          <DocDot key={i} status={dot} />
                        ))}
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined transition-colors ${
                        isSelected ? "text-[#a3a6ff]" : "text-[#adaaaa] group-hover:text-[#a3a6ff]"
                      }`}
                    >
                      chevron_right
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="col-span-1 lg:col-span-4">
          {selected ? (
            <div
              className="sticky top-24 rounded-2xl border border-[#494847]/15 overflow-hidden shadow-2xl"
              style={{ background: "rgba(38,38,38,0.6)", backdropFilter: "blur(40px)" }}
            >
              <div className="relative h-32 bg-gradient-to-br from-[#262626] to-[#0e0e0e]">
                <div className="w-20 h-20 rounded-2xl bg-[#6f00be]/20 flex items-center justify-center text-[#c180ff] font-bold text-2xl absolute -bottom-10 left-6 border-4 border-[#1a1919] shadow-xl">
                  {getInitials(selected.full_name)}
                </div>
              </div>
              <div className="p-6 pt-12">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selected.full_name}</h3>
                    <p className="text-sm text-[#a3a6ff] font-medium">Driver</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-lg bg-[#1a1919] text-[#adaaaa] hover:text-white transition-all">
                      <span className="material-symbols-outlined text-lg">mail</span>
                    </button>
                    <button className="p-2 rounded-lg bg-[#1a1919] text-[#adaaaa] hover:text-white transition-all">
                      <span className="material-symbols-outlined text-lg">phone</span>
                    </button>
                  </div>
                </div>
                <div className="mt-8 space-y-6">
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-3">
                      Verification Documents
                    </h5>
                    <div className="grid grid-cols-2 gap-3">
                      {["ID_DRV_882.PDF", "INS_POL_2023.PDF"].map((label) => (
                        <div
                          key={label}
                          className="group relative rounded-xl overflow-hidden bg-[#000000] border border-[#494847]/10 cursor-zoom-in"
                        >
                          <div className="aspect-video bg-[#262626] flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-[#494847]">description</span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-[#1a1919]/90 text-[10px] font-bold text-center text-white">
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0e0e0e] p-3 rounded-lg border border-[#494847]/10">
                      <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Email</p>
                      <p className="text-xs font-semibold text-white truncate">{selected.email}</p>
                    </div>
                    <div className="bg-[#0e0e0e] p-3 rounded-lg border border-[#494847]/10">
                      <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Phone</p>
                      <p className="text-sm font-semibold text-white">{selected.phone ?? "—"}</p>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={handleReject}
                      disabled={isPending || selected.status === "rejected"}
                      className="flex-1 bg-[#a70138] text-[#ffb2b9] hover:bg-[#a70138]/80 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject Driver
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isPending || selected.status === "approved"}
                      className="flex-1 bg-[#a3a6ff] text-[#0f00a4] hover:bg-[#6063ee] py-3 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(163,166,255,0.2)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve Application
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="sticky top-24 rounded-2xl border border-[#494847]/15 p-8 text-center"
              style={{ background: "rgba(38,38,38,0.6)", backdropFilter: "blur(40px)" }}
            >
              <p className="text-[#adaaaa] text-sm">Select a driver to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
