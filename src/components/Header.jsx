import { memo } from "react";
import { KM_PER_PX, MI_PER_PX } from "../lib/scale";
import SearchBar from "./SearchBar";
import { IconGlobe } from "./icons";

function Header({
  query,
  setQuery,
  onPlace,
  showNations,
  setShowNations,
}) {
  return (
    <header className="h-[64px] shrink-0 flex items-center gap-2.5 px-3 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] z-[1001] relative">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#0e7490] flex items-center justify-center text-white font-black text-[13px] tracking-widest">
          U
        </div>
        <div className="leading-none">
          <div className="font-[800] tracking-[0.14em] text-[15px] text-zinc-900">
            URTH ATLAS
          </div>
          <div className="text-[9px] font-semibold tracking-widest text-zinc-400 uppercase mt-0.5 hidden sm:block">
            Accurate scale map of Urth
          </div>
        </div>
        <div className="hidden lg:flex flex-col h-8 justify-center border-l border-zinc-200 pl-3 ml-1">
          <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            1 px =
          </span>
          <span className="text-[11px] font-mono text-[#0e7490] font-semibold">
            {KM_PER_PX.toFixed(3)} km ({MI_PER_PX.toFixed(3)} mi)
          </span>
        </div>
      </div>

      <SearchBar query={query} setQuery={setQuery} onPlace={onPlace} />

      <button
        onClick={() => setShowNations((v) => !v)}
        title="Toggle wiki nation markers"
        className={`h-9 px-3.5 rounded-full border text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 shrink-0 ${
          showNations
            ? "bg-[#0e7490] text-white border-[#0e7490] shadow-sm"
            : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
        }`}
      >
        <IconGlobe width={15} height={15} />
        <span className="hidden md:inline">Nations</span>
      </button>
    </header>
  );
}

export default memo(Header);