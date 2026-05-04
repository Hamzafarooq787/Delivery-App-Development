"use client"

import { useState } from "react"

type VerificationDot = "verified" | "pending"

interface Driver {
  id: string
  name: string
  email: string
  signupDate: string
  initials?: string
  avatar?: string
  docs: [VerificationDot, VerificationDot, VerificationDot]
  experience: string
  vehicleClass: string
  role: string
}

const DRIVERS: Driver[] = [
  {
    id: "1",
    name: "Marcus Jensen",
    email: "marcus.j@kinetic-fleet.com",
    signupDate: "Oct 12, 2023",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJzibYMlJKWS-LS8MS05EqJT_kgnKwQkh6FrpnXPOPCfvq62_whZ2NXSR-Bm2bkK_dxtS-T-cBIjzuhB0TiOOiqFKB2RXvOsjre4eCgxh1iygo3PirxoN8WX4q84pt12TaFkNJub4hIKVQt79DlOhN7f4580r2p84ekhRLLOtjne6OCV5I5ERax4sEpvHTjJe5EmQ0Zlg6VT1hFkMR91Xn9aXRgLKXjdr2-9TnDo_g1XeUHvrIVm1NBCLerE3ITzOp8BI_pr2pXQ",
    docs: ["verified", "verified", "pending"],
    experience: "6.0 Years",
    vehicleClass: "Medium Duty",
    role: "HGV Class 2 Operator",
  },
  {
    id: "2",
    name: "Elena Rodriguez",
    email: "e.rodriguez@kinetic-fleet.com",
    signupDate: "Oct 14, 2023",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDBiRQ0JKLfEiOfD6blVpY9rwiuvqvCkSTFvUBmlZrH2nr24ex38R8N8td0iP3m7DF8Hylpm97uBSdSG8B6hinzBin0Icnl_SNmGj0M4c0mzD4F6Q5cgTIrG2pgZ2JkvHfqZrKZZpBwJZ7XFW_0bABQraAvINy3HpcDRe8qPCCDml8CzuyGpWptIDLWLHHMZCO9guqedJqFqYJ68r5Hm4xhZrBl4Io0yWxp7td2HK2UomL4M6A-cR_BhgJx_66scudoWrq_ZKzq5g",
    docs: ["verified", "verified", "verified"],
    experience: "8.5 Years",
    vehicleClass: "Heavy Duty",
    role: "HGV Class 1 Operator",
  },
  {
    id: "3",
    name: "David Chen",
    email: "d.chen@logix-core.net",
    signupDate: "Oct 15, 2023",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4pz_f6PM6egyNmMJD3eaBFZWkv4FlpsUKslTbCRMDK6QfeEbQBpPyl00hai9dHZZFIHa-piWBLb9jA1oob3AWnsbiObWyMsECJqHumPIJwEXXTASkcnaUsbvKURP9iSLqsiSxcUpe7Qdau1N5yAyMEtQeoHi_Zg37jC0ebJegRso75MtYW-Aw3ebBCy9dJl5bmZdGvThI4YaVBVfyMU-9Kd1jSbY8We72CRx3PYOLxbEERzmbnVncvnhxWWjOlLKoG-6DLpowYg",
    docs: ["verified", "pending", "pending"],
    experience: "3.2 Years",
    vehicleClass: "Light Duty",
    role: "Van Operator",
  },
  {
    id: "4",
    name: "Sarah Jenkins",
    email: "sarah.j@global-move.com",
    signupDate: "Oct 15, 2023",
    initials: "SJ",
    docs: ["verified", "verified", "pending"],
    experience: "5.0 Years",
    vehicleClass: "Medium Duty",
    role: "HGV Class 2 Operator",
  },
]

function DocDot({ status }: { status: VerificationDot }) {
  return (
    <span
      className={`w-2 h-2 rounded-full ${
        status === "verified" ? "bg-[#a3a6ff]" : "bg-[#494847]"
      }`}
    />
  )
}

type Tab = "pending" | "approved" | "rejected"

export default function AdminDriversPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending")
  const [selectedId, setSelectedId] = useState<string>("2")

  const selected = DRIVERS.find((d) => d.id === selectedId) ?? DRIVERS[0]

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
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-semibold transition-all capitalize ${
              activeTab === tab
                ? "border-b-2 border-[#a3a6ff] text-white"
                : "text-[#adaaaa] hover:text-white"
            }`}
          >
            {tab === "pending" ? (
              <>
                Pending Approval{" "}
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[#a3a6ff]/10 text-[#a3a6ff] text-[10px]">12</span>
              </>
            ) : (
              tab.charAt(0).toUpperCase() + tab.slice(1)
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="col-span-1 lg:col-span-8">
          <div className="space-y-3">
            {DRIVERS.map((driver) => {
              const isSelected = driver.id === selectedId
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
                  {driver.avatar ? (
                    <img
                      src={driver.avatar}
                      alt={driver.name}
                      className={`w-12 h-12 rounded-full object-cover ${driver.id === "3" ? "grayscale" : ""}`}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#6f00be]/20 flex items-center justify-center text-[#c180ff] font-bold text-sm">
                      {driver.initials}
                    </div>
                  )}
                  <div className="ml-4 flex-1">
                    <h4 className="font-bold text-white text-sm">{driver.name}</h4>
                    <p className="text-xs text-[#adaaaa]">{driver.email}</p>
                  </div>
                  <div className="hidden sm:block px-4 lg:px-6 text-right">
                    <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold">Signup Date</p>
                    <p className="text-sm text-white">{driver.signupDate}</p>
                  </div>
                  <div className="hidden sm:block px-4 lg:px-6">
                    <p className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 text-center">Status</p>
                    <div className="flex gap-1 justify-center">
                      {driver.docs.map((dot, i) => (
                        <DocDot key={i} status={dot} />
                      ))}
                    </div>
                  </div>
                  <span className={`material-symbols-outlined transition-colors ${isSelected ? "text-[#a3a6ff]" : "text-[#adaaaa] group-hover:text-[#a3a6ff]"}`}>
                    chevron_right
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-4">
          <div
            className="sticky top-24 rounded-2xl border border-[#494847]/15 overflow-hidden shadow-2xl"
            style={{ background: "rgba(38,38,38,0.6)", backdropFilter: "blur(40px)" }}
          >
            <div className="relative h-32 bg-gradient-to-br from-[#262626] to-[#0e0e0e]">
              {selected.avatar ? (
                <img
                  src={selected.avatar}
                  alt={selected.name}
                  className="w-20 h-20 rounded-2xl object-cover absolute -bottom-10 left-6 border-4 border-[#1a1919] shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#6f00be]/20 flex items-center justify-center text-[#c180ff] font-bold text-2xl absolute -bottom-10 left-6 border-4 border-[#1a1919] shadow-xl">
                  {selected.initials}
                </div>
              )}
            </div>
            <div className="p-6 pt-12">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                  <p className="text-sm text-[#a3a6ff] font-medium">{selected.role}</p>
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
                  <h5 className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-3">Verification Documents</h5>
                  <div className="grid grid-cols-2 gap-3">
                    {["ID_DRV_882.PDF", "INS_POL_2023.PDF"].map((label) => (
                      <div key={label} className="group relative rounded-xl overflow-hidden bg-[#000000] border border-[#494847]/10 cursor-zoom-in">
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
                    <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Experience</p>
                    <p className="text-sm font-semibold text-white">{selected.experience}</p>
                  </div>
                  <div className="bg-[#0e0e0e] p-3 rounded-lg border border-[#494847]/10">
                    <p className="text-[10px] text-[#adaaaa] uppercase font-bold">Vehicle Class</p>
                    <p className="text-sm font-semibold text-white">{selected.vehicleClass}</p>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button className="flex-1 bg-[#a70138] text-[#ffb2b9] hover:bg-[#a70138]/80 py-3 rounded-xl font-bold text-sm transition-all active:scale-95">
                    Reject Driver
                  </button>
                  <button className="flex-1 bg-[#a3a6ff] text-[#0f00a4] hover:bg-[#6063ee] py-3 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(163,166,255,0.2)] transition-all active:scale-95">
                    Approve Application
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
