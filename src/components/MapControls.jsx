import { IconPlus, IconMinus, IconReset, IconTrash } from "./icons";
import { num, intNum } from "../lib/format";

const TOOL_LABELS = [
  { id: "measure", label: "Measure" },
  { id: "area", label: "Area" },
  { id: "path", label: "Path" },
];

export default function MapControls({
  mode,
  setMode,
  units,
  setUnits,
  points,
  hover,
  cursor,
  mapSize,
  result,
  onZoomIn,
  onZoomOut,
  onReset,
  onClear,
}) {
  const active = points.length > 0;

  return (
    <>
      {/* Cursor readout */}
      <div className="absolute bottom-[64px] left-3 z-[900] pointer-events-none select-none">
        <div className="bg-white/95 backdrop-blur rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-zinc-200 px-3 py-2 font-mono text-[11px] leading-4 max-w-[320px]">
          {cursor ? (
            <>
              <div className="font-semibold text-zinc-800">
                {cursor.x.toFixed(1)} px, {cursor.y.toFixed(1)} px
              </div>
              <div className="text-zinc-500">
                {cursor.lat.toFixed(4)}° lat • {cursor.kmX.toFixed(1)} km (
                {cursor.miX.toFixed(1)} mi) from origin
              </div>
            </>
          ) : (
            <div className="text-zinc-400">Hover map for coords</div>
          )}
        </div>
      </div>
      {/* Zoom + reset */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.14)] border border-zinc-200 overflow-hidden flex flex-col">
          <button
            onClick={onZoomIn}
            title="Zoom in (+)"
            className="w-10 h-10 flex items-center justify-center hover:bg-zinc-50 border-b border-zinc-100 text-zinc-700"
          >
            <IconPlus width={16} height={16} />
          </button>
          <button
            onClick={onZoomOut}
            title="Zoom out (−)"
            className="w-10 h-10 flex items-center justify-center hover:bg-zinc-50 text-zinc-700"
          >
            <IconMinus width={16} height={16} />
          </button>
        </div>
        <button
          onClick={onReset}
          title="Reset view"
          className="w-10 h-10 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.14)] border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 text-zinc-600"
        >
          <IconReset width={16} height={16} />
        </button>
      </div>

      {/* Mobile tool bar */}
      <div className="md:hidden absolute top-3 left-3 right-[64px] z-[1000] flex gap-1.5">
        {TOOL_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 h-9 rounded-full text-[12px] font-semibold border shadow-sm ${
              mode === t.id
                ? "bg-[#0e7490] text-white border-[#0e7490]"
                : "bg-white text-zinc-700 border-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        {active && (
          <button
            onClick={onClear}
            title="Clear"
            className="w-9 h-9 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600"
          >
            <IconTrash width={14} height={14} />
          </button>
        )}
      </div>

      <div className="md:hidden absolute top-[52px] left-3 z-[1000] flex rounded-full bg-white border border-zinc-200 p-0.5 shadow-sm">
        {["metric", "imperial", "both"].map((u) => (
          <button
            key={u}
            onClick={() => setUnits(u)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              units === u ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            {u === "metric" ? "km" : u === "imperial" ? "mi" : "both"}
          </button>
        ))}
      </div>

      {/* Live readout pill */}
      {active && hover && (
        <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-zinc-900/90 text-white text-[11px] font-mono px-3.5 py-2 rounded-full shadow-lg flex flex-col items-center gap-0.5 max-w-[92vw] backdrop-blur">
            {mode === "measure" && (
              <>
                {result?.kind === "distance" ? (
                  <>
                    <span className="font-bold">
                      {num(result.data.km, 1)} km • {num(result.data.mi, 1)} miles
                    </span>
                    <span className="text-[10px] opacity-80">
                      {num(result.data.nm, 1)} NM • corr {num(result.data.kmCorr, 1)} km /{" "}
                      {num(result.data.miCorr, 1)} mi
                    </span>
                  </>
                ) : (
                  <span>Move • click second point</span>
                )}
              </>
            )}
            {mode === "path" && (
              <>
                {result?.kind === "path" ? (
                  <>
                    <span className="font-bold">
                      {num(result.data.totalKm, 1)} km / {num(result.data.totalMi, 1)} mi
                    </span>
                    <span className="text-[10px] opacity-80">
                      corr {num(result.data.totalKmCorr, 1)} km • {points.length} pts
                    </span>
                  </>
                ) : (
                  <span>{points.length} pts • click to extend</span>
                )}
              </>
            )}
            {mode === "area" && (
              <>
                {result?.kind === "area" ? (
                  <>
                    <span className="font-bold">
                      {intNum(result.data.areaKm2)} km² / {intNum(result.data.areaMi2)} mi²
                    </span>
                    <span className="text-[10px] opacity-80">
                      {points.length} vertices • dbl-click to close
                    </span>
                  </>
                ) : (
                  <span>
                    {points.length} pts • double-click to close
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}