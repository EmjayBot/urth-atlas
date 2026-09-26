import { memo } from "react";
import { KM_PER_PX, MI_PER_PX, KM2_PER_PX2, MI2_PER_PX2 } from "../lib/scale";

function Footer({ status }) {
  return (
    <footer className="h-auto min-h-[40px] shrink-0 bg-white border-t border-zinc-200 flex flex-wrap items-center px-3 md:px-4 gap-2 py-1.5 z-[1001] text-[11px] font-mono">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            status === "blocked" ? "bg-amber-500" : "bg-[#1a6f34]"
          } ${status === "loading" ? "animate-pulse" : ""}`}
        />
        <span className="font-bold tracking-wide uppercase text-zinc-700">Scale:</span>
      </div>
      <span className="text-zinc-900 font-semibold bg-[#eef6ef] border border-[#1a6f34]/20 px-2.5 py-0.5 rounded-full">
        1 pixel = {KM_PER_PX.toFixed(3)} km ({MI_PER_PX.toFixed(3)} mi) • 1 px² ={" "}
        {KM2_PER_PX2.toFixed(2)} km² ({MI2_PER_PX2.toFixed(3)} mi²)
      </span>
      <span className="hidden xl:inline text-zinc-500">
        Distance: px × {KM_PER_PX.toFixed(4)} km • Area: px² × {KM2_PER_PX2.toFixed(2)} km² •
        If spherical: lon ×cosφ • NM = km×0.539957
      </span>
      <div className="ml-auto flex items-center gap-2 pl-3 flex-wrap">
        <span className="hidden md:inline text-[10px] text-zinc-400">
          kbd: <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">M</kbd>{" "}
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">A</kbd>{" "}
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">P</kbd> tool ·{" "}
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">Esc</kbd> clear ·{" "}
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">+</kbd>/
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">−</kbd> zoom
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#eef6ef] border border-[#1a6f34]/20 text-[#1a6f34] font-semibold text-[10px] tracking-wide uppercase">
          km + mi • Accurate • Linked to TEPwiki
        </span>
      </div>
    </footer>
  );
}

export default memo(Footer);