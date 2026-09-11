import { IconCheck } from "./icons";

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none">
      <div className="bg-zinc-900 text-white text-[12px] font-medium px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-[toastIn_.18s_ease-out]">
        <IconCheck width={14} height={14} className="text-emerald-400" />
        {toast.message}
      </div>
    </div>
  );
}