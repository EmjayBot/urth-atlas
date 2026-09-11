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