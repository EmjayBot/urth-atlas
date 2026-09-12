import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  FALLBACK_W,
  FALLBACK_H,
  KM_PER_PX,
  MI_PER_KM,
  getLayer,
} from "../lib/scale";
import { wrapX, latFromPixel } from "../lib/geo";
import { loadLayer, makeFallbackGrid } from "../lib/imageCache";
import { PLACES } from "../lib/places";
import { fullWikiUrl } from "../lib/wiki";

const PICK_COLOR = "#0e7490";

function useRefLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export default function MapView({
  mode,
  points,
  setPoints,
  hover,
  setHover,
  onCursor,
  mapSize,
  setMapSize,
  status,
  setStatus,
  layer,
  showNations,
  initialView,
  focus,
  onFocusHandled,
  onViewChange,
  onMapReady,
  calibTarget,
  overrides,
  onCalibrateClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const imagesRef = useRef([]);
  const loadedLayerRef = useRef(null);
  const [scaleBar, setScaleBar] = useState(null);

  const modeRef = useRefLatest(mode);
  const pointsRef = useRefLatest(points);
  const hoverRef = useRefLatest(hover);
  const layerRef = useRefLatest(layer);
  const calibTargetRef = useRefLatest(calibTarget);
  const overridesRef = useRefLatest(overrides);
  const onCalibrateClickRef = useRefLatest(onCalibrateClick);
  const onCursorRef = useRefLatest(onCursor);
  const onViewChangeRef = useRefLatest(onViewChange);
  const onFocusHandledRef = useRefLatest(onFocusHandled);
  const onMapReadyRef = useRefLatest(onMapReady);

  const initialViewRef = useRef(initialView);
  useEffect(() => {
    initialViewRef.current = initialView;
  }, [initialView]);

  const rafRef = useRef(0);

  // ---- Map creation -------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 6,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      inertia: true,
      inertiaDeceleration: 3000,
      doubleClickZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;

    let canceled = false;
    let H = 0;
    let W = 0;

    const installOverlays = (url) => {
      for (let i = -2; i <= 2; i++) {
        const ov = L.imageOverlay(
          url,
          [
            [0, i * W],
            [H, (i + 1) * W],
          ],
          { interactive: true }
        ).addTo(map);
        imagesRef.current.push(ov);
      }
    };

    const finishLoad = (url, w, h, okStatus) => {
      if (canceled) return;
      W = w;
      H = h;
      loadedLayerRef.current = layerRef.current;
      setMapSize({ W, H });
      installOverlays(url);
      const init = initialViewRef.current;
      if (init?.at) {
        map.setView([init.at[1], init.at[0]], init.z ?? 1, { animate: false });
      } else {
        map.setView([H / 2, W / 2], 0, { animate: false });
      }
      setStatus(okStatus);
      onMapReadyRef.current(map);
    };

    const def = getLayer(layerRef.current);
    loadLayer(def)
      .then(({ url, w, h }) => finishLoad(url, w, h, "ok"))
      .catch(() => {
        if (canceled) return;
        const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
        finishLoad(url, FALLBACK_W, FALLBACK_H, "blocked");
      });

    // Cursor + hover tracking (rAF-throttled React updates)
    const onMouseMove = (e) => {
      const x = e.latlng.lng;
      const y = e.latlng.lat;
      const wx = wrapX(x, W);
      const pt = { x: wx, y };
      const payload = {
        x: wx,
        y,
        lat: latFromPixel(y, H),
        kmX: wx * KM_PER_PX,
        kmY: y * KM_PER_PX,
        miX: wx * KM_PER_PX * MI_PER_KM,
        miY: y * KM_PER_PX * MI_PER_KM,
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        onCursorRef.current(payload);
        setHover(pt);
      });
    };

    const onMapClick = (e) => {
      const pt = { x: wrapX(e.latlng.lng, W), y: e.latlng.lat };
      const t = calibTargetRef.current;
      if (t) {
        onCalibrateClickRef.current(pt.x, pt.y);
        return;
      }
      const m = modeRef.current;
      if (!m || m === "none") return;
      const pts = pointsRef.current;
      if (m === "measure") {
        setPoints(pts.length >= 2 ? [pt] : [...pts, pt]);
      } else {
        setPoints([...pts, pt]);
      }
    };

    const onDblClick = (e) => {
      if (modeRef.current === "area" && pointsRef.current.length >= 2) {
        e.originalEvent?.preventDefault();
      }
    };

    const onMoveEnd = () => {
      const c = map.getCenter();
      if (W > 0) {
        if (c.lng < -W * 0.5) {
          map.setView([c.lat, c.lng + W * 3], map.getZoom(), { animate: false });
          return;
        }
        if (c.lng > W * 1.5) {
          map.setView([c.lat, c.lng - W * 3], map.getZoom(), { animate: false });
          return;
        }
      }
      updateScale();
      onViewChangeRef.current({ x: wrapX(c.lng, W || 1), y: c.lat, z: map.getZoom() });
    };

    const updateScale = () => {
      if (!W || !H) return;
      const tl = map.latLngToContainerPoint([0, 0]);
      const tr = map.latLngToContainerPoint([0, W]);
      const span = Math.abs(tr.x - tl.x);
      if (!span) return;
      const kmPerScreenPx = (W * KM_PER_PX) / span;
      setScaleBar({ kmPerScreenPx, zoom: map.getZoom() });
    };

    map.on("mousemove", onMouseMove);
    map.on("click", onMapClick);
    map.on("dblclick", onDblClick);
    map.on("moveend", onMoveEnd);
    map.on("zoomend", updateScale);

    return () => {
      canceled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      imagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Base layer swapping -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    if (loadedLayerRef.current === layer) return;
    const def = getLayer(layer);
    let canceled = false;
    setStatus("loading");
    loadLayer(def)
      .then(({ url, w, h }) => {
        if (canceled) return;
        if (w !== mapSize.W || h !== mapSize.H) {
          setMapSize({ W: w, H: h });
        }
        imagesRef.current.forEach((ov) => ov.setUrl(url));
        loadedLayerRef.current = layer;
        setStatus("ok");
      })
      .catch(() => {
        if (canceled) return;
        const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
        imagesRef.current.forEach((ov) => ov.setUrl(url));
        loadedLayerRef.current = layer;
        setStatus("blocked");
      });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, mapSize?.W]);

  // ---- Focus handling (search / deep link) --------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !mapSize?.W) return;
    if (focus.type === "nation" || focus.type === "city") {
      const mk = placeMarkersRef.current?.[focus.name];
      if (mk) {
        map.setView(mk.getLatLng(), Math.max(map.getZoom(), 4));
        mk.openPopup();
      }
    } else if (focus.type === "coord") {
      const { a, b } = focus;
      let x = a;
      let y = b;
      if (Math.abs(a) > 180 || Math.abs(b) > 90) {
        // "x, y" image pixels
        x = wrapX(a, mapSize.W);
        y = b;
      } else {
        // "lat, lng"
        x = wrapX(b, mapSize.W);
        y = ((90 - a) / 180) * mapSize.H;
      }
      map.setView([y, x], Math.max(map.getZoom(), 1), { animate: true });
    }
    onFocusHandledRef.current();
  }, [focus, mapSize]);

  // ---- Measurement layer ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    const grp = L.layerGroup();
    const pts = points;
    const hv = hover;

    pts.forEach((p, i) => {
      const mk = L.circleMarker([p.y, p.x], {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: PICK_COLOR,
        fillOpacity: 1,
      }).addTo(grp);
      if (pts.length > 1) {
        mk.bindTooltip(String(i + 1), {
          permanent: true,
          direction: "top",
          offset: [0, -6],
          className: "atlas-pt-label",
        });
      }
    });

    if (mode === "measure") {
      if (pts.length === 2) {
        L.polyline(
          [
            [pts[0].y, pts[0].x],
            [pts[1].y, pts[1].x],
          ],
          { color: PICK_COLOR, weight: 3, dashArray: "8 6", opacity: 0.9 }
        ).addTo(grp);
      } else if (pts.length === 1 && hv) {
        L.polyline(
          [
            [pts[0].y, pts[0].x],
            [hv.y, hv.x],
          ],
          { color: PICK_COLOR, weight: 2, dashArray: "4 5", opacity: 0.55 }
        ).addTo(grp);
      }
    }

    if (mode === "path") {
      if (pts.length >= 2) {
        L.polyline(
          pts.map((p) => [p.y, p.x]),
          { color: PICK_COLOR, weight: 3, opacity: 0.9 }
        ).addTo(grp);
      }
      if (pts.length >= 1 && hv) {
        L.polyline(
          [
            [pts[pts.length - 1].y, pts[pts.length - 1].x],
            [hv.y, hv.x],
          ],
          { color: PICK_COLOR, weight: 2, dashArray: "4 5", opacity: 0.55 }
        ).addTo(grp);
      }
    }

    if (mode === "area") {
      const draw = [...pts];
      if (draw.length >= 2 && hv) draw.push(hv);
      if (draw.length >= 2) {
        L.polygon(
          draw.map((p) => [p.y, p.x]),
          {
            color: PICK_COLOR,
            weight: 2,
            fillColor: PICK_COLOR,
            fillOpacity: 0.16,
            dashArray: hv ? "6 6" : undefined,
          }
        ).addTo(grp);
      }
    }

    grp.addTo(map);
    return () => {
      grp.remove();
    };
  }, [points, hover, mode, mapSize]);

  // ---- Wiki nations layer ---------------------------------------------------
  const placeMarkersRef = useRef({});
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showNations) return;
    const grp = L.layerGroup();
    placeMarkersRef.current = {};
    const { W, H } = mapSize;
    const ovr = overridesRef.current;
    PLACES.forEach((p) => {
      const pos = ovr[p.name];
      const hasBase = p.nx != null && p.ny != null;
      const latlng = pos ? [pos.y, pos.x] : hasBase ? [p.ny * H, p.nx * W] : null;
      if (!latlng) return;
      const isCity = p.kind === "city";
      const mk = L.circleMarker(latlng, {
        radius: isCity ? 3 : 4,
        color: "#ffffff",
        weight: 1.5,
        fillColor: pos
          ? "#059669"
          : isCity
            ? "#f59e0b"
            : p.missing
              ? "#a1a1aa"
              : "#0e7490",
        fillOpacity: 0.95,
      }).addTo(grp);
      mk.bindTooltip(p.name, {
        direction: "top",
        offset: [0, -5],
        className: "atlas-tooltip",
      });
      const href = fullWikiUrl(p.href);
      mk.bindPopup(
        `<div class="atlas-popup"><div class="atlas-popup-title">${p.name}</div>` +
          `<div class="atlas-popup-coords">${latlng[0].toFixed(0)}, ${latlng[1].toFixed(0)} px · ${isCity ? "city" : "nation"}</div>` +
          (p.missing
            ? `<div class="atlas-popup-missing">No wiki page yet</div>`
            : `<a class="atlas-popup-link" href="${href}" target="_blank" rel="noopener noreferrer">Open on TEPwiki ↗</a>`)
      );
      mk.on("click", (e) => L.DomEvent.stopPropagation(e));
      placeMarkersRef.current[p.name] = mk;
    });
    grp.addTo(map);
    return () => {
      grp.remove();
      placeMarkersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNations, mapSize, overrides]);

  // ---- Calibration cursor hint ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().classList.toggle("calibrating", !!calibTargetRef.current);
    if (calibTargetRef.current) {
      map.getContainer().title = `Place ${calibTargetRef.current}`;
    } else {
      map.getContainer().removeAttribute("title");
    }
  }, [calibTarget]);

  // ---- Render --------------------------------------------------------------
  const activeLayer = getLayer(layer);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: "#e5e3df" }}
      />
      {status === "loading" && (
        <div className="absolute inset-0 z-[900] flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 rounded-2xl shadow-xl border border-zinc-200 px-6 py-4 text-center">
            <div className="w-7 h-7 border-[3px] border-[#0e7490] border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <div className="text-[12px] font-semibold tracking-wide uppercase text-zinc-600">
              Loading {activeLayer.label}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono mt-1">
              Fetching full-resolution world map
            </div>
          </div>
        </div>
      )}
      {status === "blocked" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[950] pointer-events-none">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
            Map image unreachable — showing placeholder grid. Measurements still
            work but scale is not calibrated.
          </div>
        </div>
      )}
      {scaleBar && status !== "loading" && (
        <ScaleBarReadout bar={scaleBar} />
      )}
    </div>
  );
}

function ScaleBarReadout({ bar }) {
  const { kmPerScreenPx, zoom } = bar;
  const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let value = 0.5;
  let width = 0;
  for (let i = nice.length - 1; i >= 0; i--) {
    const w = nice[i] / kmPerScreenPx;
    if (w <= 140) {
      value = nice[i];
      width = w;
      break;
    }
  }
  if (!width) {
    value = nice[0];
    width = value / kmPerScreenPx;
  }
  const mi = value * MI_PER_KM;
  return (
    <div className="absolute bottom-3 left-3 z-[700] pointer-events-none select-none">
      <div
        className="h-[6px] border-x border-b border-zinc-700 bg-white/60"
        style={{ width }}
      />
      <div className="text-[10px] font-semibold text-zinc-700 mt-0.5 font-mono">
        {value < 1 ? `${value} km` : `${value.toLocaleString()} km`}
        <span className="text-zinc-400"> · </span>
        {mi < 1 ? `${mi.toFixed(2)} mi` : `${mi.toLocaleString(void 0, { maximumFractionDigits: mi < 10 ? 1 : 0 })} mi`}
      </div>
      <div className="text-[9px] text-zinc-400 font-mono mt-0.5">
        zoom {zoom.toFixed(2)}
      </div>
    </div>
  );
}