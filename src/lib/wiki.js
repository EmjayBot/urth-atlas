import { WIKI_URL } from "./scale";

export function fullWikiUrl(href) {
  if (/^https?:\/\//.test(href)) return href;
  return `${WIKI_URL}${href}`;
}

export function normalize(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function searchNations(nations, query, limit = 6) {
  const q = normalize(query.trim());
  if (!q) return [];
  return nations
    .filter((n) => normalize(n.name).includes(q))
    .slice(0, limit);
}

// ---- Live summaries + flags from the TEPwiki API ---------------------------
// Lazy per-popup fetch (extract intro + thumbnail), cached in memory and
// localStorage for a week. `origin=*` makes browser calls CORS-safe.
// Redirects (e.g. Hoopland) resolve server-side; missing/empty pages throw
// so callers fall back to the static card.
const WIKI_API = "https://tep.wiki/w/api.php";
const WIKI_LS_KEY = "urth-atlas.wiki.v1";
const WIKI_TTL = 7 * 864e5;
const wikiMem = new Map();

function readWikiLs() {
  try {
    return JSON.parse(localStorage.getItem(WIKI_LS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function wikiTitleFor(place) {
  if (place?.href) {
    const m = place.href.match(/\/wiki\/(.+?)(?:[#?].*)?$/);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  return (place?.name ?? "").trim().replace(/ /g, "_");
}

export function peekWikiSummary(title) {
  if (!title) return null;
  if (wikiMem.has(title)) return wikiMem.get(title);
  const ls = readWikiLs()[title];
  if (ls && Date.now() - ls.t < WIKI_TTL) {
    wikiMem.set(title, ls.v);
    return ls.v;
  }
  return null;
}

export async function fetchWikiSummary(title) {
  const hit = peekWikiSummary(title);
  if (hit) return hit;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "extracts|pageimages",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail",
    pithumbsize: "400",
    origin: "*",
    titles: title,
  });
  const r = await fetch(`${WIKI_API}?${params.toString()}`);
  if (!r.ok) throw new Error(`wiki HTTP ${r.status}`);
  const j = await r.json();
  const page = j?.query?.pages?.[0];
  if (!page || page.missing) throw new Error("wiki page missing");
  const extract = (page.extract || "").trim();
  if (!extract && !page.thumbnail?.source) throw new Error("wiki page empty");
  const v = {
    title: page.title,
    extract: extract || null,
    thumb: page.thumbnail?.source || null,
  };
  wikiMem.set(title, v);
  try {
    const all = readWikiLs();
    all[title] = { t: Date.now(), v };
    const keys = Object.keys(all);
    // Bound the cache (~80 entries).
    if (keys.length > 80) delete all[keys[0]];
    localStorage.setItem(WIKI_LS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
  return v;
}

// Trim an extract to ~2 sentences / max chars for popup display.
export function shortExtract(extract, max = 220) {
  const clean = (extract || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`);
}