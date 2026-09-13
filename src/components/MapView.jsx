import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  FALLBACK_W,
  FALLBACK_H,
  KM_PER_PX,
  MI_PER_KM,
  getLayer,
} from "../lib/scale";
import { wrapX, wrapY, latFromPixel } from "../lib/geo";
import { loadLayer, makeFallbackGrid, makeCloudTexture } from "../lib/imageCache";
import { fullWikiUrl } from "../lib/wiki";
import CylinderView from "./CylinderView";

const PICK_COLOR = "#0e7490";
// Stability: 5 world copies (i in -2..2) is enough to fill ultra-wide screens
// at max zoom-out. The old 21 copies of 11232x7525 images (~7GB decoded)
// caused major jank / OOMs. Overlays reuse the same window.
const WORLD_COPIES = 5;
const HALF_COPIES = 2;

// Zoom levels: -3 = "all the way out" (whole flat map fits the screen).
// Beyond -3 is the easter egg: keep zooming and the repeating map reads as a
// cylinder wrapping around.
const NORMAL_MIN_ZOOM = -3;
const CYLINDER_ZOOM = -3.5;
const ABSOLUTE_MIN_ZOOM = -7;
// Google-Earth style: clouds only read as real at whole-world zooms.
// Shown at or beyond CLOUD_MAX_ZOOM, never once zoomed in or in cylinder.
const CLOUD_MAX_ZOOM = -2;

function useRefLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function lngFromX(x, W) {
  return (x / W - 0.5) * 360;
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
  showClouds,
  showMarkers,
  onContextMenu,
  cloudOpacity = 58,
  cloudDensity = "normal",
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

  const initialViewRef = useRef(initialView);
  useEffect(() => {
    initialViewRef.current = initialView;
  }, [initialView]);

  const rafRef = useRef(0);

  const applyOpacity = () => {
    imagesRef.current.forEach((ov) => ov.setOpacity(opacity / 100));
  };

  // ---- Map creation -------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: ABSOLUTE_MIN_ZOOM,
      maxZoom: 6,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      inertia: true,
      inertiaDeceleration: 3000,
      inertiaMaxSpeed: 2200,
      doubleClickZoom: false,
      attributionControl: false,
      preferCanvas: true,
      zoomAnimation: true,
      fadeAnimation: true,
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

    const def = getLayer(layerRef.current);
    loadLayer(def)
      .then(({ url, w, h }) => finishLoad(url, w, h, "ok"))
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
        onCursorRef.current(payload);
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

    return () => {
      canceled = true;
      container.removeEventListener("contextmenu", onContextMenu, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      imagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Cylinder easter egg (hides the flat Leaflet map) -----------------------
  const cylinder = zoomLevel !== null && zoomLevel <= CYLINDER_ZOOM;
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
      imagesRef.current.forEach((ov) => ov.setOpacity(opacity / 100));
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
      // 15° graticule as vectors (canvas-rendered) — far cheaper than the old
      // 11232x7525 grid.png image decoded 5x (~340MB). Same look, ~190 lines.
      const stepX = W / 24;
      const stepY = H / 12;
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        for (let x = 0; x <= W; x += stepX) {
          L.polyline(
            [
              [0, x + i * W],
              [H, x + i * W],
            ],
            { color: "#64748b", weight: 1, opacity: 0.28, interactive: false }
          ).addTo(grp);
        }
        for (let y = 0; y <= H; y += stepY) {
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

  // ---- Cloud layer (satellite view only) --------------------------------------
  // Two depth-stacked sheets: a soft base deck + a faint fast cirrus wisp
  // layer for parallax. GPU transform drift (no layout thrash), textures
  // memoised in imageCache. Density presets map to FBM coverage.
  // Google-Earth style gating: only at whole-world zooms (CLOUD_MAX_ZOOM and
  // out, above cylinder mode). Textures generate off the critical path
  // (idle-deferred) and stay cached, so zooming back out is instant.
  const cloudsAllowed =
    layer === "satellite" &&
    showClouds &&
    zoomLevel !== null &&
    zoomLevel <= CLOUD_MAX_ZOOM &&
    zoomLevel > CYLINDER_ZOOM;
  const [cloudUrls, setCloudUrls] = useState(null);
  useEffect(() => {
    if (layer !== "satellite" || !showClouds) {
      setCloudUrls(null);
      return;
    }
    // Keep the cache while zoomed in / in cylinder so returning is instant.
    if (!cloudsAllowed) return;
    const cov =
      cloudDensity === "light" ? 0.44 : cloudDensity === "stormy" ? 0.6 : 0.54;
    if (cloudUrls && cloudUrls.cov === cov) return;
    let canceled = false;
    const gen = () => {
      if (canceled) return;
      const base = makeCloudTexture(2048, 1024, { coverage: cov, seed: 20260913 });
      if (canceled) return;
      // Yield between the two heavy passes so pan/zoom stays smooth.
      setTimeout(() => {
        if (canceled) return;
        const wisp = makeCloudTexture(2048, 1024, {
          coverage: Math.max(0.3, cov - 0.1),
          softness: 0.24,
          seed: 770213,
          alpha: 150,
        });
        if (!canceled) setCloudUrls({ base, wisp, cov });
      }, 30);
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(gen, { timeout: 1500 });
      return () => {
        canceled = true;
        cancelIdleCallback(id);
      };
    }
    const t = setTimeout(gen, 600);
    return () => {
      canceled = true;
      clearTimeout(t);
    };
  }, [layer, showClouds, cloudDensity, cloudsAllowed, cloudUrls]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !cloudsAllowed || !cloudUrls) return;
    const grp = L.layerGroup({ interactive: false });
    const { W, H } = mapSize;
    const { base: baseUrl, wisp: wispUrl } = cloudUrls;
    const baseOpacity = (cloudOpacity ?? 58) / 100;
    const overlays = [];
    for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
      const bounds = [
        [0, i * W],
        [H, (i + 1) * W],
      ];
      const ov = L.imageOverlay(baseUrl, bounds, {
        opacity: baseOpacity,
        interactive: false,
        bubblingMouseEvents: false,
        className: "urth-cloud-sheet",
        zIndex: 3,
      });
      overlays.push({ ov, cls: "urth-cloud" });
      grp.addLayer(ov);
      const wisp = L.imageOverlay(wispUrl, bounds, {
        opacity: Math.min(1, baseOpacity * 0.55),
        interactive: false,
        bubblingMouseEvents: false,
        className: "urth-cloud-sheet",
        zIndex: 4,
      });
      overlays.push({ ov: wisp, cls: "urth-cloud-wisp" });
      grp.addLayer(wisp);
    }
    grp.addTo(map);
    // Bring clouds above the base tiles but below markers/popups.
    grp.getLayers().forEach((l) => {
      const el = l.getElement?.();
      if (el) {
        el.style.pointerEvents = "none";
      }
    });
    overlays.forEach(({ ov, cls }) => {
      const el = ov.getElement();
      if (el) {
        el.classList.add(cls);
        el.draggable = false;
      }
    });
    return () => {
      grp.remove();
    };
  }, [cloudsAllowed, cloudOpacity, cloudUrls, mapSize]);

  // ---- City & subnational markers overlay (idle-deferred) ----------------------
  // Not needed for first paint — mounts after idle so the base map gets
  // bandwidth + decode time first. Served as PNG (source of truth) since the
  // fine text/lines showed softness complaints under WebP in some browsers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showMarkers) return;
    let canceled = false;
    let grp = null;
    const mount = (url) => {
      if (canceled || grp) return;
      const { W, H } = mapSize;
      grp = L.layerGroup();
      for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
        L.imageOverlay(
          url,
          [
            [0, i * W],
            [H, (i + 1) * W],
          ],
          { interactive: false, bubblingMouseEvents: false, zIndex: 5 }
        ).addTo(grp);
      }
      grp.addTo(map);
      grp.getLayers().forEach((l) => {
        const el = l.getElement?.();
        if (el) {
          el.decoding = "async";
          el.draggable = false;
        }
      });
    };
    const start = () => {
      if (canceled) return;
      const png = `${import.meta.env.BASE_URL}cities-subnational-markers.png`;
      loadLayer({ url: png, fallbackUrl: png })
        .then(({ url }) => mount(url))
        .catch(() => mount(png));
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(start, { timeout: 2000 });
      return () => {
        canceled = true;
        cancelIdleCallback(id);
        if (grp) grp.remove();
      };
    }
    const t = setTimeout(start, 800);
    return () => {
      canceled = true;
      clearTimeout(t);
      if (grp) grp.remove();
    };
  }, [showMarkers, mapSize]);

  // ---- Coordinate labels ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showCoords) return;
    const grp = L.layerGroup();
    const { W, H } = mapSize;
    const STEP = 2048;
    for (let i = -2; i <= 2; i++) {
      for (let x = 0; x <= W; x += STEP) {
        for (let y = 0; y <= H; y += STEP) {
          const px = i * W + x;
          const lat = latFromPixel(y, H);
          const lng = lngFromX(px, W);
          const icon = L.divIcon({
            className: "urth-coord-label",
            html: `${lat.toFixed(1)}°, ${lng.toFixed(1)}°`,
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
    if (focus.type === "nation" || focus.type === "city") {
      const ll = placeLatLngRef.current?.[focus.name];
      if (ll) {
        map.setView(ll, -0.25);
        const mk = placeMarkersRef.current?.[focus.name];
        if (mk) mk.openPopup();
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
  // Built once per places/mapSize (NOT per zoom — zoom only toggles a CSS
  // class, so zoom gestures don't rebuild markers). Labels repeat per world
  // copy so they survive horizontal wrapping. Text labels stay visible down
  // to the full-world zoom (NORMAL_MIN_ZOOM), not just zoom >= 0.
  const placeMarkersRef = useRef({});
  const placeLatLngRef = useRef({});
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSize?.W || !showNations) return;
    const grp = L.layerGroup();
    placeMarkersRef.current = {};
    placeLatLngRef.current = {};
    const pls = placesRef.current;
    const { W } = mapSize;
    pls.forEach((p) => {
      if (p.x == null || p.y == null) return;
      const latlng = [p.y, p.x];
      placeLatLngRef.current[p.name] = latlng;
      const href = p.href ? fullWikiUrl(p.href) : null;
      const popup =
        `<div class="atlas-popup"><div class="atlas-popup-title">${p.name}</div>` +
        `<div class="atlas-popup-coords">${latlng[0].toFixed(0)}, ${latlng[1].toFixed(0)} px · ${p.kind === "city" ? "city" : "nation"}</div>` +
        (href
          ? `<a class="atlas-popup-link" href="${href}" target="_blank" rel="noopener noreferrer">Open on TEPwiki ↗</a>`
          : `<div class="atlas-popup-missing">No TEPwiki page linked</div>`);
      if (p.kind === "city") {
        const mk = L.circleMarker(latlng, {
          radius: 3,
          color: "#ffffff",
          weight: 1.5,
          fillColor: "#f59e0b",
          fillOpacity: 0.95,
        }).addTo(grp);
        mk.bindTooltip(p.name, {
          direction: "top",
          offset: [0, -5],
          className: "atlas-tooltip",
        });
        mk.bindPopup(popup);
        mk.on("click", (e) => L.DomEvent.stopPropagation(e));
        placeMarkersRef.current[p.name] = mk;
      } else {
        // One label per world copy so wrapping never loses them.
        for (let i = -HALF_COPIES; i <= HALF_COPIES; i++) {
          const icon = L.divIcon({
            className: "urth-nation-text",
            html: `<span class="urth-nation-text-name">${p.name}</span>`,
            iconSize: null,
          });
          const mk = L.marker([p.y, p.x + i * W], { icon, riseOnHover: true }).addTo(grp);
          mk.bindPopup(popup);
          mk.on("click", (e) => L.DomEvent.stopPropagation(e));
          if (i === 0) placeMarkersRef.current[p.name] = mk;
        }
      }
    });
    grp.addTo(map);
    return () => {
      grp.remove();
      placeMarkersRef.current = {};
      placeLatLngRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNations, mapSize, places]);

  // Nation-text visibility follows zoom via CSS (no layer rebuild).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hide = (zoomLevel ?? 0) < NORMAL_MIN_ZOOM;
    map.getContainer().classList.toggle("urth-hide-nations", hide);
  }, [zoomLevel]);

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