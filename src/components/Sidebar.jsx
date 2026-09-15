import { useMemo, useState } from "react";
import { BASE_MAPS, DATA_OVERLAYS, getLayer, KM_PER_PX, MI_PER_PX, KM2_PER_PX2 } from "../lib/scale";
import { searchPlaces } from "../lib/places";
import { latFromPixel, lngFromX } from "../lib/geo";
import { IS_LOW_MEM } from "../lib/device";
import MeasurementPanel from "./MeasurementPanel";
import { IconChevron, IconPin, IconTrash } from "./icons";

// Satellite (+ its cloud layer) is disabled on low-memory devices.
// Phones additionally only get layers with downscaled mobile variants —
// an 84MP decode kills mobile browser tabs.
const VISIBLE_LAYERS = IS_LOW_MEM
  ? BASE_MAPS.filter((l) => l.mobileUrl)
  : BASE_MAPS;
// Same for thematic overlays: remote full-res layers need a desktop browser.
const VISIBLE_OVERLAYS = IS_LOW_MEM
  ? DATA_OVERLAYS.filter((l) => l.mobileUrl)
  : DATA_OVERLAYS;

const KINDS = [
  { id: "nation", label: "Nation" },
  { id: "capital", label: "Capital" },
  { id: "city", label: "City" },
  { id: "town", label: "Town" },
];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[#e5e7eb]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f9fafb] transition-colors"
      >
        <span className="urth-side-title text-[12px] font-bold tracking-[0.14em] text-[#6b7280] uppercase">
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
  shared,
  removed,
  onUndoRemove,
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
  const [territory, setTerritory] = useState(false);

  const allPlaces = useMemo(() => {
    const arr = [];
    for (const [n, v] of Object.entries(local)) arr.push({ name: n, ...v });
    return arr;
  }, [local]);
  const matches = useMemo(() => searchPlaces(allPlaces, q, 6), [allPlaces, q]);
  const localCount = Object.keys(local).length;
  // Shared names marked for community removal (still present upstream,
  // not re-added locally).
  const pendingRemovals = useMemo(
    () => Object.keys(removed ?? {}).filter((n) => shared?.[n] && !local[n]),
    [removed, shared, local]
  );
  const pendingCount = localCount + pendingRemovals.length;

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
        {kind === "nation" && (
          <label className="flex items-center gap-2.5 py-1 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={territory}
              onChange={(e) => setTerritory(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0e7490] cursor-pointer"
            />
            <span className="text-[13px] text-[#111827]">
              Territory <span className="text-[11px] text-[#6b7280]">— subnational pin style</span>
            </span>
          </label>
        )}
        <button
          onClick={() => {
            if (name.trim()) {
              onCreate({
                name,
                kind,
                href: href.trim() ? `/wiki/${href.trim().replace(/ /g, "_")}` : "",
                territory: kind === "nation" && territory ? "Territory" : undefined,
              });
              setName("");
              setHref("");
              setTerritory(false);
            }
          }}
          disabled={!name.trim()}
          className="w-full h-8 rounded-md bg-[#0e7490] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-[#0c5a70] transition-colors"
        >
          <IconPin width={13} height={13} /> Add & place
        </button>
      </div>

      {pendingCount > 0 && (
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
                {p.x != null ? (
                  <span className="text-[9px] text-zinc-400 font-mono shrink-0">
                    {Math.round(p.x)},{Math.round(p.y)}
                  </span>
                ) : (
                  <button
                    onClick={() => pick(p.name)}
                    title="Click on the map to place it"
                    className="h-5 px-1.5 rounded text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 shrink-0"
                  >
                    Not placed
                  </button>
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
              disabled={pendingCount === 0}
              className="flex-1 h-8 rounded-md bg-emerald-600 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-emerald-700 transition-colors"
            >
              <IconPin width={13} height={13} /> Submit to map
              {pendingCount > 0 && ` (${pendingCount})`}
            </button>
            <button
              onClick={onClear}
              disabled={pendingCount === 0}
              className="h-8 px-3 rounded-md bg-white border border-[#d1d5db] text-zinc-600 text-[12px] font-semibold disabled:opacity-40 hover:bg-[#f9fafb] transition-colors"
            >
              Clear
            </button>
          </div>
          {pendingRemovals.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50/60">
              <div className="px-2.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-500">
                Pending removal ({pendingRemovals.length})
              </div>
              {pendingRemovals.map((n) => (
                <div
                  key={n}
                  className="flex items-center gap-2 px-2.5 py-1.5 border-b border-red-100 last:border-0"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                  <span className="text-[12px] text-zinc-700 truncate flex-1 line-through">
                    {n}
                  </span>
                  <button
                    onClick={() => onUndoRemove(n)}
                    title="Keep this place"
                    className="h-6 px-2 rounded text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 shrink-0"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pendingCount === 0 && (
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

function MapInfoRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="text-[11px] text-[#6b7280] shrink-0">{label}</span>
      <span className="text-[11px] font-mono text-[#111827] text-right truncate">{value}</span>
    </div>
  );
}

function MapInfoBlock({ layer, mapSize, view, placesInfo, status }) {
  const active = getLayer(layer);
  const counts = useMemo(() => {
    const c = { nation: 0, capital: 0, city: 0, town: 0 };
    for (const p of placesInfo) {
      if (c[p.kind] != null) c[p.kind] += 1;
    }
    return c;
  }, [placesInfo]);
  const center =
    view && mapSize?.W
      ? `${Math.abs(latFromPixel(view.y, mapSize.H)).toFixed(1)}°${latFromPixel(view.y, mapSize.H) >= 0 ? "N" : "S"}, ${Math.abs(lngFromX(view.x, mapSize.W)).toFixed(1)}°${lngFromX(view.x, mapSize.W) >= 0 ? "E" : "W"}`
      : "—";
  return (
    <div>
      <div className="urth-side-title text-[15px] font-bold text-[#111827]">Urth Atlas</div>
      <div className="text-[12px] text-[#6b7280] mt-0.5">The East Pacific · urthmaps.com</div>
      <div className="mt-2.5 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1 divide-y divide-[#eef0f2]">
        <MapInfoRow label="Layer" value={active.label} />
        <MapInfoRow
          label="Image"
          value={mapSize ? `${mapSize.W}×${mapSize.H} px` : "…"}
        />
        <MapInfoRow label="Projection" value="Equirect. 75°N–75°S" />
        <MapInfoRow
          label="Zoom"
          value={view?.z != null ? view.z.toFixed(2) : "—"}
        />
        <MapInfoRow label="Center" value={center} />
        <MapInfoRow
          label="Markers"
          value={`${counts.nation} nat · ${counts.capital + counts.city + counts.town} setl`}
        />
        <MapInfoRow
          label="Scale"
          value={`${KM_PER_PX.toFixed(3)} km/px · ${KM2_PER_PX2.toFixed(2)} km²/px`}
        />
      </div>
      <div className="mt-2 text-[11px] font-mono text-zinc-400">
        {status === "loading"
          ? "loading map…"
          : status === "blocked"
            ? "placeholder grid shown"
            : "map live • infinite horizontal"}
      </div>
    </div>
  );
}

export default function Sidebar({
  open,
  layer,
  setLayer,
  dataOverlays = [],
  onToggleOverlay = () => {},
  overlayOpacity = 70,
  setOverlayOpacity = () => {},
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
  locked = false,
  onLock = () => {},
  onResume = () => {},
  mapSize,
  cursor,
  result,
  view,
  placesInfo = [],
  onCopy,
  onShare,
  onSaveResult,
  saved,
  onDeleteSaved,
  target,
  setTarget,
  local,
  shared,
  removed,
  onUndoRemove,
  sharedStatus,
  sharedCount,
  onCreate,
  onRemove,
  onSubmit,
  onClear,
  setOpen,
}) {
  if (!open) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-0 bg-black/40 z-[1040]"
        onClick={() => setOpen?.(false)}
      />
      <aside className="w-[340px] shrink-0 bg-white border-r border-[#e5e7eb] flex flex-col z-[1000] shadow-[2px_0_8px_rgba(0,0,0,0.04)] overflow-y-auto max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[1050] max-md:w-[85vw] max-md:max-w-[340px] max-md:border-r-0 max-md:shadow-2xl">
      <Section title="Map Info">
        <MapInfoBlock
          layer={layer}
          mapSize={mapSize}
          view={view}
          placesInfo={placesInfo}
          status={status}
        />
      </Section>

      <Section title="Base Layer">
        <div className="space-y-1">
          {VISIBLE_LAYERS.map((l) => (
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
                <span className="text-[13px] text-[#111827] group-hover:text-[#0e7490] transition-colors flex items-center gap-1.5">
                  {l.label}
                  {l.stale && (
                    <span
                      title="This layer's data may be out of date"
                      className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px"
                    >
                      Out of date
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-[#6b7280]">{l.sub}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[#e5e7eb]">
          <div className="mt-3 opacity-55 hover:opacity-100 transition-opacity">
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

      <Section title="Thematic Layers">
        <div className="space-y-1">
          {VISIBLE_OVERLAYS.map((l) => {
            const on = dataOverlays.includes(l.id);
            return (
              <label
                key={l.id}
                className="flex items-center gap-2.5 py-1 select-none cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleOverlay(l.id)}
                  className="w-4 h-4 rounded accent-[#0e7490] cursor-pointer"
                />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] text-[#111827] group-hover:text-[#0e7490] transition-colors flex items-center gap-1.5">
                    {l.label}
                    {l.stale && (
                      <span
                        title="This layer's data may be out of date"
                        className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-px"
                      >
                        Out of date
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-[#6b7280]">{l.sub}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-[#e5e7eb]">
          <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-1">
            <span>Overlay opacity</span>
            <span className="font-mono">{overlayOpacity}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
            disabled={dataOverlays.length === 0}
            className="w-full accent-[#0e7490] cursor-pointer disabled:opacity-40"
          />
          {IS_LOW_MEM && (
            <div className="mt-1.5 text-[11px] text-[#6b7280]">
              One overlay at a time on this device. Full-resolution layers
              need a desktop browser.
            </div>
          )}
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
          label="City & region markers"
          checked={showMarkers}
          onChange={setShowMarkers}
          sub="Capitals, cities & towns"
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
          locked={locked}
          onLock={onLock}
          onResume={onResume}
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
          shared={shared}
          removed={removed}
          onUndoRemove={onUndoRemove}
          sharedStatus={sharedStatus}
          sharedCount={sharedCount}
          onCreate={onCreate}
          onRemove={onRemove}
          onSubmit={onSubmit}
          onClear={onClear}
        />
      </Section>
      </aside>
    </>
  );
}