import { KM_PER_PX, MI_PER_PX, KM2_PER_PX2, MI2_PER_PX2 } from "../lib/scale";
import { num, intNum } from "../lib/format";
import {
  IconRuler,
  IconArea,
  IconPath,
  IconTrash,
  IconUndo,
  IconCopy,
  IconLink,
  IconCheck,
} from "./icons";

const TOOLS = [
  { id: "measure", label: "Measure", icon: IconRuler, hint: "Click 2 points. Shows km + miles + NM, raw & latitude-corrected." },
  { id: "area", label: "Area", icon: IconArea, hint: "Click vertices, then double-click or press Finish to close." },
  { id: "path", label: "Path", icon: IconPath, hint: "Click waypoints. Sums km & miles with cos(φ) correction." },
];

function ActionButton({ onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="h-8 w-8 rounded-full border border-zinc-200 bg-white text-zinc-600 flex items-center justify-center hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
    >
      <Icon width={15} height={15} />
    </button>
  );
}

function ResultCard({ children }) {
  return (
    <div className="rounded-xl border border-[#0e7490]/20 bg-[#f0f9fa] p-3.5">
      {children}
    </div>
  );
}

function Row({ label, value, bold, accent, big }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className={bold ? "text-zinc-700 font-semibold text-[12px]" : "text-zinc-500"}>
        {label}
      </span>
      <span
        className={
          big
            ? "text-[16px] font-extrabold leading-5 text-[#0e7490]"
            : accent
              ? "font-bold text-zinc-900"
              : "font-semibold text-zinc-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[#0e7490]/15 my-2" />;
}

function CopyShare({ onCopy, onShare, text, shareState }) {
  return (
    <div className="mt-2.5 flex gap-1.5">
      <button
        onClick={() => onCopy(text)}
        className="flex-1 h-8 rounded-lg bg-white border border-zinc-200 text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1.5 hover:bg-zinc-50 transition-colors"
      >
        <IconCopy width={13} height={13} /> Copy result
      </button>
      <button
        onClick={() => onShare(shareState)}
        className="flex-1 h-8 rounded-lg bg-white border border-zinc-200 text-[11px] font-semibold text-zinc-700 flex items-center justify-center gap-1.5 hover:bg-zinc-50 transition-colors"
      >
        <IconLink width={13} height={13} /> Share link
      </button>
    </div>
  );
}

function DistanceCard({ d, units, onCopy, onShare }) {
  return (
    <ResultCard>
      <div className="text-[11px] font-bold tracking-widest uppercase text-[#0e7490] mb-2 flex items-center justify-between">
        <span>Distance Result</span>
        <span className="text-zinc-400 normal-case tracking-normal font-semibold">
          {d.pix.toFixed(1)} px
        </span>
      </div>
      <div className="font-mono text-[12px] space-y-1">
        <Row label="Δx, Δy (px)" value={`${d.dx.toFixed(1)}, ${d.dy.toFixed(1)}`} />
        <Row label="Straight px" value={`${d.pix.toFixed(1)} px`} bold />
        <Divider />
        <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">
          Raw Euclidean
        </div>
        {(units === "metric" || units === "both") && (
          <Row label="Distance" value={`${num(d.km, 1)} km`} big />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label={units === "both" ? "" : "Distance"} value={`${num(d.mi, 1)} miles`} big />
        )}
        <Row label="Nautical" value={`${num(d.nm, 1)} NM`} />
        <Divider />
        <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">
          Latitude Corrected · cos({d.avgLat.toFixed(1)}°) = {d.cosAvg.toFixed(4)}
        </div>
        {(units === "metric" || units === "both") && (
          <Row label="Corrected" value={`${num(d.kmCorr, 2)} km`} accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label={units === "both" ? "" : "Corrected"} value={`${num(d.miCorr, 2)} mi`} accent />
        )}
        <Row label="Corr NM" value={`${num(d.nmCorr, 2)} NM`} />
        <div className="mt-2 p-2 bg-white rounded-lg border text-[10px] leading-[1.4] text-zinc-600">
          <div className="font-bold text-zinc-800 mb-0.5">Formulas</div>
          <div>pix = √(dx²+dy²)</div>
          <div>km = pix × {KM_PER_PX.toFixed(4)}</div>
          <div>km_corr = √((dx·{KM_PER_PX.toFixed(3)}·cosφ)² + (dy·{KM_PER_PX.toFixed(3)})²)</div>
        </div>
      </div>
      <CopyShare
        onCopy={onCopy}
        onShare={onShare}
        text={`${num(d.km, 1)} km (${num(d.mi, 1)} mi) • corr ${num(d.kmCorr, 1)} km / ${num(d.miCorr, 1)} mi • ${num(d.nm, 1)} NM`}
        shareState={{ mode: "measure", pts: undefined }}
      />
    </ResultCard>
  );
}

function PathCard({ r, count, units, onCopy, onShare }) {
  return (
    <ResultCard>
      <div className="text-[11px] font-bold tracking-widest uppercase text-[#0e7490] mb-2 flex items-center justify-between">
        <span>Path — {count} pts</span>
        <span className="text-zinc-400 normal-case tracking-normal font-semibold">
          {r.totalPix.toFixed(1)} px
        </span>
      </div>
      <div className="font-mono text-[12px] space-y-1">
        {(units === "metric" || units === "both") && (
          <>
            <Row label="Euclidean" value={`${num(r.totalKm, 2)} km`} bold accent />
            <Row label="Corrected" value={`${num(r.totalKmCorr, 2)} km`} />
          </>
        )}
        {(units === "imperial" || units === "both") && (
          <>
            <Row label="Euclid mi" value={`${num(r.totalMi, 2)} mi`} bold accent />
            <Row label="Corr mi" value={`${num(r.totalMiCorr, 2)} mi`} />
          </>
        )}
        <Row label="NM corr" value={`${num(r.totalNmCorr, 1)} NM`} />
        {units === "both" && (
          <>
            <Divider />
            <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">
              Both units
            </div>
            <Row label="Euclid" value={`${num(r.totalKm, 1)} km = ${num(r.totalMi, 1)} mi`} />
            <Row label="Corr" value={`${num(r.totalKmCorr, 1)} km = ${num(r.totalMiCorr, 1)} mi`} />
          </>
        )}
      </div>
      <CopyShare
        onCopy={onCopy}
        onShare={onShare}
        text={`Path ${count} pts: ${num(r.totalKm, 1)} km (${num(r.totalMi, 1)} mi) • corr ${num(r.totalKmCorr, 1)} km`}
        shareState={{ mode: "path", pts: undefined }}
      />
    </ResultCard>
  );
}

function AreaCard({ a, count, units, onCopy, onShare }) {
  return (
    <ResultCard>
      <div className="text-[11px] font-bold tracking-widest uppercase text-[#0e7490] mb-2 flex items-center justify-between">
        <span>Area — {count} vertices</span>
        <span className="text-zinc-400 normal-case tracking-normal font-semibold">
          {a.areaPx.toFixed(1)} px²
        </span>
      </div>
      <div className="font-mono text-[12px] space-y-1">
        <Row label="Pixel area" value={`${a.areaPx.toFixed(1)} px²`} bold />
        <Divider />
        {(units === "metric" || units === "both") && (
          <Row label="Real area" value={`${num(a.areaKm2, 2)} km²`} bold accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label="Real area" value={`${num(a.areaMi2, 2)} mi²`} bold accent />
        )}
        {units === "both" && (
          <div className="text-[12px] font-bold text-center bg-white border rounded-lg py-1.5 my-1 text-[#0e7490]">
            {intNum(a.areaKm2)} km² / {intNum(a.areaMi2)} mi²
          </div>
        )}
        <Row label="Acres" value={`${num(a.acres, 1)} ac`} />
        <Divider />
        <div className="text-[10px] text-zinc-600">
          Avg lat {a.avgLat.toFixed(1)}°, cos = {a.cosAvg.toFixed(4)}
        </div>
        {(units === "metric" || units === "both") && (
          <Row label="Corr km²" value={`${num(a.areaKm2Corr, 2)} km²`} accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label="Corr mi²" value={`${num(a.areaMi2Corr, 2)} mi²`} accent />
        )}
        <Row label="Corr acres" value={`${num(a.acresCorr, 1)} ac`} />
        <div className="mt-2 p-2 bg-white rounded-lg border text-[10px] leading-[1.4] text-zinc-600">
          <div className="font-bold text-zinc-800 mb-0.5">Formulas</div>
          <div>Shoelace: A = ½|Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|</div>
          <div>km² = px² × {KM2_PER_PX2.toFixed(2)}</div>
          <div>Corr ≈ km² × cosφ_avg • acres = km² × 247.105</div>
        </div>
      </div>
      <CopyShare
        onCopy={onCopy}
        onShare={onShare}
        text={`Area ${count} pts: ${num(a.areaKm2, 1)} km² (${num(a.areaMi2, 1)} mi²) • ${num(a.acres, 0)} ac`}
        shareState={{ mode: "area", pts: undefined }}
      />
    </ResultCard>
  );
}

export default function MeasurementPanel({
  mode,
  setMode,
  units,
  setUnits,
  points,
  setPoints,
  mapSize,
  cursor,
  status,
  result,
  onCopy,
  onShare,
}) {
  const clear = () => setPoints([]);
  const undo = () => setPoints((p) => p.slice(0, -1));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.16em] text-zinc-500 uppercase">
            Measurement
          </h2>
          <div className="flex items-center gap-1.5">
            {points.length > 0 && (
              <>
                <ActionButton onClick={undo} icon={IconUndo} label="Undo last point" />
                <ActionButton onClick={clear} icon={IconTrash} label="Clear all" />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`h-9 rounded-full text-[12px] font-semibold border transition-all flex items-center justify-center gap-1.5 ${active ? "bg-[#0e7490] text-white border-[#0e7490] shadow-sm" : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"}`}
              >
                <Icon width={14} height={14} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-zinc-400 mb-1.5">
            Units
          </div>
          <div className="flex items-center rounded-full bg-zinc-100 p-1 border border-zinc-200">
            {["metric", "imperial", "both"].map((u) => (
              <button
                key={u}
                onClick={() => setUnits(u)}
                className={`flex-1 h-7 rounded-full text-[11px] font-bold tracking-wide uppercase transition-all ${units === u ? "bg-white shadow-sm text-zinc-900 border border-zinc-200" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {u === "metric" ? "Metric" : u === "imperial" ? "Imperial" : "Both"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 text-[11px] leading-4 text-zinc-500 bg-[#f8fafc] border border-zinc-100 rounded-lg p-2.5">
          {TOOLS.find((t) => t.id === mode)?.hint ??
            "Select a tool to start measuring. Nothing is recorded until you click."}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cursor */}
        <section>
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-zinc-400 mb-2">
            Cursor
          </div>
          {cursor ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 font-mono text-[12px]">
              <Row label="Pixel X,Y" value={`${cursor.x.toFixed(1)}, ${cursor.y.toFixed(1)}`} />
              <Row label="Lat / Equi" value={`${cursor.lat.toFixed(3)}°`} />
              <Row label="km from origin" value={`${cursor.kmX.toFixed(1)}, ${cursor.kmY.toFixed(1)} km`} />
              <Row label="mi from origin" value={`${cursor.miX.toFixed(1)}, ${cursor.miY.toFixed(1)} mi`} />
              <Row label="Map size" value={mapSize ? `${mapSize.W}×${mapSize.H}` : "…"} />
              <div className="mt-2 pt-2 border-t border-zinc-200 text-[10px] text-zinc-500 leading-3">
                lat = 90° − (y/H)·180° · km = px·{KM_PER_PX.toFixed(4)} = {MI_PER_PX.toFixed(4)} mi · lon·cosφ
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-zinc-400">Move over map…</div>
          )}
        </section>

        {result?.kind === "distance" && (
          <DistanceCard
            d={result.data}
            units={units}
            onCopy={onCopy}
            onShare={(st) => onShare({ ...st, pts: points })}
          />
        )}
        {result?.kind === "path" && (
          <PathCard
            r={result.data}
            count={points.length}
            units={units}
            onCopy={onCopy}
            onShare={(st) => onShare({ ...st, pts: points })}
          />
        )}
        {result?.kind === "area" && (
          <AreaCard
            a={result.data}
            count={points.length}
            units={units}
            onCopy={onCopy}
            onShare={(st) => onShare({ ...st, pts: points })}
          />
        )}

        {!result && (
          <div className="text-[12px] text-zinc-400 leading-5">
            No measurements yet. This atlas uses exact scale:
            <br />
            <span className="font-mono text-zinc-700">
              1 px = {KM_PER_PX.toFixed(6)} km ({MI_PER_PX.toFixed(6)} mi)
            </span>
            <br />
            <span className="font-mono text-zinc-700">
              1 px² = {KM2_PER_PX2.toFixed(2)} km² = {MI2_PER_PX2.toFixed(6)} mi²
            </span>
          </div>
        )}

        {/* Map info */}
        <section className="pt-4 border-t border-zinc-100">
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-zinc-400 mb-2">
            Map Info
          </div>
          <div className="text-[11px] leading-4 text-zinc-600 space-y-1">
            <div>
              • Source:{" "}
              <span className="font-mono text-[10px]">urth.png</span>{" "}
              {status === "blocked"
                ? "(fallback grid shown)"
                : status === "ok"
                  ? "(live)"
                  : "(loading…)"}
            </div>
            <div>• CRS.Simple, 5 wraps, infinite scroll</div>
            <div>• MinZoom -2 / MaxZoom 6, inertia</div>
            <div>• Equirectangular: lon × cos(lat)</div>
            <div>• Nations layer sourced from TEPwiki</div>
            <div className="pt-1.5 mt-1.5 border-t border-zinc-100 font-mono text-[10px]">
              <div>km per px = {KM_PER_PX.toFixed(4)}</div>
              <div>mi per px = {MI_PER_PX.toFixed(4)}</div>
              <div>km² per px = {KM2_PER_PX2.toFixed(2)}</div>
              <div>mi² per px = {MI2_PER_PX2.toFixed(4)}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}