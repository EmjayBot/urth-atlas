import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  FALLBACK_W,
  FALLBACK_H,
  KM_PER_PX,
  MI_PER_KM,
  getLayer,
  resolveLayer,
  FULL_W,
  FULL_H,
  MARKERS_URL,
  MARKERS_MOBILE_URL,
} from "../lib/scale";
import { wrapX, wrapY, latFromPixel, lngFromX, pixelFromLat, pixelFromLng } from "../lib/geo";
import { loadLayer, makeFallbackGrid } from "../lib/imageCache";
import {
  fullWikiUrl,
  wikiTitleFor,
  peekWikiSummary,
  fetchWikiSummary,
  shortExtract,
} from "../lib/wiki";
import CylinderView from "./CylinderView";
import { IS_LOW_MEM } from "../lib/device";

const PICK_COLOR = "#0e7490";
// Stability: 5 world copies (i in -2..2) is enough to fill ultra-wide screens
// at max zoom-out. The old 21 copies of 11232x7525 images (~7GB decoded)
// caused major jank / OOMs. Overlays reuse the same window.
// Mobile / low-memory devices get 3 copies: each 84MP decode is ~336MB and
// mobile Safari jetsams the tab long before 5 copies finish decoding.
const WORLD_COPIES = IS_LOW_MEM ? 3 : 5;
const HALF_COPIES = IS_LOW_MEM ? 1 : 2;

// Zoom levels: -3 = "all the way out" (whole flat map fits the screen).
// Beyond -3 is the easter egg: keep zooming and the repeating map reads as a
// cylinder wrapping around.
const NORMAL_MIN_ZOOM = -3;
const CYLINDER_ZOOM = -3.5;
const ABSOLUTE_MIN_ZOOM = -7;

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
  locked = false,
  onLock = () => {},
  hover,
  setHover,
  onCursor,
  mapSize,
  setMapSize,
  status,
  setStatus,
  layer,
  dataOverlays = [],
  overlayOpacity = 70,
  showNations,
  places,
  initialView,
  focus,
  onFocusHandled,
  onViewChange,
  onMapReady,
  calibTarget,
  onCalibrateClick,
  opacity,
  showScale,
  showGrid,
  showPixelGrid,
  showCoords,
  showMarkers,
  onContextMenu,
  onPopupAction,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const imagesRef = useRef([]);
  const loadedLayerRef = useRef(null);
  const [scaleBar, setScaleBar] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(null);
  const [cylCx, setCylCx] = useState(0);
  const [cylImg, setCylImg] = useState(null);

  const modeRef = useRefLatest(mode);
  const pointsRef = useRefLatest(points);
  const lockedRef = useRefLatest(locked);
  const onLockRef = useRefLatest(onLock);
  const hoverRef = useRefLatest(hover);
  const layerRef = useRefLatest(layer);
  const placesRef = useRefLatest(places);
  const calibTargetRef = useRefLatest(calibTarget);
  const onCalibrateClickRef = useRefLatest(onCalibrateClick);
  const onCursorRef = useRefLatest(onCursor);
  const onViewChangeRef = useRefLatest(onViewChange);
  const onFocusHandledRef = useRefLatest(onFocusHandled);
  const onMapReadyRef = useRefLatest(onMapReady);
  const onContextMenuRef = useRefLatest(onContextMenu);
  const onPopupActionRef = useRefLatest(onPopupAction);

  const initialViewRef = useRef(initialView);
  useEffect(() => {
    initialViewRef.current = initialView;
  }, [initialView]);

  const rafRef = useRef(0);
  const lastCursorRef = useRef(0);

  // Base opacity has a dead zone: the slider reads 100→50 with the map fully
  // solid, and only fades the tiles out across 50→0 (revealing what's under).
  const effectiveBaseOpacity = (v) => (v >= 50 ? 1 : Math.max(0, v) / 50);

  const applyOpacity = () => {
    imagesRef.current.forEach((ov) => ov.setOpacity(effectiveBaseOpacity(opacity)));
  };

  // ---- Map creation -------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      // Low-memory devices stop at the full-world view: no cylinder mode,
      // which would decode even more tiles while hidden behind the scene.
      minZoom: IS_LOW_MEM ? NORMAL_MIN_ZOOM : ABSOLUTE_MIN_ZOOM,
      maxZoom: 6,
      // Fluid motion tuning (zero quality impact — end frames identical):
      // - zoomSnap 0: continuous wheel/pinch zoom instead of stepped snaps.
      // - fadeAnimation off: skips cross-fading giant layers during zooms
      //   (each frame composited once, not twice).
      // - softer inertia: longer, smoother pan glide.
      zoomSnap: 0,
      zoomDelta: 0.5,
      inertia: true,
      inertiaDeceleration: 2000,
      inertiaMaxSpeed: 2600,
      doubleClickZoom: false,
      attributionControl: false,
      preferCanvas: true,
      // Per-frame scaling of 84MP tiles during pinch-zoom is what kills
      // mobile GPUs — snap instead of animating on low-memory devices.
      zoomAnimation: !IS_LOW_MEM,
      fadeAnimation: false,
      markerZoomAnimation: true,
      trackResize: true,
      wheelPxPerZoomLevel: 90,
    });
    mapRef.current = map;

    let canceled = false;
    let H = 0;
    let W = 0;

    const applySatGrade = () => {
      // Google-Earth vibe: gently lift satellite imagery (richer blues/greens)
      // via GPU-friendly CSS filters on the <img> elements only.
      const isSat = layerRef.current === "satellite";
      imagesRef.current.forEach((ov) => {
        const el = ov.getElement();
        if (!el) return;
        el.classList.toggle("urth-sat-base", isSat);
      });
    };

    const installOverlays = (url) => {
      // 5 copies side-by-side so the map wraps horizontally and fills the
      // screen at extreme (cylinder) zoom. Vertical is clamped.
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        const ov = L.imageOverlay(
          url,
          [
            [0, i * W],
            [H, (i + 1) * W],
          ],
          { interactive: false, bubblingMouseEvents: false, className: "urth-base-tile", zIndex: 1 }
        ).addTo(map);
        const el = ov.getElement();
        if (el) {
          el.decoding = "async";
          el.referrerPolicy = "no-referrer";
          el.draggable = false;
          // Hint the browser these are large static layers.
          el.style.willChange = "transform";
        }
        imagesRef.current.push(ov);
      }
      applyOpacity();
      applySatGrade();
    };

    const finishLoad = (url, w, h, okStatus) => {
      if (canceled) return;
      W = w;
      H = h;
      loadedLayerRef.current = layerRef.current;
      setMapSize({ W, H });
      // Set the initial view first so overlays initialize on a ready map.
      const init = initialViewRef.current;
      if (init?.at) {
        map.setView([init.at[1], init.at[0]], init.z ?? 1, { animate: false });
      } else {
        map.setView([H / 2, W / 2], 0, { animate: false });
      }
      installOverlays(url);
      setZoomLevel(map.getZoom());
      setCylImg(imagesRef.current[0]?.getElement()?.src ?? url);
      setStatus(okStatus);
      onMapReadyRef.current(map);
    };

    const def = resolveLayer(layerRef.current);
    if (!def) {
      if (canceled) return;
      const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
      finishLoad(url, FALLBACK_W, FALLBACK_H, "blocked");
      return;
    }
    // Mobile serves a downscaled image stretched over full-res bounds, so
    // pins, wrap, and measurements match desktop exactly.
    loadLayer(def)
      .then(({ url, w, h }) =>
        finishLoad(url, def.mobile ? FULL_W : w, def.mobile ? FULL_H : h, "ok")
      )
      .catch(() => {
        if (canceled) return;
        const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
        finishLoad(url, FALLBACK_W, FALLBACK_H, "blocked");
      });

    // Cursor readout is cheap; hover preview rebuilds the measurement layer,
    // so skip it entirely unless a measurement tool (or place-targeting) is
    // active — plain panning then does zero React re-renders per mousemove.
    const onMouseMove = (e) => {
      const x = e.latlng.lng;
      const y = e.latlng.lat;
      const wx = wrapX(x, W);
      const wy = wrapY(y, H);
      const pt = { x: wx, y: wy };
      const payload = {
        x: wx,
        y: wy,
        lat: latFromPixel(wy, H),
        lngDeg: lngFromX(wx, W || 1),
        kmX: wx * KM_PER_PX,
        kmY: wy * KM_PER_PX,
        miX: wx * KM_PER_PX * MI_PER_KM,
        miY: wy * KM_PER_PX * MI_PER_KM,
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        // Status-bar readout at ~12Hz is plenty — full-rate React renders
        // every mousemove frame just steal from pan/zoom smoothness.
        const now = performance.now();
        if (now - (lastCursorRef.current || 0) > 80) {
          lastCursorRef.current = now;
          onCursorRef.current(payload);
        }
        const m = modeRef.current;
        if ((m && m !== "none") || calibTargetRef.current) setHover(pt);
      });
    };

    const onMapClick = (e) => {
      const pt = { x: wrapX(e.latlng.lng, W), y: wrapY(e.latlng.lat, H) };
      const t = calibTargetRef.current;
      if (t) {
        onCalibrateClickRef.current(pt.x, pt.y);
        L.popup({ className: "atlas-popup", closeButton: true })
          .setLatLng([pt.y, pt.x])
          .setContent(
            `<div class="atlas-popup"><div class="atlas-popup-title">${t}</div>` +
              `<div class="atlas-popup-coords">${pt.x.toFixed(0)}, ${pt.y.toFixed(0)} px</div>` +
              `<div class="atlas-popup-coords">${(pt.x * KM_PER_PX).toLocaleString(void 0, { maximumFractionDigits: 0 })} km • ${(pt.x * KM_PER_PX * MI_PER_KM).toLocaleString(void 0, { maximumFractionDigits: 0 })} mi E</div>`
          )
          .addTo(map);
        return;
      }
      const m = modeRef.current;
      if (!m || m === "none") return;
      // Finalized measurements ignore clicks until Resume/Clear (or Esc).
      if (lockedRef.current) return;
      const pts = pointsRef.current;
      if (m === "measure") {
        if (pts.length >= 2) {
          // Already complete — ignore stray clicks instead of restarting.
          return;
        }
        const next = [...pts, pt];
        setPoints(next);
        // Two-point measure completes itself on the second click.
        if (next.length >= 2) onLockRef.current?.();
      } else {
        setPoints([...pts, pt]);
      }
    };

    const onDblClick = (e) => {
      // Double-click finishes path/area. Leaflet fires two 'click' events
      // before 'dblclick', so the second click lands as a near-duplicate
      // vertex — drop it, then finalize if the shape has a result.
      const m = modeRef.current;
      if ((m === "path" || m === "area") && !lockedRef.current) {
        e.originalEvent?.preventDefault();
        const pts = pointsRef.current.slice(0, -1);
        setPoints(pts);
        const done =
          (m === "path" && pts.length >= 2) || (m === "area" && pts.length >= 3);
        if (done) onLockRef.current?.();
      }
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      if (!W || !H) return;
      const rect = container.getBoundingClientRect();
      const pt = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
      onContextMenuRef.current({
        x: wrapX(pt.lng, W || 1),
        y: wrapY(pt.lat, H || 1),
        lat: latFromPixel(pt.lat, H || 1),
        lngDeg: lngFromX(pt.lng, W || 1),
        clientX: e.clientX,
        clientY: e.clientY,
      });
    };
    container.addEventListener("contextmenu", onContextMenu, true);

    // Delegated actions for Leaflet popup buttons (Copy / Measure).
    const onPopupClick = (e) => {
      const btn = e.target?.closest?.("[data-act]");
      if (!btn || !onPopupActionRef.current) return;
      onPopupActionRef.current(btn.dataset.act, {
        name: btn.dataset.name,
        x: +btn.dataset.x,
        y: +btn.dataset.y,
        lat: btn.dataset.lat != null ? +btn.dataset.lat : null,
        lng: btn.dataset.lng != null ? +btn.dataset.lng : null,
      });
    };
    container.addEventListener("click", onPopupClick);

    const onMoveEnd = () => {
      const c = map.getCenter();
      // Horizontal infinite wrap (world repeats every W px).
      if (W > 0 && (c.lng < -W * 0.5 || c.lng > W * 1.5)) {
        const wrapped = ((c.lng + W * 0.5) % W + W) % W - W * 0.5;
        map.setView([c.lat, wrapped], map.getZoom(), { animate: false });
        return;
      }
      // Vertical clamp (single copy vertically).
      if (H > 0) {
        const vpHalf = map.getSize().y / 2 / 2 ** map.getZoom();
        let newY = null;
        if (vpHalf * 2 >= H) {
          // Map smaller than the viewport vertically — lock to center.
          if (Math.abs(c.lat - H / 2) > 0.5) newY = H / 2;
        } else {
          const minY = vpHalf;
          const maxY = H - vpHalf;
          if (c.lat < minY) newY = minY;
          else if (c.lat > maxY) newY = maxY;
        }
        if (newY !== null) {
          map.setView([newY, c.lng], map.getZoom(), { animate: false });
          return;
        }
      }
      updateScale();
      setZoomLevel(map.getZoom());
      setCylCx(wrapX(c.lng, W || 1));
      onViewChangeRef.current({ x: wrapX(c.lng, W || 1), y: wrapY(c.lat, H || 1), z: map.getZoom() });
    };

    const updateScale = () => {
      if (!W || !H) return;
      const tl = map.latLngToContainerPoint([0, 0]);
      const tr = map.latLngToContainerPoint([0, W]);
      const span = Math.abs(tr.x - tl.x);
      if (!span) return;
      const kmPerScreenPx = (W * KM_PER_PX) / span;
      setScaleBar({ kmPerScreenPx, zoom: map.getZoom() });
      setZoomLevel(map.getZoom());
    };

    map.on("mousemove", onMouseMove);
    map.on("click", onMapClick);
    map.on("dblclick", onDblClick);
    map.on("moveend", onMoveEnd);
    map.on("zoomend", updateScale);

    // During pan/zoom gestures, hide the expensive marker sheets so each
    // frame composites fewer pixels. They fade back the moment motion ends.
    const motionOn = () => map.getContainer().classList.add("urth-in-motion");
    const motionOff = () => map.getContainer().classList.remove("urth-in-motion");
    map.on("movestart", motionOn);
    map.on("zoomstart", motionOn);
    map.on("moveend", motionOff);
    map.on("zoomend", motionOff);

    return () => {
      canceled = true;
      container.removeEventListener("contextmenu", onContextMenu, true);
      container.removeEventListener("click", onPopupClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.off("movestart", motionOn);
      map.off("zoomstart", motionOn);
      map.off("moveend", motionOff);
      map.off("zoomend", motionOff);
      map.remove();
      mapRef.current = null;
      imagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Cylinder easter egg (hides the flat Leaflet map) -----------------------
  // Disabled on low-memory devices (can't zoom that far out anyway).
  const cylinder = !IS_LOW_MEM && zoomLevel !== null && zoomLevel <= CYLINDER_ZOOM;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().classList.toggle("urth-cyl-hidden", cylinder);
  }, [cylinder]);

  // When leaving cylinder mode, point the flat map at the rotated position.
  const cylActiveRef = useRef(false);
  useEffect(() => {
    if (cylinder) {
      cylActiveRef.current = true;
    } else if (cylActiveRef.current) {
      cylActiveRef.current = false;
      const map = mapRef.current;
      if (map && mapSize?.W && cylCx != null) {
        map.setView([map.getCenter().lat, cylCx], map.getZoom(), { animate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cylinder]);

  useEffect(() => {
    if (mapRef.current && mapSize?.W) {
      imagesRef.current.forEach((ov) => ov.setOpacity(effectiveBaseOpacity(opacity)));
    }
  }, [opacity, mapSize?.W]);

  // ---- Base layer swapping -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    if (loadedLayerRef.current === layer) {
      // Still refresh the satellite grade (toggled back to same layer).
      const isSat = layer === "satellite";
      imagesRef.current.forEach((ov) => {
        const el = ov.getElement();
        if (el) el.classList.toggle("urth-sat-base", isSat);
      });
      return;
    }
    const def = resolveLayer(layer);
    let canceled = false;
    setStatus("loading");
    if (!def) {
      // Layer has no mobile-safe variant (e.g. remote full-res overlay id in
      // a shared link) — show the placeholder grid instead of decoding 84MP.
      const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
      imagesRef.current.forEach((ov) => ov.setUrl(url));
      loadedLayerRef.current = layer;
      applyOpacity();
      setStatus("blocked");
      return () => {
        canceled = true;
      };
    }
    loadLayer(def)
      .then(({ url, w, h }) => {
        if (canceled) return;
        const W = def.mobile ? FULL_W : w;
        const H = def.mobile ? FULL_H : h;
        if (W !== mapSize.W || H !== mapSize.H) {
          setMapSize({ W, H });
        }
        imagesRef.current.forEach((ov) => ov.setUrl(url));
        loadedLayerRef.current = layer;
        applyOpacity();
        const isSat = layer === "satellite";
        // setUrl swaps the <img> src async — grade on next tick too.
        requestAnimationFrame(() => {
          imagesRef.current.forEach((ov) => {
            const el = ov.getElement();
            if (el) el.classList.toggle("urth-sat-base", isSat);
          });
        });
        setCylImg(imagesRef.current[0]?.getElement()?.src ?? url);
        setStatus("ok");
      })
      .catch(() => {
        if (canceled) return;
        const url = makeFallbackGrid(FALLBACK_W, FALLBACK_H);
        imagesRef.current.forEach((ov) => ov.setUrl(url));
        loadedLayerRef.current = layer;
        applyOpacity();
        setStatus("blocked");
      });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, mapSize?.W]);

  // ---- Grid overlays ---------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    const grp = L.layerGroup();
    const { W, H } = mapSize;

    const gridForCopy = (step, color, weight, offsetX) => {
      const lines = [];
      for (let x = 0; x <= W; x += step) {
        lines.push(
          L.polyline(
            [
              [0, x + offsetX],
              [H, x + offsetX],
            ],
            { color, weight, opacity: 0.35, interactive: false }
          )
        );
      }
      for (let y = 0; y <= H; y += step) {
        lines.push(
          L.polyline(
            [
              [y, offsetX],
              [y, W + offsetX],
            ],
            { color, weight, opacity: 0.35, interactive: false }
          )
        );
      }
      return lines;
    };

    if (showGrid) {
      // True graticule as vectors (canvas-rendered) — far cheaper than the old
      // 11232x7525 grid.png image decoded 5x (~340MB). 20° meridians + 15°
      // parallels locked to the calibrated 0° lines (geo.js), so the overlay
      // sits exactly on the map's own Aequator and prime meridian.
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        for (let lng = -180; lng < 180; lng += 20) {
          const x = pixelFromLng(lng, W) + i * W;
          L.polyline(
            [
              [0, x],
              [H, x],
            ],
            { color: "#64748b", weight: 1, opacity: 0.28, interactive: false }
          ).addTo(grp);
        }
        for (let lat = -60; lat <= 60; lat += 15) {
          const y = pixelFromLat(lat, H);
          L.polyline(
            [
              [y, i * W],
              [y, (i + 1) * W],
            ],
            { color: "#64748b", weight: 1, opacity: 0.28, interactive: false }
          ).addTo(grp);
        }
      }
    }
    if (showPixelGrid) {
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        gridForCopy(256, "#0e7490", 1, i * W).forEach((l) => grp.addLayer(l));
      }
    }

    grp.addTo(map);
    return () => {
      grp.remove();
    };
  }, [showGrid, showPixelGrid, mapSize]);

  // ---- Viewport-culled world copies -----------------------------------------
  // Data overlays + markers each span up to 5 world copies (5×84MP decodes).
  // Only ~2 copies ever intersect the viewport, so groups keep copies for
  // viewport ±1 and add/prune on view changes: identical rest pixels, far
  // less memory + per-frame compositing. Adds happen continuously during
  // motion (no pop-in); pruning waits for settle.
  const mapSizeRef = useRefLatest(mapSize);
  const overlayOpacityRef = useRefLatest(overlayOpacity);
  const markersRef = useRef(null); // { grp, url } | null

  const copyRange = () => {
    const map = mapRef.current;
    const ms = mapSizeRef.current;
    if (!map || !ms?.W) return null;
    const b = map.getBounds();
    const lo = Math.min(b.getWest(), b.getEast());
    const hi = Math.max(b.getWest(), b.getEast());
    const half = IS_LOW_MEM ? 1 : HALF_COPIES;
    return {
      W: ms.W,
      H: ms.H,
      iMin: Math.max(-half, Math.floor(lo / ms.W) - 1),
      iMax: Math.min(half, Math.floor(hi / ms.W) + 1),
    };
  };

  const syncCopies = (grp, url, optsFn, prune) => {
    const r = copyRange();
    if (!r || !grp || !url) return;
    const have = new Set();
    grp.getLayers().forEach((l) => {
      if (l._copyI != null) have.add(l._copyI);
    });
    for (let i = r.iMin; i <= r.iMax; i++) {
      if (have.has(i)) continue;
      const ov = L.imageOverlay(url, [[0, i * r.W], [r.H, (i + 1) * r.W]], optsFn());
      ov._copyI = i;
      grp.addLayer(ov);
    }
    if (prune) {
      grp.getLayers().forEach((l) => {
        if (l._copyI != null && (l._copyI < r.iMin || l._copyI > r.iMax))
          grp.removeLayer(l);
      });
    }
  };

  const overlayTileOpts = () => ({
    opacity: (overlayOpacityRef.current ?? 70) / 100,
    interactive: false,
    bubblingMouseEvents: false,
    zIndex: 2,
    className: "urth-data-overlay",
  });
  const markerTileOpts = () => ({
    interactive: false,
    bubblingMouseEvents: false,
    zIndex: 5,
    className: "urth-markers-tile",
  });
  const flagMarkerTiles = (grp) => {
    grp.getLayers().forEach((l) => {
      const el = l.getElement?.();
      if (el) {
        el.decoding = "async";
        el.draggable = false;
      }
    });
  };

  const syncAllCoverage = (prune) => {
    Object.values(overlayGroupsRef.current).forEach((e) => {
      if (e?.grp && e.url) syncCopies(e.grp, e.url, overlayTileOpts, prune);
    });
    const m = markersRef.current;
    if (m?.grp && m.url) {
      syncCopies(m.grp, m.url, markerTileOpts, prune);
      flagMarkerTiles(m.grp);
    }
  };

  // ---- Data overlays (stackable semi-transparent rasters) --------------------
  // One group per enabled id; groups persist and only gain/lose world copies
  // via syncAllCoverage, so toggling/opacity never reload tiles.
  const overlayGroupsRef = useRef({});
  const overlaySizeRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    const { W, H } = mapSize;
    const sizeKey = `${W}x${H}`;
    const groups = overlayGroupsRef.current;
    if (overlaySizeRef.current !== sizeKey) {
      for (const id of Object.keys(groups)) {
        groups[id].grp.remove();
        delete groups[id];
      }
      overlaySizeRef.current = sizeKey;
    }
    const wanted = new Set(dataOverlays ?? []);
    for (const id of Object.keys(groups)) {
      if (!wanted.has(id)) {
        groups[id].grp.remove();
        delete groups[id];
      }
    }
    let canceled = false;
    for (const id of wanted) {
      if (groups[id]?.url) continue;
      const def = resolveLayer(id);
      // Null on low-memory devices = remote full-res overlay with no mobile
      // variant. Skipping beats decoding 84MP and killing the tab.
      if (!def?.overlay) continue;
      if (!groups[id]) {
        const grp = L.layerGroup();
        groups[id] = { grp, url: null };
        grp.addTo(map);
      }
      loadLayer(def)
        .then(({ url }) => {
          if (canceled || !overlayGroupsRef.current[id]) return;
          overlayGroupsRef.current[id].url = url;
          syncCopies(groups[id].grp, url, overlayTileOpts, true);
        })
        .catch(() => {
          const e = overlayGroupsRef.current[id];
          if (e) {
            e.grp.remove();
            delete overlayGroupsRef.current[id];
          }
        });
    }
    syncAllCoverage(true);
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOverlays, mapSize]);

  // Overlay opacity applies to mounted tiles without reloading them.
  useEffect(() => {
    const o = (overlayOpacity ?? 70) / 100;
    Object.values(overlayGroupsRef.current).forEach((e) => {
      e.grp.getLayers().forEach((l) => {
        if (l.setOpacity) l.setOpacity(o);
      });
    });
  }, [overlayOpacity]);

  // ---- TEPmap easter egg: revealed under the base layer at 0% opacity ------
  // Mounted once (never torn down on opacity drags), rebuilt only if the
  // base size changes. Desktop preloads it idle; phones fetch on first dip
  // below 100% so it never taxes first paint.
  const tepRef = useRef(null);
  const tepSizeRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W) return;
    // Phones never mount the underlay: rasterizing the vector SVG across the
    // full world is another memory spike with zero benefit at phone zooms.
    if (IS_LOW_MEM) return () => {};
    const { W, H } = mapSize;
    const sizeKey = `${W}x${H}`;
    if (tepSizeRef.current !== sizeKey) {
      tepRef.current?.grp.remove();
      tepRef.current = null;
      tepSizeRef.current = sizeKey;
    }
    if ((opacity ?? 100) >= 100 && !tepRef.current) return () => {};
    if (tepRef.current) return () => {};
    let canceled = false;
    const url = `${import.meta.env.BASE_URL}TEPmap.svg`;
    const probe = new Image();
    probe.onload = () => {
      if (canceled || tepRef.current || !mapRef.current) return;
      const grp = L.layerGroup();
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        L.imageOverlay(url, [[0, i * W], [H, (i + 1) * W]], {
          opacity: 1,
          interactive: false,
          bubblingMouseEvents: false,
          zIndex: 0,
          className: "urth-tep-underlay",
        }).addTo(grp);
      }
      grp.addTo(mapRef.current);
      tepRef.current = { grp };
    };
    probe.onerror = () => {};
    probe.src = url;
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSize, opacity]);

  // ---- City & subnational markers overlay (idle-deferred) ----------------------
  // Not needed for first paint — mounts after idle so the base map gets
  // bandwidth + decode time first. Served as PNG (source of truth) since the
  // fine text/lines showed softness complaints under WebP in some browsers.
  // Copies are viewport-culled via syncAllCoverage like data overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showMarkers) return;
    let canceled = false;
    const mount = (url) => {
      if (canceled || markersRef.current) return;
      const grp = L.layerGroup();
      markersRef.current = { grp, url };
      grp.addTo(map);
      syncCopies(grp, url, markerTileOpts, true);
      flagMarkerTiles(grp);
    };
    const start = () => {
      if (canceled) return;
      // Downscaled markers on phones (same 84MP-decode problem as base).
      const png = IS_LOW_MEM ? MARKERS_MOBILE_URL : MARKERS_URL;
      loadLayer({ url: png, fallbackUrl: png })
        .then(({ url }) => mount(url))
        .catch(() => mount(png));
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(start, { timeout: 2000 });
      return () => {
        canceled = true;
        cancelIdleCallback(id);
        markersRef.current?.grp.remove();
        markersRef.current = null;
      };
    }
    const t = setTimeout(start, 800);
    return () => {
      canceled = true;
      clearTimeout(t);
      markersRef.current?.grp.remove();
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMarkers, mapSize]);

  // ---- Coverage tracking (add on move, prune on settle) -----------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let raf = 0;
    const onMove = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          syncAllCoverage(false);
        });
      }
    };
    const onSettled = () => syncAllCoverage(true);
    map.on("move", onMove);
    map.on("moveend", onSettled);
    map.on("zoomend", onSettled);
    return () => {
      map.off("move", onMove);
      map.off("moveend", onSettled);
      map.off("zoomend", onSettled);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Coordinate labels (on true graticule intersections) -------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showCoords) return;
    const grp = L.layerGroup();
    const { W, H } = mapSize;
    for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
      for (let lat = -60; lat <= 60; lat += 30) {
        for (let lng = -180; lng < 180; lng += 60) {
          const y = pixelFromLat(lat, H);
          const px = pixelFromLng(lng, W) + i * W;
          const icon = L.divIcon({
            className: "urth-coord-label",
            html: `${lat.toFixed(0)}°, ${lng.toFixed(0)}°`,
            iconSize: null,
          });
          L.marker([y, px], { icon, interactive: false }).addTo(grp);
        }
      }
    }
    grp.addTo(map);
    return () => {
      grp.remove();
    };
  }, [showCoords, mapSize]);

  // ---- Focus handling (search / deep link) --------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !mapSize?.W) return;
    if (focus.name && placeLatLngRef.current?.[focus.name]) {
      const ll = placeLatLngRef.current[focus.name];
      map.setView(ll, -0.25);
      const mk = placeMarkersRef.current?.[focus.name];
      if (mk) mk.openPopup();
    } else if (focus.type === "coord") {
      const { a, b } = focus;
      let x = a;
      let y = b;
      if (Math.abs(a) > 180 || Math.abs(b) > 90) {
        // "x, y" image pixels
        x = wrapX(a, mapSize.W);
        y = b;
      } else {
        // "lat, lng" (calibrated 75N..75S world)
        x = wrapX(b, mapSize.W);
        y = pixelFromLat(a, mapSize.H);
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
    // Finalized shapes stop tracking the cursor and render solid.
    const hv = locked ? null : hover;

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
  }, [points, hover, mode, locked, mapSize]);

  // ---- Places layer ---------------------------------------------------------
  // Nations (text labels) and settlements (tiered dots) are separate Leaflet
  // groups with independent sidebar toggles — hiding nation labels must not
  // hide capitals/cities/towns. Both register key-scoped entries into the
  // shared refs used by search focus + popups.
  const placeMarkersRef = useRef({});
  const placeLatLngRef = useRef({});
  const forgetKeys = (keys) => {
    for (const k of keys) {
      delete placeMarkersRef.current[k];
      delete placeLatLngRef.current[k];
    }
  };

  const buildPlacePopup = (p, W, H, nearest) => {
    const kind = p.kind ?? "city";
    // Territories keep kind "nation" in data but read as Territory.
    const isTerr = kind === "nation" && typeof p.territory === "string" && p.territory.trim();
    const kindLabel = isTerr ? "Territory" : kind.charAt(0).toUpperCase() + kind.slice(1);
    const lat = latFromPixel(p.y, H);
    const lng = lngFromX(p.x, W);
    const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
    const lngStr = `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? "E" : "W"}`;
    const hemi = lat >= 0 ? "Northern hemisphere" : "Southern hemisphere";
    const href = p.href ? fullWikiUrl(p.href) : null;
    const esc = (s) =>
      String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const wikiTitle = wikiTitleFor(p);
    return (
      `<div class="atlas-popup" data-wiki="${esc(wikiTitle)}"><div class="atlas-popup-head">` +
      `<span class="atlas-popup-title">${p.name}</span>` +
      `<span class="atlas-popup-kind atlas-popup-kind-${kind}">${kindLabel}</span></div>` +
      `<div class="atlas-popup-coords">${latStr}, ${lngStr} · ${hemi}</div>` +
      `<div class="atlas-popup-coords">X ${p.x.toFixed(0)} · Y ${p.y.toFixed(0)}${nearest ? ` · Nearest: ${nearest}` : ""}</div>` +
      `<div class="atlas-popup-wiki" hidden></div>` +
      `<div class="atlas-popup-actions">` +
      `<button class="atlas-popup-btn" data-act="copy" data-name="${esc(p.name)}" data-x="${p.x}" data-y="${p.y}" data-lat="${lat}" data-lng="${lng}">Copy location</button>` +
      `<button class="atlas-popup-btn atlas-popup-btn-danger" data-act="remove" data-name="${esc(p.name)}" data-x="${p.x}" data-y="${p.y}" title="Remove this marker">Remove</button>` +
      `</div>` +
      (href
        ? `<a class="atlas-popup-link" href="${href}" target="_blank" rel="noopener noreferrer">Learn more on TEPwiki <span aria-hidden="true">↗</span></a>`
        : `<div class="atlas-popup-missing">No TEPwiki page linked yet</div>`)
    );
  };

  // ---- Nations (text labels, one per world copy) ------------------------------
  // Built once per places/mapSize (NOT per zoom — zoom only toggles a CSS
  // class, so zoom gestures don't rebuild markers). Text labels stay visible
  // down to the full-world zoom (NORMAL_MIN_ZOOM), not just zoom >= 0.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showNations) return;
    const grp = L.layerGroup();
    const { W } = mapSize;
    const keys = [];
    placesRef.current.forEach((p) => {
      if (p.kind !== "nation" || p.x == null || p.y == null) return;
      const latlng = [p.y, p.x];
      placeLatLngRef.current[p.name] = latlng;
      const popup = buildPlacePopup(p, mapSize.W, mapSize.H, null);
      // Territories render their name in the subnational style (Bell MT Bold
      // Italic) instead of the nation style — no extra sub-line.
      const isTerr = typeof p.territory === "string" && p.territory.trim();
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        const icon = L.divIcon({
          className: "urth-nation-text",
          html: `<span class="urth-nation-text-name${isTerr ? " terr" : ""}">${p.name}</span>`,
          iconSize: null,
        });
        const mk = L.marker([p.y, p.x + i * W], { icon, riseOnHover: true }).addTo(grp);
        mk.bindPopup(popup);
        mk.on("click", (e) => L.DomEvent.stopPropagation(e));
        if (i === 0) placeMarkersRef.current[p.name] = mk;
      }
      keys.push(p.name);
    });
    grp.addTo(map);
    return () => {
      grp.remove();
      forgetKeys(keys);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNations, mapSize, places]);

  // ---- Settlements (tiered dots; names live on the map layer itself) ---------
  // Settlement tiers (names already printed on the map layer, so no text
  // labels here — tier reads from marker size/ring).
  const SETTLEMENT_STYLE = {
    capital: { radius: 3, weight: 1, fillColor: "#f59e0b" },
    city: { radius: 2, weight: 1, fillColor: "#f59e0b" },
    town: { radius: 1.25, weight: 1, fillColor: "#a8a29e" },
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showMarkers) return;
    const grp = L.layerGroup();
    const { W, H } = mapSize;
    const placed = placesRef.current.filter((q) => q.x != null && q.y != null);
    // Nearest placed neighbour per settlement (flat-map km — Urth is flat,
    // so no spherical cos(φ) narrowing is applied).
    const nearestOf = (p) => {
      let best = null;
      for (const q of placed) {
        if (q.name === p.name) continue;
        const dPx = Math.hypot(q.x - p.x, q.y - p.y);
        if (!best || dPx < best.dPx) best = { name: q.name, dPx };
      }
      return best
        ? `${best.name} · ${(best.dPx * KM_PER_PX).toLocaleString(void 0, { maximumFractionDigits: 0 })} km`
        : null;
    };
    const keys = [];
    placesRef.current.forEach((p) => {
      if (p.kind === "nation" || p.x == null || p.y == null) return;
      const latlng = [p.y, p.x];
      placeLatLngRef.current[p.name] = latlng;
      const popup = buildPlacePopup(p, W, H, nearestOf(p));
      const st = SETTLEMENT_STYLE[p.kind] ?? SETTLEMENT_STYLE.city;
      const mk = L.circleMarker(latlng, {
        radius: st.radius,
        color: "#ffffff",
        weight: st.weight,
        fillColor: st.fillColor,
        fillOpacity: 0.95,
      }).addTo(grp);
      mk.bindPopup(popup);
      mk.on("click", (e) => L.DomEvent.stopPropagation(e));
      placeMarkersRef.current[p.name] = mk;
      keys.push(p.name);
    });
    grp.addTo(map);
    return () => {
      grp.remove();
      forgetKeys(keys);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMarkers, mapSize, places]);

  // Nation-text visibility follows zoom via CSS (no layer rebuild).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hide = (zoomLevel ?? 0) < NORMAL_MIN_ZOOM;
    map.getContainer().classList.toggle("urth-hide-nations", hide);
  }, [zoomLevel]);

  // ---- Live wiki enrichment for popups (flag + summary) ----------------------
  // Fetched lazily on popup open, cached (memory + week-long localStorage).
  // The static card stays untouched as fallback when offline or when the
  // wiki page has no extract.
  const wikiToken = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const escHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    const renderSlot = (slot, v) => {
      const text = v.extract ? shortExtract(v.extract) : "";
      if (!text && !v.thumb) {
        slot.hidden = true;
        return;
      }
      slot.hidden = false;
      slot.innerHTML =
        (v.thumb
          ? `<img class="atlas-popup-flag" src="${escHtml(v.thumb)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" />`
          : "") + (text ? `<p class="atlas-popup-summary">${escHtml(text)}</p>` : "");
    };
    const onWikiPopup = (e) => {
      const root = e.popup?.getElement?.()?.querySelector?.(".atlas-popup[data-wiki]");
      if (!root) return;
      const slot = root.querySelector(".atlas-popup-wiki");
      if (!slot) return;
      const title = root.dataset.wiki;
      if (!title) return;
      const token = ++wikiToken.current;
      const hit = peekWikiSummary(title);
      if (hit) {
        renderSlot(slot, hit);
        return;
      }
      slot.hidden = false;
      slot.innerHTML = `<div class="atlas-popup-wiki-loading">Loading from TEPwiki…</div>`;
      fetchWikiSummary(title)
        .then((v) => {
          if (token === wikiToken.current && slot.isConnected) renderSlot(slot, v);
        })
        .catch(() => {
          slot.hidden = true;
        });
    };
    map.on("popupopen", onWikiPopup);
    return () => {
      map.off("popupopen", onWikiPopup);
    };
  }, []);

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
  // Blurred-preview backdrop: tiny (~20-30KB) preloaded image paints instantly
  // so there's never a grey void while the full-res tiles load or swap.
  const preview =
    `${import.meta.env.BASE_URL}` +
    (layer === "satellite" ? "preview-satellite.webp" : "preview-political.webp");

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className="absolute inset-0 urth-map-grab"
        style={{
          background: `#e5e3df url(${preview}) center / cover no-repeat`,
        }}
      />
      {status === "loading" && (
        <div className="absolute inset-0 z-[900] flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 rounded-lg shadow-xl border border-[#e5e7eb] px-6 py-4 text-center">
            <div className="w-7 h-7 border-[3px] border-[#0e7490] border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <div className="text-[12px] font-semibold tracking-wide uppercase text-zinc-600">
              Loading {activeLayer.label}
            </div>
              <div className="text-[11px] text-zinc-400 font-mono mt-1">
                {IS_LOW_MEM ? "Fetching mobile world map" : "Fetching full-resolution world map"}
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
      {activeLayer.stale && status !== "loading" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[950] pointer-events-none">
          <div className="bg-amber-50/95 border border-amber-200 text-amber-800 text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
            {activeLayer.label} data may be out of date
          </div>
        </div>
      )}
      {showScale && scaleBar && status !== "loading" && (
        <ScaleBarReadout bar={scaleBar} />
      )}
      {cylinder && status !== "loading" && (
        <>
          <CylinderView
            imageUrl={cylImg}
            cx={cylCx}
            W={mapSize?.W}
            onRotateWorld={(cx) => setCylCx(wrapX(cx, mapSize?.W ?? 1))}
            onWheelZoom={(dir) => {
              const map = mapRef.current;
              if (map) (dir > 0 ? map.zoomIn() : map.zoomOut());
            }}
          />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[700] pointer-events-none select-none">
            <div className="bg-[#0e7490]/90 text-white text-[11px] font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full shadow-lg backdrop-blur">
              ◍ Cylinder mode — drag to rotate
            </div>
          </div>
        </>
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
    <div className="absolute bottom-12 left-3 z-[700] pointer-events-none select-none">
      <div className="bg-white rounded-md border border-[#d1d5db] shadow-[0_1px_3px_rgba(0,0,0,0.1)] px-2.5 py-1.5">
        <div
          className="h-[6px] border-x border-b border-[#111827] bg-white/70"
          style={{ width }}
        />
        <div className="text-[10px] font-semibold text-[#111827] mt-0.5 font-mono">
          {value < 1 ? `${value} km` : `${value.toLocaleString()} km`}
          <span className="text-zinc-400"> • </span>
          {mi < 1 ? `${mi.toFixed(2)} mi` : `${mi.toLocaleString(void 0, { maximumFractionDigits: mi < 10 ? 1 : 0 })} mi`}
        </div>
        <div className="text-[9px] text-zinc-400 font-mono mt-0.5">
          zoom {zoom.toFixed(2)}
        </div>
      </div>
    </div>
  );
}