import { memo } from "react";
import SearchBar from "./SearchBar";
import { IconGlobe, IconMenu, IconTarget, IconRuler } from "./icons";

function Header({
  query,
  setQuery,
  onPlace,
  places,
  sidebarOpen,
  setSidebarOpen,
  onLocate,
  onMeasure,
}) {
  return (
    <header className="h-[56px] shrink-0 flex items-center gap-3 px-3 bg-white border-b border-[#e5e7eb] z-[1001] relative">
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        className="w-9 h-9 rounded-md flex items-center justify-center text-zinc-600 hover:bg-[#f3f4f6] shrink-0"
      >
        <IconMenu width={20} height={20} />
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <IconGlobe width={20} height={20} className="text-[#0e7490]" />
        <span className="urth-logo hidden sm:inline" aria-label="Urth Atlas">
          Urth Atlas
        </span>
      </div>

      <SearchBar query={query} setQuery={setQuery} onPlace={onPlace} places={places} />

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <button
          onClick={onLocate}
          title="My location"
          className="w-9 h-9 rounded-md flex items-center justify-center text-zinc-600 hover:bg-[#f3f4f6]"
        >
          <IconTarget width={18} height={18} />
        </button>
        <button
          onClick={onMeasure}
          title="Measure distance"
          className="w-9 h-9 rounded-md flex items-center justify-center text-zinc-600 hover:bg-[#f3f4f6]"
        >
          <IconRuler width={18} height={18} />
        </button>
      </div>
    </header>
  );
}

export default memo(Header);