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
  { id: "measure", label: "Measure", icon: IconRuler, hint: "Click 2 points — it finishes itself. Click the active tool again (or Esc) to exit." },
  { id: "area", label: "Area", icon: IconArea, hint: "Click vertices, then Finish, double-click, or Enter. Esc removes the last point." },
  { id: "path", label: "Path", icon: IconPath, hint: "Click waypoints, then Finish, double-click, or Enter. Esc removes the last point." },
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

function BetaDisclaimer() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700 mb-1">
        Beta — unverified results
      </div>
      <p className="text-[11px] leading-4 text-amber-900">
        These results are for reference only, and should not be used in any
        official capacity (such as on your wiki). For a proper conversion, use{" "}
        <a
          href="https://urthmaps.com/docs#area"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-amber-700"
        >
          our online tool
        </a>
        .
      </p>
    </div>
  );
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
          Flat map — Urth is flat (primary)
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
          If Urth were a sphere · cos({d.avgLat.toFixed(1)}°) = {d.cosAvg.toFixed(4)}
        </div>
        {(units === "metric" || units === "both") && (
          <Row label="Spherical" value={`${num(d.kmCorr, 2)} km`} accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label={units === "both" ? "" : "Spherical"} value={`${num(d.miCorr, 2)} mi`} accent />
        )}
        <Row label="Spherical NM" value={`${num(d.nmCorr, 2)} NM`} />
        <div className="mt-2 p-2 bg-white rounded-lg border text-[10px] leading-[1.4] text-zinc-600">
          <div className="font-bold text-zinc-800 mb-0.5">Formulas</div>
          <div>pix = √(dx²+dy²)</div>
          <div>km (flat) = pix × {KM_PER_PX.toFixed(4)}</div>
          <div>km (if spherical) = Σ √((dxᵢ·{KM_PER_PX.toFixed(3)}·cosφᵢ)² + (dyᵢ·{KM_PER_PX.toFixed(3)})²), φ sampled along segment</div>
        </div>
      </div>
      <CopyShare
        onCopy={onCopy}
        onShare={onShare}
        text={`${num(d.km, 1)} km (${num(d.mi, 1)} mi) • if spherical ${num(d.kmCorr, 1)} km / ${num(d.miCorr, 1)} mi • ${num(d.nm, 1)} NM`}
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
            <Row label="Flat" value={`${num(r.totalKm, 2)} km`} bold accent />
            <Row label="If spherical" value={`${num(r.totalKmCorr, 2)} km`} />
          </>
        )}
        {(units === "imperial" || units === "both") && (
          <>
            <Row label="Flat mi" value={`${num(r.totalMi, 2)} mi`} bold accent />
            <Row label="If spherical mi" value={`${num(r.totalMiCorr, 2)} mi`} />
          </>
        )}
        <Row label="Spherical NM" value={`${num(r.totalNmCorr, 1)} NM`} />
        {units === "both" && (
          <>
            <Divider />
            <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">
              Both units
            </div>
            <Row label="Flat" value={`${num(r.totalKm, 1)} km = ${num(r.totalMi, 1)} mi`} />
            <Row label="If spherical" value={`${num(r.totalKmCorr, 1)} km = ${num(r.totalMiCorr, 1)} mi`} />
          </>
        )}
      </div>
      <CopyShare
        onCopy={onCopy}
        onShare={onShare}
        text={`Path ${count} pts: ${num(r.totalKm, 1)} km (${num(r.totalMi, 1)} mi) • if spherical ${num(r.totalKmCorr, 1)} km`}
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
          <Row label="Flat area" value={`${num(a.areaKm2, 2)} km²`} bold accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label="Flat area" value={`${num(a.areaMi2, 2)} mi²`} bold accent />
        )}
        {units === "both" && (
          <div className="text-[12px] font-bold text-center bg-white border rounded-lg py-1.5 my-1 text-[#0e7490]">
            {intNum(a.areaKm2)} km² / {intNum(a.areaMi2)} mi²
          </div>
        )}
        <Row label="Acres" value={`${num(a.acres, 1)} ac`} />
        <Divider />
        <div className="text-[10px] text-zinc-600">
          If Urth were a sphere — avg lat {a.avgLat.toFixed(1)}°, cos = {a.cosAvg.toFixed(4)}
        </div>
        {(units === "metric" || units === "both") && (
          <Row label="Spherical km²" value={`${num(a.areaKm2Corr, 2)} km²`} accent />
        )}
        {(units === "imperial" || units === "both") && (
          <Row label="Spherical mi²" value={`${num(a.areaMi2Corr, 2)} mi²`} accent />
        )}
        <Row label="Spherical acres" value={`${num(a.acresCorr, 1)} ac`} />
        <div className="mt-2 p-2 bg-white rounded-lg border text-[10px] leading-[1.4] text-zinc-600">
          <div className="font-bold text-zinc-800 mb-0.5">Formulas</div>
          <div>Shoelace: A = ½|Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|</div>
          <div>km² (flat) = px² × {KM2_PER_PX2.toFixed(2)}</div>
          <div>If spherical ≈ km² × mean cosφ (vertex + midpoint sampled) • acres = km² × 247.105</div>
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
  locked = false,
  onLock = () => {},
  onResume = () => {},
  mapSize,
  cursor,
  result,
  onCopy,
  onShare,
}) {
  const clear = () => {
    onResume();
    setPoints([]);
  };
  const undo = () => {
    // Editing a finalized shape resumes the draft (unlocks) so further
    // clicks work again.
    onResume();
    setPoints((p) => p.slice(0, -1));
  };
  // Path/area stay open until finalized; measure completes on 2nd click.
  const finishable =
    !locked &&
    ((mode === "path" && points.length >= 2) ||
      (mode === "area" && points.length >= 3));

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[12px] font-bold tracking-[0.14em] text-[#6b7280] uppercase">
          Measurements
        </h3>
        <div className="flex items-center gap-1.5">
          {finishable && (
            <button
              onClick={onLock}
              title="Finish (Enter or double-click)"
              className="h-8 px-3 rounded-full bg-[#0e7490] text-white text-[12px] font-semibold hover:bg-[#0c5a70] transition-colors"
            >
              Finish
            </button>
          )}
          {locked && mode !== "none" && (
            <button
              onClick={onResume}
              title="Resume adding points"
              className="h-8 px-3 rounded-full bg-white border border-zinc-200 text-zinc-700 text-[12px] font-semibold hover:border-zinc-300 transition-colors"
            >
              Resume
            </button>
          )}
          {points.length > 0 && (
            <>
              <ActionButton onClick={undo} icon={IconUndo} label="Undo last point (Esc)" />
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

      <div className="mt-3">
        <BetaDisclaimer />
      </div>

      <div className="mt-3 space-y-4">
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
                lat = (y/H)·150° − 75° · km = px·{KM_PER_PX.toFixed(4)} = {MI_PER_PX.toFixed(4)} mi · spherical-hypothesis only: lon·cosφ
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
            No measurements. Right-click the map to measure.
          </div>
        )}
      </div>
    </div>
  );
}