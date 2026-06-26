"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudioStore } from "@/store/useStudioStore";
import { processPlantImage } from "@/lib/plantImage";
import { PLANT_CATEGORIES } from "@/data/plants";
import { Btn } from "./primitives";
import type { Difficulty, PlantCategory, PlantForm } from "@/lib/types";

// Add / edit your own plant: pick a photo (background removed by the in-browser
// AI), fill in name / category / leaf form / default height / color, then it
// becomes a real species in the browser, armed for painting. Passing `editId`
// loads that custom plant for editing instead of creating a new one.

const FORMS: { id: PlantForm; label: string }[] = [
  { id: "broadleaf", label: "Broadleaf" },
  { id: "stem", label: "Stem" },
  { id: "blade", label: "Blade" },
  { id: "rosette", label: "Rosette" },
  { id: "moss", label: "Moss" },
  { id: "floating", label: "Floating" },
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const fieldCls =
  "w-full rounded-md border border-mist/20 bg-[#0c1013] px-2 py-1.5 text-xs text-mist outline-none focus:border-moss";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-stone">{label}</span>
      {children}
    </label>
  );
}

export function AddPlantModal({
  open,
  editId,
  onClose,
}: {
  open: boolean;
  editId?: string | null;
  onClose: () => void;
}) {
  const addCustomPlant = useStudioStore((s) => s.addCustomPlant);
  const updateCustomPlant = useStudioStore((s) => s.updateCustomPlant);
  const setPlantTexture = useStudioStore((s) => s.setPlantTexture);
  const setActivePlant = useStudioStore((s) => s.setActivePlant);
  const editing = useStudioStore((s) =>
    editId ? s.customPlants.find((p) => p.id === editId) : undefined,
  );
  const editingTex = useStudioStore((s) =>
    editId ? s.customPlantTextures[editId] : undefined,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [name, setName] = useState("");
  const [latin, setLatin] = useState("");
  const [category, setCategory] = useState<PlantCategory>("midground");
  const [form, setForm] = useState<PlantForm>("broadleaf");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [hMin, setHMin] = useState(6);
  const [hMax, setHMax] = useState(18);
  const [color, setColor] = useState("#4f9a3f");

  // (Re)load the form each time the modal opens — blank for new, prefilled for edit.
  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setProgress(0);
    if (editing) {
      setImg(editingTex ?? null);
      setName(editing.name);
      setLatin(editing.latin ?? "");
      setCategory(editing.category);
      setForm(editing.form);
      setDifficulty(editing.difficulty);
      setHMin(editing.heightCm[0]);
      setHMax(editing.heightCm[1]);
      setColor(editing.color);
    } else {
      setImg(null);
      setName("");
      setLatin("");
      setCategory("midground");
      setForm("broadleaf");
      setDifficulty("easy");
      setHMin(6);
      setHMax(18);
      setColor("#4f9a3f");
    }
    // editing identity is keyed by editId; deps intentionally minimal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

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

  function save() {
    if (!img) {
      alert("Pick a photo first 🙂");
      return;
    }
    const lo = Math.max(1, Math.min(hMin, hMax));
    const hi = Math.max(lo, hMax);
    const fields = {
      name: name.trim() || "My Plant",
      latin: latin.trim() || undefined,
      category,
      form,
      difficulty,
      heightCm: [lo, hi] as [number, number],
      color,
    };
    if (editId) {
      updateCustomPlant(editId, fields);
      if (img !== editingTex) setPlantTexture(editId, img);
      setActivePlant(editId);
    } else {
      const id = addCustomPlant(fields);
      setPlantTexture(id, img);
      setActivePlant(id);
    }
    onClose();
  }

  // Portal to <body> so the fixed overlay escapes the blurred panel's containing
  // block (backdrop-filter traps position:fixed in Chrome) and fills the viewport.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-sumi/75 p-4 backdrop-blur-sm">
      <div className="w-[420px] max-w-full rounded-xl border border-mist/10 bg-soil/95 p-5 text-mist shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base text-moss">
            {editId ? "Edit plant" : "Add your own plant"}
          </h2>
          <button onClick={onClose} className="text-stone hover:text-mist" title="Close">
            ✕
          </button>
        </div>

        <div className="flex gap-4">
          {/* photo / cutout preview — large so the plant reads clearly */}
          <div className="flex w-36 shrink-0 flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="relative grid h-36 w-36 place-items-center overflow-hidden rounded-lg border border-dashed border-mist/30 text-center text-[11px] text-stone/70 hover:border-moss/60"
              style={{
                backgroundColor: "#0c1013",
                backgroundImage:
                  "linear-gradient(45deg,#1a2026 25%,transparent 25%),linear-gradient(-45deg,#1a2026 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a2026 75%),linear-gradient(-45deg,transparent 75%,#1a2026 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }}
            >
              {busy ? (
                <span className="flex flex-col items-center gap-1.5 text-moss">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-moss border-t-transparent" />
                  {Math.round(progress * 100)}%
                </span>
              ) : img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-full w-full object-contain p-1.5" />
              ) : (
                <span className="px-3">
                  ＋ Click to add photo
                  <br />
                  <span className="text-stone/50">(background removed)</span>
                </span>
              )}
            </button>
            {img && !busy && (
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[10px] text-stone hover:text-moss"
              >
                ↺ Replace photo
              </button>
            )}
          </div>

          {/* fields */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Red Tiger Lotus"
                className={`${fieldCls} placeholder:text-stone/40`}
              />
            </Field>

            <Field label="Scientific name (optional)">
              <input
                value={latin}
                onChange={(e) => setLatin(e.target.value)}
                placeholder="e.g. Nymphaea lotus"
                className={`${fieldCls} placeholder:text-stone/40 italic`}
              />
            </Field>

            <div className="flex gap-2">
              <Field label="Category">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PlantCategory)}
                  style={{ colorScheme: "dark" }}
                  className={fieldCls}
                >
                  {PLANT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Leaf form">
                <select
                  value={form}
                  onChange={(e) => setForm(e.target.value as PlantForm)}
                  style={{ colorScheme: "dark" }}
                  className={fieldCls}
                >
                  {FORMS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Difficulty">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                style={{ colorScheme: "dark" }}
                className={fieldCls}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* height + color span full width below */}
        <div className="mt-3 flex items-end gap-4">
          <Field label="Default height (cm)">
            <div className="flex items-center gap-2 text-xs text-mist">
              <input
                type="number"
                min={1}
                max={120}
                value={hMin}
                onChange={(e) => setHMin(Number(e.target.value))}
                style={{ colorScheme: "dark" }}
                className="w-16 rounded-md border border-mist/20 bg-[#0c1013] px-2 py-1.5 text-xs tabular-nums text-mist outline-none focus:border-moss"
              />
              <span className="text-stone">to</span>
              <input
                type="number"
                min={1}
                max={120}
                value={hMax}
                onChange={(e) => setHMax(Number(e.target.value))}
                style={{ colorScheme: "dark" }}
                className="w-16 rounded-md border border-mist/20 bg-[#0c1013] px-2 py-1.5 text-xs tabular-nums text-mist outline-none focus:border-moss"
              />
            </div>
          </Field>
          <Field label="Tint">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Fallback tint before the photo loads"
              className="h-9 w-12 cursor-pointer rounded-md border border-mist/20 bg-transparent"
            />
          </Field>
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

        <div className="mt-5 flex items-center gap-2">
          <p className="text-[10px] leading-snug text-stone/70">
            Height controls how tall it scales in the tank.
          </p>
          <Btn onClick={onClose} className="ml-auto">
            Cancel
          </Btn>
          <button
            onClick={save}
            disabled={!img || busy}
            className="rounded-md bg-moss px-4 py-1.5 text-xs font-medium text-sumi transition-colors hover:bg-moss-bright disabled:opacity-40"
          >
            {editId ? "Save changes" : "Add plant →"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
