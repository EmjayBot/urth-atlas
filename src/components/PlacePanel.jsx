import { useMemo, useRef, useState, useEffect } from "react";
import { searchPlaces } from "../lib/places";
import { IconPin, IconClose, IconTrash } from "./icons";

const KINDS = [
  { id: "nation", label: "Nation" },
  { id: "city", label: "City" },
];

export default function PlacePanel({
  open,
  setOpen,
  target,
  setTarget,
  local,
  sharedCount,
  sharedStatus,
  onCreate,
  onRemove,
  onSubmit,
  onClear,
}) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("nation");
  const [href, setHref] = useState("");
  const boxRef = useRef(null);

  const allPlaces = useMemo(() => {
    const arr = [];
    for (const [n, v] of Object.entries(local)) arr.push({ name: n, ...v });
    return arr;
  }, [local]);
  const matches = useMemo(() => searchPlaces(allPlaces, q, 6), [allPlaces, q]);
  const localCount = Object.keys(local).length;

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setQ("");
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (name) => {
    const p = allPlaces.find((x) => x.name === name);
    setTarget({ name, kind: p?.kind ?? "nation", href: p?.href });
    setQ("");
  };

  return (
    <div ref={boxRef} className="absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add or place nations and cities"
        className={`h-10 px-3 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.14)] border flex items-center gap-1.5 transition-all text-[12px] font-semibold ${
          open
            ? "bg-[#0e7490] text-white border-[#0e7490]"
            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <IconPin width={15} height={15} />
        Add place
        {localCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
            {localCount}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-zinc-200 overflow-hidden w-[300px] animate-[toastIn_.16s_ease-out]">
          <div className="px-3.5 py-2.5 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-500">
                Add / place
              </div>
              <div className="text-[11px] text-zinc-500">
                {localCount} local · {sharedCount} shared
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
            {target && (
              <div className="rounded-xl bg-[#f0f9fa] border border-[#0e7490]/25 px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#0e7490]">
                  Placing: {target.name}
                </div>
                <div className="text-[11px] text-zinc-600 mt-1">
                  Click on the map where this {target.kind} actually is.
                  <kbd className="ml-1 px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200">Esc</kbd>{" "}
                  cancels.
                </div>
              </div>
            )}

            {/* New place */}
            <div className="rounded-xl border border-zinc-200 p-2.5 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                New {kind}
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. Asilica)"
                spellCheck={false}
                className="w-full h-9 px-3 rounded-lg bg-[#f1f3f4] border border-transparent focus:bg-white focus:border-zinc-200 outline-none text-[13px] placeholder:text-zinc-500"
              />
              <div className="flex gap-1 rounded-full bg-zinc-100 p-1 border border-zinc-200">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={`flex-1 h-6 rounded-full text-[11px] font-bold uppercase transition-all ${
                      kind === k.id
                        ? "bg-white shadow-sm text-zinc-900 border border-zinc-200"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <input
                value={href}
                onChange={(e) => setHref(e.target.value)}
                placeholder="TEPwiki page (optional, e.g. Asilica)"
                spellCheck={false}
                className="w-full h-9 px-3 rounded-lg bg-[#f1f3f4] border border-transparent focus:bg-white focus:border-zinc-200 outline-none text-[13px] placeholder:text-zinc-500"
              />
              <button
                onClick={() => {
                  if (name.trim()) {
                    onCreate({ name, kind, href: href.trim() ? `/wiki/${href.trim().replace(/ /g, "_")}` : "" });
                    setName("");
                    setHref("");
                  }
                }}
                disabled={!name.trim()}
                className="w-full h-8 rounded-lg bg-[#0e7490] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-[#0c6580] transition-colors"
              >
                <IconPin width={13} height={13} /> Add &amp; place
              </button>
            </div>

            {/* Reposition existing local places */}
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Reposition a placed place…"
                spellCheck={false}
                className="w-full h-9 px-3 rounded-xl bg-[#f1f3f4] border border-transparent focus:bg-white focus:border-zinc-200 outline-none text-[13px] placeholder:text-zinc-500"
              />
              {q.trim() && (
                <div className="absolute top-[40px] left-0 right-0 bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden z-[1100]">
                  {matches.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-zinc-500">No match</div>
                  )}
                  {matches.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => pick(p.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f0f9fa] text-left transition-colors"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${p.kind === "city" ? "bg-amber-500" : "bg-emerald-500"}`}
                      />
                      <span className="text-[13px] font-medium text-zinc-800 truncate">{p.name}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-wide text-zinc-400 font-semibold shrink-0">
                        {p.kind}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {localCount > 0 && (
              <div className="rounded-xl border border-zinc-200 max-h-[140px] overflow-y-auto">
                {allPlaces.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 px-2.5 py-1.5 border-b border-zinc-100 last:border-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${p.kind === "city" ? "bg-amber-500" : "bg-emerald-500"}`}
                    />
                    <span className="text-[12px] text-zinc-700 truncate flex-1">{p.name}</span>
                    {p.x != null && (
                      <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                        {Math.round(p.x)},{Math.round(p.y)}
                      </span>
                    )}
                    <button
                      onClick={() => onRemove(p.name)}
                      title="Remove"
                      className="w-5 h-5 rounded hover:bg-red-50 text-red-400 flex items-center justify-center shrink-0"
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 pt-1">
              <button
                onClick={onSubmit}
                disabled={localCount === 0}
                className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-emerald-700 transition-colors"
              >
                <IconPin width={13} height={13} /> Submit to map
              </button>
              <button
                onClick={onClear}
                disabled={localCount === 0}
                className="h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-600 text-[11px] font-semibold disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                Clear
              </button>
            </div>

            {sharedStatus === "ok" && (
              <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                Loaded {sharedCount} places shared by the community.
              </div>
            )}
            {sharedStatus === "empty" && (
              <div className="text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                No shared places yet — be the first to add one!
              </div>
            )}
            {sharedStatus === "error" && (
              <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                Couldn't load shared places — showing only your local ones.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}