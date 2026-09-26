// View-only embed mode. True when the atlas is framed by another page
// (a Discourse post, docs, etc.) or explicitly requested with ?embed=1.
// Embedded visitors get pan/zoom, search, wiki popups, and the measurement
// tools, but every community/local edit path (add, remove, reposition,
// submit, maintainer) is disabled — including direct calls, so the gate
// holds even if editing UI is reached by another route.
function detectEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    // Cross-origin frame access threw — treat as embedded.
    return true;
  }
  try {
    return new URLSearchParams(window.location.search).get("embed") === "1";
  } catch {
    return false;
  }
}

export const EMBEDDED = detectEmbedded();
