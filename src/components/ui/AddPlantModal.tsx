"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { processPlantImage } from "@/lib/plantImage";
import { PLANT_CATEGORIES } from "@/data/plants";
import { Btn } from "./primitives";
import type { Difficulty, PlantCategory, PlantForm } from "@/lib/types";

// Add-your-own-plant: pick a photo (background removed by the in-browser AI),
// fill in name / category / leaf form / default height / color, then it becomes
// a real species in the browser, armed for painting.

const FORMS: { id: PlantForm; label: string }[] = [
  { id: "broadleaf", label: "Broadleaf" },
  { id: "stem", label: "Stem" },
  { id: "blade", label: "Blade" },
  { id: "rosette", label: "Rosette" },
  { id: "moss", label: "Moss" },
  { id: "floating", label: "Floating" },
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const selCls =
  "rounded-md border border-mist/15 bg-mist/[0.06] px-2 py-1 text-xs text-mist outline-none focus:border-moss";

export function AddPlantModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addCustomPlant = useStudioStore((s) => s.addCustomPlant);
  const setPlantTexture = useStudioStore((s) => s.setPlantTexture);
  const setActivePlant = useStudioStore((s) => s.setActivePlant);

  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlantCategory>("midground");
  const [form, setForm] = useState<PlantForm>("broadleaf");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [hMin, setHMin] = useState(6);
  const [hMax, setHMax] = useState(18);
  const [color, setColor] = useState("#4f9a3f");

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setImg(null);
    setBusy(false);
    setProgress(0);
    setName("");
    setCategory("midground");
    setForm("broadleaf");
    setDifficulty("easy");
    setHMin(6);
    setHMax(18);
    setColor("#4f9a3f");
  }, [open]);

  if (!open) return null;

  async function handleFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    setProgress(0);
    try {
      const url = await processPlantImage(file, setProgress);
      setImg(url);
      if (!name) setName(file.name.replace(/\.[^.]+$/, "").slice(0, 32));
    } catch (e) {
      alert(`Couldn't process that image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function create() {
    if (!img) {
      alert("Pick a photo first 🙂");
      return;
    }
    const lo = Math.max(1, Math.min(hMin, hMax));
    const hi = Math.max(lo, hMax);
    const id = addCustomPlant({
      name: name.trim() || "My Plant",
      latin: "Custom",
      category,
      form,
      difficulty,
      heightCm: [lo, hi],
      color,
    });
    setPlantTexture(id, img);
    setActivePlant(id); // ready to paint
    onClose();
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-sumi/70 backdrop-blur-sm">
      <div className="w-[380px] rounded-xl border border-mist/10 bg-soil/95 p-4 text-mist shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm text-moss">Add your own plant</h2>
          <button onClick={onClose} className="text-stone hover:text-mist" title="Close">
            ✕
          </button>
        </div>

        <div className="flex gap-3">
          {/* photo / cutout preview */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-mist/25 bg-[#0c1013] text-center text-[10px] text-stone/70 hover:border-moss/50"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#1a2026 25%,transparent 25%),linear-gradient(-45deg,#1a2026 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a2026 75%),linear-gradient(-45deg,transparent 75%,#1a2026 75%)",
              backgroundSize: "14px 14px",
              backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
            }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-full w-full object-contain" />
            ) : busy ? (
              <span className="flex flex-col items-center gap-1 text-moss">
                <span className="h-4 w-4 animate-spin rounded-full border border-moss border-t-transparent" />
                {Math.round(progress * 100)}%
              </span>
            ) : (
              <span>
                ＋ photo
                <br />
                (bg removed)
              </span>
            )}
          </button>

          {/* fields */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Plant name"
              className="rounded-md border border-mist/15 bg-mist/[0.06] px-2 py-1 text-xs text-mist outline-none placeholder:text-stone/50 focus:border-moss"
            />
            <div className="flex gap-1.5">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlantCategory)}
                className={`${selCls} flex-1`}
              >
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={form}
                onChange={(e) => setForm(e.target.value as PlantForm)}
                className={`${selCls} flex-1`}
              >
                {FORMS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className={selCls}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d[0].toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-[10px] text-stone">
              <span className="shrink-0">Height</span>
              <input
                type="number"
                min={1}
                max={120}
                value={hMin}
                onChange={(e) => setHMin(Number(e.target.value))}
                className="w-14 rounded border border-mist/15 bg-mist/[0.06] px-1.5 py-1 text-xs tabular-nums text-mist outline-none focus:border-moss"
              />
              <span>–</span>
              <input
                type="number"
                min={1}
                max={120}
                value={hMax}
                onChange={(e) => setHMax(Number(e.target.value))}
                className="w-14 rounded border border-mist/15 bg-mist/[0.06] px-1.5 py-1 text-xs tabular-nums text-mist outline-none focus:border-moss"
              />
              <span>cm</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Tint (used until the photo loads)"
                className="ml-auto h-6 w-8 shrink-0 cursor-pointer rounded border border-mist/15 bg-transparent"
              />
            </div>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="mt-3 flex items-center gap-2">
          <p className="text-[10px] leading-snug text-stone/70">
            Height drives how tall the plant scales in the tank.
          </p>
          <Btn onClick={onClose} className="ml-auto">
            Cancel
          </Btn>
          <button
            onClick={create}
            disabled={!img || busy}
            className="rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi transition-colors hover:bg-moss-bright disabled:opacity-40"
          >
            Add plant →
          </button>
        </div>
      </div>
    </div>
  );
}
