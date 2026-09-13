import { useEffect, useRef, useState } from "react";
import { KM_PER_PX, MI_PER_KM } from "../lib/scale";
import { num } from "../lib/format";
import { IconCursor, IconRuler, IconPin } from "./icons";

export default function ContextMenu({ pos, pt, onClose, onWhat, onMeasure, onPin }) {
  const ref = useRef(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const onKey = (e) => {
    if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("wheel", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!pos) return null;

  const kmE = pt.x * KM_PER_PX;
  const miE = kmE * MI_PER_KM;

  return (
    <div
      ref={ref}
      className="fixed z-[1300] w-[180px] bg-white rounded-md shadow-[0_6px_24px_rgba(0,0,0,0.18)] border border-[#e5e7eb] overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      {adding ? (
        <div className="p-2.5 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#6b7280]">
            Add pin
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onPin(name.trim());
                setAdding(false);
                setName("");
                onClose();
              }
            }}
            placeholder="Pin name"
            spellCheck={false}
            className="w-full h-8 px-2.5 rounded-md bg-[#f9fafb] border border-[#e5e7eb] focus:bg-white focus:border-[#0e7490] outline-none text-[13px] placeholder:text-zinc-400"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onPin(name.trim());
                setAdding(false);
                setName("");
                onClose();
              }}
              disabled={!name.trim()}
              className="flex-1 h-8 rounded-md bg-[#0e7490] text-white text-[12px] font-semibold disabled:opacity-40 hover:bg-[#0c5a70] transition-colors"
            >
              Place
            </button>
            <button
              onClick={() => setAdding(false)}
              className="h-8 px-2.5 rounded-md bg-white border border-[#d1d5db] text-zinc-600 text-[12px] font-semibold hover:bg-[#f9fafb] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => onWhat()}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f3f4f6] text-left transition-colors"
          >
            <IconCursor width={14} height={14} className="text-zinc-400 shrink-0" />
            <span className="text-[12px] text-[#111827] font-medium">What's here?</span>
          </button>
          <div className="px-3 pb-1 text-[10px] font-mono text-zinc-400 leading-4 truncate">
            {pt.x.toFixed(0)}, {pt.y.toFixed(0)} px • {num(kmE, 0)} km ({num(miE, 0)} mi) E
          </div>
          <div className="h-px bg-[#e5e7eb] mx-1" />
          <button
            onClick={() => onMeasure()}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f3f4f6] text-left transition-colors"
          >
            <IconRuler width={14} height={14} className="text-zinc-400 shrink-0" />
            <span className="text-[12px] text-[#111827] font-medium">Measure distance</span>
          </button>
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f3f4f6] text-left transition-colors"
          >
            <IconPin width={14} height={14} className="text-zinc-400 shrink-0" />
            <span className="text-[12px] text-[#111827] font-medium">Add pin</span>
          </button>
        </>
      )}
    </div>
  );
}