export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#a3a6ff]/5 blur-[120px]" />
      </div>

      <div className="relative text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[#a3a6ff] text-4xl">wifi_off</span>
        </div>
        <h1 className="font-headline text-2xl font-extrabold text-white mb-3">You&apos;re Offline</h1>
        <p className="text-[#adaaaa] text-sm leading-relaxed mb-8">
          No internet connection detected. Please check your network and try again.
          Your data will sync automatically when you&apos;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm px-6 py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Try Again
        </button>
      </div>
    </main>
  )
}
