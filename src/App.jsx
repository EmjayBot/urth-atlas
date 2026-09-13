import { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import MapControls from "./components/MapControls";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Toast from "./components/Toast";
import ContextMenu from "./components/ContextMenu";
import { measureDistance, measurePath, measureArea } from "./lib/measure";
import { parseUrl, writeUrl, shareLink } from "./lib/url";
import { mergePlaces } from "./lib/places";
import { num } from "./lib/format";

const initial = parseUrl();
const LOCAL_KEY = "urth-atlas.places.local.v2";

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
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
  const [opacity, setOpacity] = useState(100);
  const [showScale, setShowScale] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showPixelGrid, setShowPixelGrid] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [showClouds, setShowClouds] = useState(true);
  const [cloudOpacity, setCloudOpacity] = useState(58);
  const [cloudDensity, setCloudDensity] = useState("normal");
  const [showMarkers, setShowMarkers] = useState(true);
  const [showNations, setShowNations] = useState(initial.nations ?? true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saved, setSaved] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(null);
  const [view, setView] = useState(null);
  const [toast, setToast] = useState(null);

  // Shared community places (public/positions.json) + local edits.
  const [shared, setShared] = useState({});
  const [sharedStatus, setSharedStatus] = useState("loading");
  const [local, setLocal] = useState(loadLocal);
  const [target, setTarget] = useState(null);

  const mapRef = useRef(null);
  const toastTimer = useRef(0);
  const persistTimer = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
    } catch {}
  }, [local]);

  // Load shared community places.
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
          if (v && typeof v === "object") pos[k] = v;
        }
        setShared(pos);
        setSharedStatus(Object.keys(pos).length ? "ok" : "empty");
      })
      .catch(() => {
        if (alive) setSharedStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const places = useMemo(() => mergePlaces(shared, local), [shared, local]);

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

  const recenter = () => {
    if (mapRef.current && mapSize) {
      mapRef.current.setView([mapSize.H / 2, mapSize.W / 2], 0);
    }
  };

  const onSaveResult = () => {
    if (!result) return;
    let label;
    let kind;
    if (result.kind === "distance") {
      label = `${num(result.data.km, 1)} km (${num(result.data.mi, 1)} mi)`;
      kind = "D";
    } else if (result.kind === "path") {
      label = `${num(result.data.totalKm, 1)} km (${num(result.data.totalMi, 1)} mi)`;
      kind = "P";
    } else {
      label = `${num(result.data.areaKm2, 1)} km² (${num(result.data.areaMi2, 1)} mi²)`;
      kind = "A";
    }
    setSaved((s) => [...s, { kind, label }]);
    showToast("Measurement saved");
  };

  const onDeleteSaved = (i) => {
    setSaved((s) => s.filter((_, idx) => idx !== i));
  };

  // ---- Place creation / positioning --------------------------------------
  const createPlace = ({ name, kind, href }) => {
    const clean = name.trim();
    if (!clean) return;
    setLocal((l) => ({ ...l, [clean]: { kind, href: href || `/wiki/${clean.replace(/ /g, "_")}` } }));
    setTarget({ name: clean, kind, href: href || `/wiki/${clean.replace(/ /g, "_")}` });
    showToast(`Now click where ${clean} is`);
  };

  const positionPlace = (x, y) => {
    if (!target) return;
    setLocal((l) => {
      const prev = l[target.name] || {};
      return { ...l, [target.name]: { ...prev, x: +x.toFixed(1), y: +y.toFixed(1) } };
    });
    showToast(`Placed ${target.name}`);
    setTarget(null);
  };

  const removePlace = (name) => {
    setLocal((l) => {
      const next = { ...l };
      delete next[name];
      return next;
    });
    showToast(`Removed ${name}`);
  };

  // Build a PR-ready diff of local changes vs shared, open a GitHub issue.
  // The map-update workflow auto-merges these into positions.json on deploy.
  const submitChanges = () => {
    const diff = {};
    for (const [name, v] of Object.entries(local)) {
      diff[name] = { kind: v.kind, href: v.href, x: v.x, y: v.y };
    }
    if (!Object.keys(diff).length) {
      showToast("No local changes to submit");
      return;
    }
    const body =
      "Community map update from Urth Atlas:\n\n```json\n" +
      JSON.stringify(diff, null, 2) +
      "\n```\n\nThis issue is auto-merged into positions.json by the map-update workflow.";
    const url =
      "https://github.com/EmjayBot/urth-atlas/issues/new?title=" +
      encodeURIComponent("Map update: " + Object.keys(diff).slice(0, 5).join(", ")) +
      "&body=" +
      encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
    showToast("Opened issue — auto-merges on publish");
  };

  const clearLocal = () => {
    setLocal({});
    setTarget(null);
    showToast("Cleared local places");
  };

  // ---- Search / focus -----------------------------------------------------
  const onPlace = (p) => {
    setQuery(p.name ?? `${p.a}, ${p.b}`);
    if (p.kind === "coord") {
      setFocus({ type: "coord", a: p.a, b: p.b });
    } else {
      const place = places.find((x) => x.name === p.name);
      if (place && place.x != null && place.y != null) {
        setFocus({ type: p.kind, name: p.name });
      } else {
        showToast("Not placed yet — add it in the Pins panel");
      }
      if (target) setTarget({ name: p.name, kind: p.kind, href: p.href });
    }
  };

  // ---- Context menu handlers ---------------------------------------------
  const onCtxWhat = () => {
    if (!ctx) return;
    showToast(
      `X ${ctx.pt.x.toFixed(0)}, Y ${ctx.pt.y.toFixed(0)} • ${ctx.pt.lat.toFixed(2)}°, ${ctx.pt.lngDeg.toFixed(2)}°`
    );
  };

  const onCtxMeasure = () => {
    if (!ctx) return;
    const pt = { x: ctx.pt.x, y: ctx.pt.y };
    setMode("measure");
    setPoints([pt]);
    setCtx(null);
    showToast("Click a second point");
  };

  // Leaflet popup quick actions (Copy location / Measure from here).
  const onPopupAction = (act, p) => {
    if (!p) return;
    if (act === "copy") {
      const lat = p.lat != null ? `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? "N" : "S"}` : "";
      const lng = p.lng != null ? `${Math.abs(p.lng).toFixed(2)}°${p.lng >= 0 ? "E" : "W"}` : "";
      onCopy(`${p.name} — X ${(+p.x).toFixed(0)}, Y ${(+p.y).toFixed(0)} (${lat}, ${lng})`);
    } else if (act === "measure") {
      setMode("measure");
      setPoints([{ x: +p.x, y: +p.y }]);
      showToast(`Measuring from ${p.name} — click a second point`);
    }
  };

  const onCtxPin = (name) => {
    if (!ctx || !name) return;
    const pt = ctx.pt;
    setLocal((l) => ({
      ...l,
      [name]: { kind: "city", href: "", x: +pt.x.toFixed(1), y: +pt.y.toFixed(1) },
    }));
    showToast(`Pinned ${name}`);
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
        if (target) setTarget(null);
        else if (ctx) setCtx(null);
        else clearAll();
      } else if (k === "+" || k === "=") mapRef.current?.zoomIn();
      else if (k === "-") mapRef.current?.zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, ctx]);

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#e5e3df] text-zinc-800 font-sans overflow-hidden">
      <Header
        query={query}
        setQuery={setQuery}
        onPlace={onPlace}
        places={places}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLocate={recenter}
        onMeasure={() => selectTool("measure")}
      />

      <div className="flex-1 flex min-h-0 relative">
        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          layer={layer}
          setLayer={setLayer}
          opacity={opacity}
          setOpacity={setOpacity}
          showScale={showScale}
          setShowScale={setShowScale}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showPixelGrid={showPixelGrid}
          setShowPixelGrid={setShowPixelGrid}
          showCoords={showCoords}
          setShowCoords={setShowCoords}
          showClouds={showClouds}
          setShowClouds={setShowClouds}
          cloudOpacity={cloudOpacity}
          setCloudOpacity={setCloudOpacity}
          cloudDensity={cloudDensity}
          setCloudDensity={setCloudDensity}
          showMarkers={showMarkers}
          setShowMarkers={setShowMarkers}
          showNations={showNations}
          setShowNations={setShowNations}
          status={status}
          mode={mode}
          setMode={selectTool}
          units={units}
          setUnits={setUnits}
          points={points}
          setPoints={setPoints}
          mapSize={mapSize}
          cursor={cursor}
          result={result}
          onCopy={onCopy}
          onShare={onShare}
          onSaveResult={onSaveResult}
          saved={saved}
          onDeleteSaved={onDeleteSaved}
          target={target}
          setTarget={setTarget}
          local={local}
          sharedStatus={sharedStatus}
          sharedCount={Object.keys(shared).length}
          onCreate={createPlace}
          onRemove={removePlace}
          onSubmit={submitChanges}
          onClear={clearLocal}
        />

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
            places={places}
            initialView={initial.at ? { at: initial.at, z: initial.z } : null}
            focus={focus}
            onFocusHandled={() => setFocus(null)}
            onViewChange={(v) => setView(v)}
            onMapReady={(map) => {
              mapRef.current = map;
            }}
            calibTarget={target?.name}
            onCalibrateClick={positionPlace}
            opacity={opacity}
            showScale={showScale}
            showGrid={showGrid}
            showPixelGrid={showPixelGrid}
            showCoords={showCoords}
            showClouds={showClouds}
            cloudOpacity={cloudOpacity}
            cloudDensity={cloudDensity}
            showMarkers={showMarkers}
            onContextMenu={(p) =>
              setCtx({
                pt: { x: p.x, y: p.y, lat: p.lat, lngDeg: p.lngDeg },
                pos: { x: p.clientX, y: p.clientY },
              })
            }
            onPopupAction={onPopupAction}
          />
          <MapControls
            mode={mode}
            setMode={selectTool}
            units={units}
            setUnits={setUnits}
            points={points}
            layer={layer}
            setLayer={setLayer}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onReset={recenter}
            onClear={clearAll}
          />
          <Toast toast={toast} />
          <ContextMenu
            pos={ctx?.pos}
            pt={ctx?.pt ?? { x: 0, y: 0 }}
            onClose={() => setCtx(null)}
            onWhat={onCtxWhat}
            onMeasure={onCtxMeasure}
            onPin={onCtxPin}
          />
        </div>
      </div>

      <StatusBar status={status} cursor={cursor} />
    </div>
  );
}