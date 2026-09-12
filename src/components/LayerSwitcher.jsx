import { useEffect, useRef, useState } from "react";
import { BASE_LAYERS, getLayer } from "../lib/scale";
import { loadLayer } from "../lib/imageCache";
import { IconLayers, IconCheck } from "./icons";

function Thumb({ def, chip }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    loadLayer(def)
      .then(({ url }) => {
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [def]);
  return (
    <div className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border ${chip}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-95"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-white/30" />
      )}
    </div>
  );
}

export default function LayerSwitcher({ layer, setLayer }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const active = getLayer(layer);

  return (
    <div ref={boxRef} className="absolute bottom-3 right-3 z-[1000] flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-zinc-200 overflow-hidden w-[248px] animate-[toastIn_.16s_ease-out]">
          <div className="px-3.5 py-2.5 border-b border-zinc-100">
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-500">
              Base map
            </div>
            <div className="text-[13px] font-bold text-zinc-900">{active.label}</div>
          </div>
          <div className="p-1.5">
            {BASE_LAYERS.map((l) => {
              const isActive = l.id === layer;
              return (
                <button
                  key={l.id}
                  onClick={() => {
                    setLayer(l.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors ${
                    isActive ? "bg-[#f0f9fa]" : "hover:bg-zinc-50"
                  }`}
                >
                  <Thumb def={l} chip={l.chip} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-zinc-800 truncate">
                      {l.label}
                    </span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {l.sub}
                    </span>
                  </span>
                  {isActive && (
                    <span className="w-5 h-5 rounded-full bg-[#0e7490] text-white flex items-center justify-center shrink-0">
                      <IconCheck width={11} height={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change base map"
        className={`w-10 h-10 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.14)] border flex items-center justify-center transition-all ${
          open
            ? "bg-[#0e7490] text-white border-[#0e7490]"
            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <IconLayers width={16} height={16} />
      </button>
    </div>
  );
}