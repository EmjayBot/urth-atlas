import { useMemo, useState } from "react";
import { BASE_LAYERS, KM_PER_PX, MI_PER_PX, KM2_PER_PX2 } from "../lib/scale";
import { searchPlaces } from "../lib/places";
import MeasurementPanel from "./MeasurementPanel";
import { IconChevron, IconPin, IconTrash } from "./icons";

const KINDS = [
  { id: "nation", label: "Nation" },
  { id: "city", label: "City" },
];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[#e5e7eb]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f9fafb] transition-colors"
      >
        <span className="text-[12px] font-bold tracking-[0.14em] text-[#6b7280] uppercase">
          {title}
        </span>
        <IconChevron
          width={16}
          height={16}
          className={`text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function PinsSection({
  target,
  setTarget,
  local,
  sharedStatus,
  sharedCount,
  onCreate,
  onRemove,
  onSubmit,
  onClear,
}) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("nation");
  const [href, setHref] = useState("");

  const allPlaces = useMemo(() => {
    const arr = [];
    for (const [n, v] of Object.entries(local)) arr.push({ name: n, ...v });
    return arr;
  }, [local]);
  const matches = useMemo(() => searchPlaces(allPlaces, q, 6), [allPlaces, q]);
  const localCount = Object.keys(local).length;

  const pick = (n) => {
    const p = allPlaces.find((x) => x.name === n);
    setTarget({ name: n, kind: p?.kind ?? "nation", href: p?.href });
    setQ("");
  };

  return (
    <div className="space-y-2.5">
      {target && (
        <div className="rounded-lg bg-[#e6f4f1] border border-[#0e7490]/30 px-3 py-2">
          <div className="text-[11px] font-bold text-[#0e7490]">Placing: {target.name}</div>
          <div className="text-[11px] text-[#111827] mt-0.5">
            Click on the map where this {target.kind} actually is.
            <kbd className="ml-1 px-1 py-0.5 rounded bg-white border border-zinc-200">Esc</kbd>{" "}
            cancels.
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#d1d5db] p-2.5 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
          New {kind}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Asilica)"
          spellCheck={false}
          className="w-full h-9 px-3 rounded-md bg-[#f9fafb] border border-[#e5e7eb] focus:bg-white focus:border-[#0e7490] outline-none text-[13px] placeholder:text-zinc-400"
        />
        <div className="flex gap-1 rounded-md bg-[#f9fafb] p-1 border border-[#e5e7eb]">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`flex-1 h-6 rounded text-[11px] font-bold uppercase transition-all ${
                kind === k.id
                  ? "bg-white shadow-sm text-[#111827] border border-[#d1d5db]"
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
          className="w-full h-9 px-3 rounded-md bg-[#f9fafb] border border-[#e5e7eb] focus:bg-white focus:border-[#0e7490] outline-none text-[13px] placeholder:text-zinc-400"
        />
        <button
          onClick={() => {
            if (name.trim()) {
              onCreate({
                name,
                kind,
                href: href.trim() ? `/wiki/${href.trim().replace(/ /g, "_")}` : "",
              });
              setName("");
              setHref("");
            }
          }}
          disabled={!name.trim()}
          className="w-full h-8 rounded-md bg-[#0e7490] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-[#0c5a70] transition-colors"
        >
          <IconPin width={13} height={13} /> Add & place
        </button>
      </div>

      {localCount > 0 && (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Reposition a placed pin…"
            spellCheck={false}
            className="w-full h-9 px-3 rounded-md bg-[#f9fafb] border border-[#e5e7eb] focus:bg-white focus:border-[#0e7490] outline-none text-[13px] placeholder:text-zinc-400"
          />
          {q.trim() && (
            <div className="rounded-md border border-[#e5e7eb] overflow-hidden">
              {matches.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-zinc-500">No match</div>
              )}
              {matches.map((p) => (
                <button
                  key={p.name}
                  onClick={() => pick(p.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#e6f4f1] text-left transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${p.kind === "city" ? "bg-amber-500" : "bg-[#0e7490]"}`}
                  />
                  <span className="text-[13px] font-medium text-zinc-800 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="rounded-md border border-[#d1d5db] max-h-[140px] overflow-y-auto">
            {allPlaces.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[#e5e7eb] last:border-0"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${p.kind === "city" ? "bg-amber-500" : "bg-[#0e7490]"}`}
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
          <div className="flex gap-1.5">
            <button
              onClick={onSubmit}
              disabled={localCount === 0}
              className="flex-1 h-8 rounded-md bg-emerald-600 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-emerald-700 transition-colors"
            >
              <IconPin width={13} height={13} /> Submit to map
            </button>
            <button
              onClick={onClear}
              disabled={localCount === 0}
              className="h-8 px-3 rounded-md bg-white border border-[#d1d5db] text-zinc-600 text-[12px] font-semibold disabled:opacity-40 hover:bg-[#f9fafb] transition-colors"
            >
              Clear
            </button>
          </div>
        </>
      )}

      {localCount === 0 && (
        <div className="text-[12px] text-[#6b7280]">
          No pins yet — add one above.
          {sharedStatus === "ok" && (
            <span className="block mt-0.5 text-[11px] text-[#0e7490]">
              {sharedCount} community places shared with you.
            </span>
          )}
          {sharedStatus === "error" && (
            <span className="block mt-0.5 text-[11px] text-amber-600">
              Couldn't load community places.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function OverlayCheck({ label, checked, onChange, sub }) {
  return (
    <label className="flex items-center gap-2.5 py-1 select-none cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-[#0e7490] cursor-pointer"
      />
      <span className="flex flex-col leading-tight">
        <span className="text-[13px] text-[#111827] group-hover:text-[#0e7490] transition-colors">
          {label}
        </span>
        {sub && <span className="text-[11px] text-[#6b7280]">{sub}</span>}
      </span>
    </label>
  );
}

export default function Sidebar({
  open,
  layer,
  setLayer,
  opacity,
  setOpacity,
  showScale,
  setShowScale,
  showGrid,
  setShowGrid,
  showPixelGrid,
  setShowPixelGrid,
  showCoords,
  setShowCoords,
  showClouds,
  setShowClouds,
  showMarkers,
  setShowMarkers,
  showNations,
  setShowNations,
  status,
  mode,
  setMode,
  units,
  setUnits,
  points,
  setPoints,
  mapSize,
  cursor,
  result,
  onCopy,
  onShare,
  onSaveResult,
  saved,
  onDeleteSaved,
  target,
  setTarget,
  local,
  sharedStatus,
  sharedCount,
  onCreate,
  onRemove,
  onSubmit,
  onClear,
}) {
  if (!open) return null;

  return (
    <aside className="w-[340px] shrink-0 bg-white border-r border-[#e5e7eb] flex flex-col max-md:hidden z-[1000] shadow-[2px_0_8px_rgba(0,0,0,0.04)] overflow-y-auto">
      <Section title="Map Info">
        <div className="text-[15px] font-bold text-[#111827]">Urth Atlas</div>
        <div className="text-[12px] text-[#6b7280] mt-0.5">The East Pacific</div>
        <div className="text-[11px] text-[#6b7280] mt-2 leading-5">
          urthmaps.com • {KM2_PER_PX2.toFixed(2)} km²/px • {KM_PER_PX.toFixed(3)} km/px
        </div>
        <div className="mt-2 text-[11px] font-mono text-zinc-400">
          {status === "loading"
            ? "loading map…"
            : status === "blocked"
              ? "placeholder grid shown"
              : "map live • infinite horizontal"}
        </div>
      </Section>

      <Section title="Base Layer">
        <div className="space-y-1">
          {BASE_LAYERS.map((l) => (
            <label
              key={l.id}
              className="flex items-center gap-2.5 py-1 select-none cursor-pointer group"
            >
              <input
                type="radio"
                name="base-layer"
                checked={layer === l.id}
                onChange={() => setLayer(l.id)}
                className="w-4 h-4 accent-[#0e7490] cursor-pointer"
              />
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] text-[#111827] group-hover:text-[#0e7490] transition-colors">
                  {l.label}
                </span>
                <span className="text-[11px] text-[#6b7280]">{l.sub}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[#e5e7eb]">
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-1">
              <span>Opacity</span>
              <span className="font-mono">{opacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-[#0e7490] cursor-pointer"
            />
          </div>
        </div>
      </Section>

      <Section title="Overlays">
        <OverlayCheck label="Scale bar" checked={showScale} onChange={setShowScale} />
        <OverlayCheck label="Grid" checked={showGrid} onChange={setShowGrid} />
        <OverlayCheck
          label="Pixel grid"
          checked={showPixelGrid}
          onChange={setShowPixelGrid}
        />
        <OverlayCheck label="Coordinates" checked={showCoords} onChange={setShowCoords} />
        <OverlayCheck
          label="Clouds"
          checked={showClouds}
          onChange={setShowClouds}
          sub="Satellite view only"
        />
        <OverlayCheck
          label="City & region markers"
          checked={showMarkers}
          onChange={setShowMarkers}
        />
        <OverlayCheck
          label="Nation markers"
          checked={showNations}
          onChange={setShowNations}
          sub="Shared community places"
        />
      </Section>

      <Section title="Measurements">
        <MeasurementPanel
          mode={mode}
          setMode={setMode}
          units={units}
          setUnits={setUnits}
          points={points}
          setPoints={setPoints}
          mapSize={mapSize}
          cursor={cursor}
          result={result}
          onCopy={onCopy}
          onShare={onShare}
        />
        {result && (
          <button
            onClick={onSaveResult}
            className="mt-2 w-full h-8 rounded-md bg-[#0e7490] text-white text-[12px] font-semibold hover:bg-[#0c5a70] transition-colors"
          >
            Save measurement
          </button>
        )}
        {saved.length > 0 && (
          <div className="mt-2.5 rounded-md border border-[#d1d5db] divide-y divide-[#e5e7eb]">
            {saved.map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                  {s.kind}
                </span>
                <span className="text-[12px] text-zinc-700 font-mono truncate flex-1">
                  {s.label}
                </span>
                <button
                  onClick={() => onDeleteSaved(i)}
                  title="Delete"
                  className="w-5 h-5 rounded hover:bg-red-50 text-red-400 flex items-center justify-center shrink-0"
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2.5 text-[11px] text-[#6b7280] font-mono">
          1 px = {KM_PER_PX.toFixed(3)} km ({MI_PER_PX.toFixed(3)} mi)
        </div>
      </Section>

      <Section title="Pins">
        <PinsSection
          target={target}
          setTarget={setTarget}
          local={local}
          sharedStatus={sharedStatus}
          sharedCount={sharedCount}
          onCreate={onCreate}
          onRemove={onRemove}
          onSubmit={onSubmit}
          onClear={onClear}
        />
      </Section>
    </aside>
  );
}