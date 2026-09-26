import { memo } from "react";
import { KM_PER_PX, MI_PER_PX, KM2_PER_PX2 } from "../lib/scale";
import { num } from "../lib/format";

function StatusBar({ status, cursor }) {
  return (
    <footer className="h-[28px] shrink-0 bg-[#f9fafb] border-t border-[#e5e7eb] flex items-center gap-3 px-3 z-[1001] text-[12px] font-mono text-zinc-600 select-none overflow-hidden whitespace-nowrap">
      <div className="truncate">
        {cursor ? (
          <>
            X: {num(cursor.x, 0)} Y: {num(cursor.y, 0)} | {num(cursor.kmX, 0)} km E | Lat{" "}
            {num(cursor.lat, 1)}° Lng {num(cursor.lngDeg ?? 0, 1)}°
          </>
        ) : (
          "X: – Y: –"
        )}
        <span className="ml-2 text-zinc-400 hidden sm:inline">
          {status === "loading" && "loading map…"}
          {status === "blocked" && "placeholder grid"}
          {status === "ok" && "live map"}
        </span>
      </div>
      <div className="mx-auto hidden md:block">
        1 px = {KM_PER_PX.toFixed(3)} km ({MI_PER_PX.toFixed(3)} mi)
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span>
          © Urth Atlas • {KM2_PER_PX2.toFixed(2)} km²/px
        </span>
        <span className="text-zinc-300" aria-hidden="true">
          |
        </span>
        <a
          href="https://leafletjs.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Interactive maps powered by Leaflet"
          className="text-zinc-500 hover:text-[#1a6f34] transition-colors"
        >
          Leaflet
        </a>
        <a
          href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          title="Map imagery: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International"
          className="text-zinc-500 hover:text-[#1a6f34] transition-colors"
        >
          CC BY-NC-SA 4.0
        </a>
        <a
          href="https://urthmaps.com"
          target="_blank"
          rel="noopener noreferrer"
          title="Source maps at UrthMaps.com"
          className="text-zinc-500 hover:text-[#1a6f34] transition-colors"
        >
          UrthMaps.com
        </a>
      </div>
    </footer>
  );
}

export default memo(StatusBar);