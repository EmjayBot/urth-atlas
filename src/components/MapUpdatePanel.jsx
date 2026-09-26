import { useRef, useState } from "react";
import {
  REPO_OWNER,
  REPO_NAME,
  createBlobFromFile,
  commitFiles,
  createBranch,
  getBaseTreeSha,
  getMainSha,
  openPullRequest,
} from "../lib/github";

// Upload slots: local files only. Remote CDN overlays (topo/climate/…)
// update themselves upstream and are intentionally not listed.
const SLOTS = [
  {
    id: "map",
    label: "Political base",
    path: "public/blank-political.webp",
    accept: ".webp,image/webp",
    mobile: { path: "public/blank-political-mobile.webp", width: 4096 },
    need: "11232×7525 webp",
  },
  {
    id: "satellite",
    label: "Satellite base",
    path: "public/satellite.webp",
    accept: ".webp,image/webp",
    mobile: null, // desktop-only layer, no mobile variant exists
    need: "11232×7525 webp",
  },
  {
    id: "timezones",
    label: "Time Zones overlay",
    path: "public/timezones.webp",
    accept: ".webp,image/webp",
    mobile: { path: "public/timezones-mobile.webp", width: 3072 },
    need: "11232×7525 webp (already cropped — raw 11860-wide exports are rejected)",
  },
  {
    id: "cities",
    label: "Cities overlay",
    path: "public/cities.png",
    accept: ".png,image/png",
    mobile: { path: "public/cities-mobile.webp", width: 3072 },
    need: "11232×7525 png with transparency",
  },
  {
    id: "subnational",
    label: "Subnational overlay",
    path: "public/subnational.png",
    accept: ".png,image/png",
    mobile: { path: "public/subnational-mobile.webp", width: 3072 },
    need: "11232×7525 png with transparency",
  },
];

const FULL_W = 11232;
const FULL_H = 7525;

function downscaleToWebp(bitmap, width, quality = 0.85) {
  const height = Math.round((bitmap.height / bitmap.width) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve({ blob: b, width, height }) : reject(new Error("webp encode failed"))),
      "image/webp",
      quality
    )
  );
}

export default function MapUpdatePanel() {
  const [slotId, setSlotId] = useState("map");
  const [file, setFile] = useState(null);
  const [dims, setDims] = useState(null);
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const inputRef = useRef(null);

  const slot = SLOTS.find((s) => s.id === slotId);

  const resetFile = () => {
    setFile(null);
    setDims(null);
    setMobile(null);
    setError("");
    setPrUrl("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  };

  const onPick = async (f) => {
    resetFile();
    if (!f) return;
    try {
      const bitmap = await createImageBitmap(f);
      const w = bitmap.width;
      const h = bitmap.height;
      setDims({ w, h });
      if (w !== FULL_W || h !== FULL_H) {
        bitmap.close?.();
        setError(`Must be exactly ${FULL_W}×${FULL_H} — got ${w}×${h}.`);
        return;
      }
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      if (slot.mobile) {
        setBusy("Generating mobile variant…");
        try {
          const m = await downscaleToWebp(bitmap, slot.mobile.width);
          setMobile(m);
        } finally {
          bitmap.close?.();
          setBusy("");
        }
      } else {
        bitmap.close?.();
      }
    } catch {
      setError("Could not decode that image. Export a PNG or WebP and retry.");
    }
  };

  const canSubmit = file && dims && (slot.mobile ? mobile : true) && token.trim() && !busy && !prUrl;

  const onSubmit = async () => {
    setError("");
    setBusy("Reading repository state…");
    try {
      const t = token.trim();
      const mainSha = await getMainSha(t);
      const baseTreeSha = await getBaseTreeSha(t, mainSha);
      const stamp = new Date().toISOString().slice(0, 10);
      const branch = `map-update/${slot.id}-${stamp}`;
      setBusy("Creating review branch…");
      try {
        await createBranch(t, branch, mainSha);
      } catch (e) {
        // Branch from an earlier attempt today — reuse it.
        if (!/already exists|Reference already exists/i.test(e.message)) throw e;
      }
      setBusy("Uploading files…");
      const entries = [{ path: slot.path.replace(/^public\//, ""), sha: await createBlobFromFile(t, file) }];
      if (slot.mobile && mobile) {
        entries.push({
          path: slot.mobile.path.replace(/^public\//, ""),
          sha: await createBlobFromFile(t, mobile.blob),
        });
      }
      setBusy("Committing…");
      await commitFiles(t, {
        branch,
        message: `Map update: ${slot.label} (+ mobile variant)`,
        parentSha: mainSha,
        baseTreeSha,
        entries,
      });
      setBusy("Opening pull request…");
      const url = await openPullRequest(t, {
        branch,
        title: `Map update: ${slot.label}`,
        body: `Maintainer upload via the atlas.\n\n- \`${slot.path}\`: ${dims.w}×${dims.h}, ${(file.size / 1024).toFixed(0)} KB\n` +
          (slot.mobile && mobile
            ? `- \`${slot.mobile.path}\`: ${mobile.width}×${mobile.height} (auto-generated in-browser)\n`
            : `- No mobile variant for this layer (desktop-only).\n`) +
          `\nReview the preview build, then merge to deploy.`,
      });
      setPrUrl(url);
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="text-[11px] leading-4 text-[#6b7280] bg-[#f8fafc] border border-zinc-100 rounded-lg p-2.5">
        Upload a replacement layer file. It&apos;s validated, previewed, and
        opened as a pull request — nothing goes live until it&apos;s merged.
        Your token stays in this tab&apos;s memory only.
      </div>

      <div className="space-y-1">
        {SLOTS.map((s) => (
          <label
            key={s.id}
            className="flex items-start gap-2.5 py-1 select-none cursor-pointer group"
          >
            <input
              type="radio"
              name="update-slot"
              checked={slotId === s.id}
              onChange={() => {
                setSlotId(s.id);
                resetFile();
              }}
              className="w-4 h-4 mt-0.5 accent-[#1a6f34] cursor-pointer"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] text-[#111827] group-hover:text-[#1a6f34] transition-colors">
                {s.label}
              </span>
              <span className="text-[11px] text-[#6b7280] font-mono">{s.path} · {s.need}</span>
            </span>
          </label>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={slot.accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full h-9 rounded-md bg-white border border-[#d1d5db] text-zinc-700 text-[12px] font-semibold hover:bg-[#f9fafb] transition-colors"
      >
        {file ? "Choose a different file" : `Choose ${slot.label} file`}
      </button>

      {dims && (
        <div className="text-[11px] font-mono text-zinc-600">
          {dims.w}×{dims.h} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
          {mobile && ` · mobile ${mobile.width}×${mobile.height} ready`}
        </div>
      )}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Upload preview"
          className="w-full rounded-lg border border-[#e5e7eb]"
        />
      )}
      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
          {error}
        </div>
      )}

      {file && !error && (
        <>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="GitHub token (contents + PR write)"
            autoComplete="off"
            spellCheck={false}
            className="w-full h-9 px-3 rounded-md bg-[#f9fafb] border border-[#e5e7eb] focus:bg-white focus:border-[#1a6f34] outline-none text-[13px] font-mono placeholder:font-sans placeholder:text-zinc-400"
          />
          <div className="text-[11px] leading-4 text-[#6b7280]">
            Create one at github.com → Settings → Developer settings → Personal
            access tokens (fine-grained: Contents read+write, Pull requests
            read+write, this repo only).
          </div>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full h-9 rounded-md bg-[#1a6f34] text-white text-[12px] font-semibold disabled:opacity-40 hover:bg-[#145729] transition-colors"
          >
            {busy || "Open pull request"}
          </button>
        </>
      )}
      {prUrl && (
        <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2">
          Pull request opened —{" "}
          <a href={prUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            review it here
          </a>
          .
        </div>
      )}
    </div>
  );
}
