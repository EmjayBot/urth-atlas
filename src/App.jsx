import { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import MapControls from "./components/MapControls";
import MeasurementPanel from "./components/MeasurementPanel";
import Footer from "./components/Footer";
import Toast from "./components/Toast";
import PlacePanel from "./components/PlacePanel";
import { measureDistance, measurePath, measureArea } from "./lib/measure";
import { parseUrl, writeUrl, shareLink } from "./lib/url";
import { getLayer, BASE_LAYERS } from "./lib/scale";
import { mergePlaces, placeLatLng } from "./lib/places";

const initial = parseUrl();
const LOCAL_KEY = "urth-atlas.places.local.v1";

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
  const [showNations, setShowNations] = useState(initial.nations ?? true);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(null);
  const [view, setView] = useState(null);
  const [toast, setToast] = useState(null);

  // Shared community places (public/positions.json) + local edits.
  const [shared, setShared] = useState({});
  const [sharedStatus, setSharedStatus] = useState("loading");
  const [local, setLocal] = useState(loadLocal);
  const [calibOpen, setCalibOpen] = useState(false);
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
        showToast("Not placed yet — add it with Calibrate");
      }
      if (calibOpen) setTarget({ name: p.name, kind: p.kind, href: p.href });
    }
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
        else clearAll();
      }
      else if (k === "+" || k === "=") mapRef.current?.zoomIn();
      else if (k === "-") mapRef.current?.zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#e5e3df] text-zinc-800 font-sans overflow-hidden">
      <Header
        query={query}
        setQuery={setQuery}
        onPlace={onPlace}
        places={places}
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
          />
          <PlacePanel
            open={calibOpen}
            setOpen={setCalibOpen}
            target={target}
            setTarget={setTarget}
            local={local}
            sharedCount={Object.keys(shared).length}
            sharedStatus={sharedStatus}
            onCreate={createPlace}
            onRemove={removePlace}
            onSubmit={submitChanges}
            onClear={clearLocal}
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