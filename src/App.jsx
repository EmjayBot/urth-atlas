import { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import MapControls from "./components/MapControls";
import MeasurementPanel from "./components/MeasurementPanel";
import Footer from "./components/Footer";
import Toast from "./components/Toast";
import CalibrationPanel from "./components/CalibrationPanel";
import { measureDistance, measurePath, measureArea } from "./lib/measure";
import { parseUrl, writeUrl, shareLink } from "./lib/url";
import { getLayer, BASE_LAYERS } from "./lib/scale";

const initial = parseUrl();

const OVERRIDE_KEY = "urth-atlas.overrides.v1";

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const [mode, setMode] = useState(initial.mode ?? "none");
  const [units, setUnits] = useState("both");
  const [points, setPoints] = useState(initial.pts ?? []);
  const [hover, setHover] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [mapSize, setMapSize] = useState(null);
  const [status, setStatus] = useState("loading");
  const [layer, setLayer] = useState(initial.layer ?? "map");
  const [showNations, setShowNations] = useState(initial.nations ?? true);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(null);
  const [view, setView] = useState(null);
  const [toast, setToast] = useState(null);
  const [calibOpen, setCalibOpen] = useState(false);
  const [calibTarget, setCalibTarget] = useState(null);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [community, setCommunity] = useState({});
  const [communityStatus, setCommunityStatus] = useState("loading");

  // Load shared community positions (the 'save for everyone' store).
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}positions.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        const pos = {};
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith("_")) continue;
          if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) pos[k] = v;
        }
        setCommunity(pos);
        setCommunityStatus(Object.keys(pos).length ? "ok" : "empty");
      })
      .catch(() => {
        if (alive) setCommunityStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    } catch {}
  }, [overrides]);

  const mapRef = useRef(null);
  const toastTimer = useRef(0);
  const persistTimer = useRef(0);

  const stateRef = useRef({ mode, points, showNations, view, layer });
  useEffect(() => {
    stateRef.current = { mode, points, showNations, view, layer };
  }, [mode, points, showNations, view, layer]);

  // Persist deep-link state (debounced for view/pan events).
  useEffect(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const s = stateRef.current;
      writeUrl({
        at: s.view ? [s.view.x, s.view.y] : undefined,
        z: s.view?.z,
        mode: s.mode === "none" ? undefined : s.mode,
        pts: s.mode !== "none" ? s.points : undefined,
        nations: s.showNations,
        layer: s.layer,
      });
    }, 250);
    return () => clearTimeout(persistTimer.current);
  }, [view, mode, points, showNations, layer]);

  const showToast = (message) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const result = useMemo(() => {
    if (!mapSize?.H) return null;
    if (mode === "measure" && points.length >= 2)
      return { kind: "distance", data: measureDistance(points[0], points[1], mapSize.H) };
    if (mode === "path" && points.length >= 2)
      return { kind: "path", data: measurePath(points, mapSize.H) };
    if (mode === "area" && points.length >= 3)
      return { kind: "area", data: measureArea(points, mapSize.H) };
    return null;
  }, [mode, points, mapSize]);

  const selectTool = (m) => {
    setMode(m);
    setPoints([]);
  };

  const clearAll = () => {
    setPoints([]);
    setMode("none");
  };

  // ---- Calibration --------------------------------------------------------
  const onCalibrateClick = (x, y) => {
    if (!calibTarget) return;
    setOverrides((o) => ({ ...o, [calibTarget]: { x, y } }));
    showToast(`Placed ${calibTarget}`);
    setCalibTarget(null);
  };

  const exportOverrides = () => {
    if (!mapSize) return;
    const out = {};
    for (const [name, { x, y }] of Object.entries(overrides)) {
      out[name] = {
        nx: +((x / mapSize.W).toFixed(5)),
        ny: +((y / mapSize.H).toFixed(5)),
      };
    }
    onCopy(JSON.stringify(out));
  };

  // Build a PR-ready patch for public/positions.json and open it on GitHub.
  const submitOverrides = () => {
    if (!mapSize) return;
    const patch = {};
    for (const [name, { x, y }] of Object.entries(overrides)) {
      patch[name] = { x: +x.toFixed(1), y: +y.toFixed(1) };
    }
    const body =
      "I placed these positions on Urth Atlas:\n\n```json\n" +
      JSON.stringify(patch, null, 2) +
      "\n```\n\nMerge to make them visible to everyone.";
    const url =
      "https://github.com/EmjayBot/urth-atlas/issues/new?title=" +
      encodeURIComponent("Position update: " + Object.keys(patch).join(", ")) +
      "&body=" +
      encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
    showToast("Opening GitHub issue…");
  };

  const clearOverrides = () => {
    setOverrides({});
    setCalibTarget(null);
    showToast("Cleared all calibrations");
  };

  // Local overrides win over the shared community file.
  const mergedOverrides = useMemo(
    () => ({ ...community, ...overrides }),
    [community, overrides]
  );

  const onCopy = (text) => {
    navigator.clipboard?.writeText(text).then(
      () => showToast("Copied to clipboard"),
      () => showToast("Copy failed")
    );
  };

  const onShare = (overrides = {}) => {
    const s = stateRef.current;
    const link = shareLink({
      at: s.view ? [s.view.x, s.view.y] : undefined,
      z: s.view?.z,
      mode: overrides.mode,
      pts: overrides.pts,
      nations: s.showNations,
      layer: s.layer,
    });
    navigator.clipboard?.writeText(link).then(
      () => showToast("Share link copied"),
      () => showToast("Copy failed")
    );
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "m") selectTool("measure");
      else if (k === "a") selectTool("area");
      else if (k === "p") selectTool("path");
      else if (k === "escape") {
        if (calibTarget) setCalibTarget(null);
        else clearAll();
      }
      else if (k === "+" || k === "=") mapRef.current?.zoomIn();
      else if (k === "-") mapRef.current?.zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#e5e3df] text-zinc-800 font-sans overflow-hidden">
      <Header
        query={query}
        setQuery={setQuery}
        onPlace={(p) => {
          setQuery(p.name ?? `${p.a}, ${p.b}`);
          if (p.kind === "coord") {
            setFocus({ type: "coord", a: p.a, b: p.b });
          } else {
            setFocus({ type: p.kind, name: p.name });
          }
          if (calibOpen && p.kind !== "coord") setCalibTarget(p.name);
        }}
        showNations={showNations}
        setShowNations={setShowNations}
      />

      <div className="flex-1 flex min-h-0 relative">
        <aside className="w-[360px] shrink-0 bg-white border-r border-zinc-200 flex flex-col max-md:hidden z-[1000] shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
          <MeasurementPanel
            mode={mode}
            setMode={selectTool}
            units={units}
            setUnits={setUnits}
            points={points}
            setPoints={setPoints}
            mapSize={mapSize}
            cursor={cursor}
            status={status}
            result={result}
            layer={layer}
            onCopy={onCopy}
            onShare={onShare}
          />
        </aside>

        <div className="flex-1 relative min-w-0 bg-[#e5e3df] overflow-hidden">
          <MapView
            mode={mode}
            points={points}
            setPoints={setPoints}
            hover={hover}
            setHover={setHover}
            onCursor={setCursor}
            mapSize={mapSize}
            setMapSize={setMapSize}
            status={status}
            setStatus={setStatus}
            layer={layer}
            showNations={showNations}
            initialView={initial.at ? { at: initial.at, z: initial.z } : null}
            focus={focus}
            onFocusHandled={() => setFocus(null)}
            onViewChange={(v) => setView(v)}
            onMapReady={(map) => {
              mapRef.current = map;
            }}
            calibTarget={calibTarget}
            overrides={mergedOverrides}
            onCalibrateClick={onCalibrateClick}
          />
          <CalibrationPanel
            open={calibOpen}
            setOpen={setCalibOpen}
            target={calibTarget}
            setTarget={setCalibTarget}
            overrides={overrides}
            onClearAll={clearOverrides}
            onExport={exportOverrides}
            onSubmit={submitOverrides}
            mapSize={mapSize}
            communityCount={Object.keys(community).length}
            communityStatus={communityStatus}
          />
          <MapControls
            mode={mode}
            setMode={selectTool}
            units={units}
            setUnits={setUnits}
            points={points}
            hover={hover}
            cursor={cursor}
            mapSize={mapSize}
            result={result}
            layer={layer}
            setLayer={setLayer}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onReset={() => {
              if (mapRef.current && mapSize) {
                mapRef.current.setView([mapSize.H / 2, mapSize.W / 2], 0);
              }
            }}
            onClear={clearAll}
          />
          <Toast toast={toast} />
        </div>
      </div>

      <Footer status={status} />
    </div>
  );
}