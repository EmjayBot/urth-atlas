import { useMemo, useRef, useState, useEffect } from "react";
import nations from "../data/nations.json";
import { searchNations } from "../lib/wiki";
import { IconSearch, IconArrow } from "./icons";

export default function SearchBar({ query, setQuery, onNation, onCoord }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const matches = useMemo(() => searchNations(nations, query, 7), [query]);

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
    const q = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const nation = nations.find(
      (n) => n.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === q
    );
    if (nation) {
      onNation(nation);
      setOpen(false);
      return;
    }
    const parts = text.split(/[\s,]+/).map((s) => parseFloat(s));
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      onCoord(parts[0], parts[1]);
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-[560px] min-w-0">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <IconSearch width={17} height={17} />
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search nation or 'lat, lng' / 'x, y' pixel"
          spellCheck={false}
          className="w-full h-[42px] pl-10 pr-11 rounded-full bg-[#f1f3f4] focus:bg-white border border-transparent focus:border-zinc-200 focus:shadow-[0_1px_6px_rgba(0,0,0,0.12)] outline-none text-[14px] placeholder:text-zinc-500 transition-all"
        />
        <button
          type="submit"
          title="Search"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full bg-[#0e7490] text-white flex items-center justify-center hover:bg-[#0c6580] transition-colors"
        >
          <IconArrow width={15} height={15} />
        </button>
      </form>

      {open && query.trim() && (
        <div className="absolute top-[46px] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-[1100]">
          {matches.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-zinc-500">
              No nations match. Enter <span className="font-mono">lat, lng</span>{" "}
              or pixel <span className="font-mono">x, y</span>.
            </div>
          )}
          {matches.map((n) => (
            <button
              key={n.name}
              onClick={() => {
                onNation(n);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#f0f9fa] text-left transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${n.missing ? "bg-zinc-300" : "bg-[#0e7490]"}`}
              />
              <span className="text-[13px] font-medium text-zinc-800 truncate">
                {n.name}
              </span>
              {n.missing && (
                <span className="ml-auto text-[9px] uppercase tracking-wide text-zinc-400 font-semibold">
                  no page
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}