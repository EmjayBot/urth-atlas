// Deep-linkable URL state: view center, zoom, active tool, measurement points,
// layer visibility, and base layer. Everything is in image-pixel coordinates.

import { getLayer } from "./scale";

export function parseUrl() {
  const q = new URLSearchParams(window.location.search);
  const out = {};

  const at = q.get("at");
  if (at) {
    const [x, y] = at.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) out.at = [x, y];
  }

  const z = q.get("z");
  if (z && Number.isFinite(Number(z))) out.z = Number(z);

  if (q.get("nations") === "1") out.nations = true;

  const layer = q.get("layer");
  if (layer && getLayer(layer).id === layer) out.layer = layer;

  return out;
}

export function writeUrl(state, { replace = true } = {}) {
  const q = new URLSearchParams();
  if (state.at) q.set("at", `${state.at[0].toFixed(1)},${state.at[1].toFixed(1)}`);
  if (state.z != null) q.set("z", String(state.z));
  if (state.mode) q.set("mode", state.mode);
  if (state.pts?.length)
    q.set(
      "pts",
      state.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("|")
    );
  if (state.nations) q.set("nations", "1");
  if (state.layer && state.layer !== "map") q.set("layer", state.layer);
  const qs = q.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  return `${window.location.origin}${url}`;
}

// Build a share link encoding a full measurement session.
export function shareLink(state) {
  return writeUrl(state, { replace: false });
}