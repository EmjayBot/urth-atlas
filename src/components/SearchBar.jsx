import { useMemo, useRef, useState, useEffect } from "react";
import { searchPlaces } from "../lib/places";
import { IconSearch, IconArrow } from "./icons";

export default function SearchBar({ query, setQuery, onPlace, places }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const matches = useMemo(() => searchPlaces(places, query, 8), [places, query]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (raw) => {
    const text = (raw ?? query).trim();
    if (!text) return;
    const place = searchPlaces(places, text, 1)[0];
    if (place) {
      onPlace(place);
      setOpen(false);
      return;
    }
    const parts = text.split(/[\s,]+/).map((s) => parseFloat(s));
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      onPlace({ kind: "coord", a: parts[0], b: parts[1] });
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative w-[440px] max-w-[42vw] min-w-0 shrink">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <IconSearch width={16} height={16} />
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search Urth Atlas"
          spellCheck={false}
          className="w-full h-[38px] pl-9 pr-10 rounded-md bg-white border border-[#d1d5db] text-[14px] text-[#111827] placeholder:text-zinc-400 outline-none transition-all focus:border-[#0e7490] focus:shadow-[0_0_0_3px_#e6f4f1]"
        />
        <button
          type="submit"
          title="Search"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:bg-[#f3f4f6] hover:text-[#0e7490] transition-colors"
        >
          <IconArrow width={15} height={15} />
        </button>
      </form>

      {open && query.trim() && (
        <div className="absolute top-[44px] left-0 right-0 bg-white rounded-md shadow-[0_6px_24px_rgba(0,0,0,0.14)] border border-[#e5e7eb] overflow-hidden z-[1100]">
          {matches.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-zinc-500">
              No matches. Enter <span className="font-mono">lat, lng</span> or
              pixel <span className="font-mono">x, y</span>.
            </div>
          )}
          {matches.map((p) => {
            const isCity = p.kind === "city";
            return (
              <button
                key={p.name}
                onClick={() => {
                  onPlace(p);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#e6f4f1] text-left transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isCity ? "bg-amber-500" : "bg-[#0e7490]"}`}
                />
                <span className="text-[13px] font-medium text-zinc-800 truncate">
                  {p.name}
                </span>
                <span className="ml-auto text-[9px] uppercase tracking-wide text-zinc-400 font-semibold shrink-0">
                  {isCity ? "city" : "nation"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}