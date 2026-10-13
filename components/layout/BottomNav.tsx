export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 rounded-t-2xl bg-[#0e0e0e]/95 backdrop-blur-md border-t border-[#494847]/20 flex justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col items-center text-[var(--color-primary)] drop-shadow-[0_0_8px_rgba(var(--brand-rgb),0.4)]">
        <span className="material-symbols-outlined">grid_view</span>
        <span className="font-inter text-[10px] uppercase tracking-widest font-bold mt-1">Home</span>
      </div>
      <div className="flex flex-col items-center text-[#adaaaa] active:bg-[#201f1f] transition-all p-2 rounded-lg">
        <span className="material-symbols-outlined">package_2</span>
        <span className="font-inter text-[10px] uppercase tracking-widest font-bold mt-1">Logistics</span>
      </div>
      <div className="flex flex-col items-center text-[#adaaaa] active:bg-[#201f1f] transition-all p-2 rounded-lg">
        <span className="material-symbols-outlined">explore</span>
        <span className="font-inter text-[10px] uppercase tracking-widest font-bold mt-1">Map</span>
      </div>
      <div className="flex flex-col items-center text-[#adaaaa] active:bg-[#201f1f] transition-all p-2 rounded-lg">
        <span className="material-symbols-outlined">person</span>
        <span className="font-inter text-[10px] uppercase tracking-widest font-bold mt-1">Profile</span>
      </div>
    </nav>
  )
}

