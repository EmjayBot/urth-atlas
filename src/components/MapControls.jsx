import { IconPlus, IconMinus, IconCompass, IconTrash } from "./icons";

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
  satellite,
  setSatellite,
  onZoomIn,
  onZoomOut,
  onReset,
  onClear,
}) {
  const active = points.length > 0;

  return (
    <>
      {/* Bottom-right: zoom + recenter */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col items-center gap-1">
        <div className="bg-white rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#d1d5db] overflow-hidden flex flex-col">
          <button
            onClick={onZoomIn}
            title="Zoom in (+)"
            className="w-9 h-9 flex items-center justify-center hover:bg-[#f3f4f6] text-zinc-700"
          >
            <IconPlus width={16} height={16} />
          </button>
          <div className="h-px bg-[#e5e7eb] mx-1" />
          <button
            onClick={onZoomOut}
            title="Zoom out (−)"
            className="w-9 h-9 flex items-center justify-center hover:bg-[#f3f4f6] text-zinc-700"
          >
            <IconMinus width={16} height={16} />
          </button>
        </div>
        <button
          onClick={onReset}
          title="Recenter"
          className="w-9 h-9 bg-white rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#d1d5db] flex items-center justify-center hover:bg-[#f3f4f6] text-zinc-600"
        >
          <IconCompass width={16} height={16} />
        </button>
      </div>

      {/* Bottom-left: layer toggle pill */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="bg-white rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#d1d5db] p-0.5 flex">
          {[
            { id: false, label: "Map" },
            { id: true, label: "Satellite" },
          ].map((v) => (
            <button
              key={String(v.id)}
              onClick={() => setSatellite(v.id)}
              className={`h-7 px-3.5 rounded text-[12px] font-semibold uppercase tracking-wide transition-all ${
                satellite === v.id
                  ? "bg-[#0e7490] text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile tool bar */}
      <div className="md:hidden absolute top-3 left-3 right-[64px] z-[1000] flex gap-1.5">
        {TOOL_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 h-9 rounded-md text-[12px] font-semibold border shadow-sm ${
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
            className="w-9 h-9 rounded-md bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600"
          >
            <IconTrash width={14} height={14} />
          </button>
        )}
      </div>

      <div className="md:hidden absolute top-[52px] left-3 z-[1000] flex rounded-md bg-white border border-zinc-200 p-0.5 shadow-sm">
        {["metric", "imperial", "both"].map((u) => (
          <button
            key={u}
            onClick={() => setUnits(u)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
              units === u ? "bg-zinc-900 text-white" : "text-zinc-600"
            }`}
          >
            {u === "metric" ? "km" : u === "imperial" ? "mi" : "both"}
          </button>
        ))}
      </div>
    </>
  );
}