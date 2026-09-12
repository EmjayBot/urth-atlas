import { useMemo, useRef, useState, useEffect } from "react";
import { searchPlaces } from "../lib/places";
import { IconPin, IconClose, IconCopy, IconTrash } from "./icons";

export default function CalibrationPanel({
  open,
  setOpen,
  target,
  setTarget,
  overrides,
  onClearAll,
  onExport,
  onSubmit,
  mapSize,
  communityCount,
  communityStatus,
}) {
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const matches = useMemo(() => searchPlaces(q, 8), [q]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setQ("");
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={boxRef} className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Calibrate nation markers"
        className={`h-10 px-3 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.14)] border flex items-center gap-1.5 transition-all text-[12px] font-semibold ${
          open
            ? "bg-[#0e7490] text-white border-[#0e7490]"
            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <IconPin width={15} height={15} />
        Calibrate
        {Object.keys(overrides).length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
            {Object.keys(overrides).length}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-zinc-200 overflow-hidden w-[280px] animate-[toastIn_.16s_ease-out]">
          <div className="px-3.5 py-2.5 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-500">
                Calibrate
              </div>
              <div className="text-[11px] text-zinc-500">
                {Object.keys(overrides).length} positioned
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg hover:bg-zinc-100 text-zinc-500 flex items-center justify-center"
            >
              <IconClose width={15} height={15} />
            </button>
          </div>

          <div className="p-3 space-y-2.5">
            {target ? (
              <div className="rounded-xl bg-[#f0f9fa] border border-[#0e7490]/25 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#0e7490]">
                  Placing: {target}
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  Click on the map where this nation actually is. Press{" "}
                  <kbd className="px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">Esc</kbd> to
                  cancel.
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-zinc-500 leading-4">
                Search for a nation, then click its true spot on the map.
              </div>
            )}

            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search nation to place…"
                spellCheck={false}
                className="w-full h-9 px-3 rounded-xl bg-[#f1f3f4] border border-transparent focus:bg-white focus:border-zinc-200 focus:shadow-[0_1px_6px_rgba(0,0,0,0.12)] outline-none text-[13px] placeholder:text-zinc-500"
              />
              {q.trim() && (
                <div className="absolute top-[40px] left-0 right-0 bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden z-[1100]">
                  {matches.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-zinc-500">No match</div>
                  )}
                  {matches.map((p) => {
                    const done = overrides[p.name];
                    return (
                      <button
                        key={`${p.kind}-${p.name}`}
                        onClick={() => {
                          setTarget(p.name);
                          setQ("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f0f9fa] text-left transition-colors"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${p.kind === "city" ? "bg-amber-500" : done ? "bg-emerald-500" : "bg-zinc-300"}`}
                        />
                        <span className="text-[13px] font-medium text-zinc-800 truncate">
                          {p.name}
                        </span>
                        <span className="ml-auto text-[9px] uppercase tracking-wide text-zinc-400 font-semibold shrink-0">
                          {p.kind}
                        </span>
                        {done && (
                          <span className="ml-auto text-[9px] uppercase tracking-wide text-emerald-600 font-semibold shrink-0">
                            done
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {mapSize && (
              <div className="text-[10px] text-zinc-400 font-mono">
                Map: {mapSize.W}×{mapSize.H} px
                {communityStatus !== "empty" && communityCount > 0
                  ? ` · ${communityCount} shared`
                  : ""}
              </div>
            )}

            <div className="flex gap-1.5 pt-1">
              <button
                onClick={onSubmit}
                disabled={Object.keys(overrides).length === 0}
                className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-emerald-700 transition-colors"
              >
                <IconPin width={13} height={13} /> Submit to map
              </button>
              <button
                onClick={onExport}
                disabled={Object.keys(overrides).length === 0}
                className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                <IconCopy width={13} height={13} /> JSON
              </button>
              <button
                onClick={onClearAll}
                disabled={Object.keys(overrides).length === 0}
                className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                <IconTrash width={13} height={13} />
              </button>
            </div>
            {communityStatus === "ok" && (
              <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                Loaded {communityCount} shared positions from the community file.
              </div>
            )}
            {communityStatus === "error" && (
              <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                Couldn't load shared positions — showing only your local ones.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}