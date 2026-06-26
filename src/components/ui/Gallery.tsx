"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useLibraryStore, type SavedScape } from "@/store/useLibraryStore";
import { LiveTank } from "@/components/scene/LiveTank";
import { Showroom3D } from "@/components/scene/Showroom3D";

// Full-screen gallery of saved aquascapes — two ways to look at them:
//  • Grid     — a dark contest-style grid of photographic tiles (IAPLC / AGA).
//  • Showroom — the scapes laid out like a real aquascaping showroom: lit tanks
//               on dark cabinets in a row under hanging lamps (see the LFS /
//               Green Aqua display rooms).
// Either way, click a scape to open it in the studio; the look it was saved with
// (incl. underwater settings) is restored.

type ViewKind = "grid" | "showroom";

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Gallery() {
  const scapes = useLibraryStore((s) => s.scapes);
  const currentId = useLibraryStore((s) => s.currentId);
  const setGallery = useLibraryStore((s) => s.setGallery);
  const setCurrent = useLibraryStore((s) => s.setCurrent);
  const renameScape = useLibraryStore((s) => s.renameScape);
  const removeScape = useLibraryStore((s) => s.removeScape);
  const loadLayout = useStudioStore((s) => s.loadLayout);
  const reset = useStudioStore((s) => s.reset);

  const [view, setView] = useState<ViewKind>("grid");

  const open = (id: string) => {
    const scape = useLibraryStore.getState().scapes.find((s) => s.id === id);
    if (!scape) return;
    loadLayout(scape.layout);
    setCurrent(id);
    setGallery(false);
  };

  const startNew = () => {
    reset();
    setCurrent(null);
    setGallery(false);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col bg-sumi/95 backdrop-blur-xl">
      {/* header */}
      <header className="flex items-center gap-4 border-b border-mist/10 px-6 py-4">
        <div>
          <h1 className="font-display text-xl tracking-wide text-mist">
            Aquascape Gallery
          </h1>
          <p className="text-[11px] text-stone/80">
            {scapes.length === 0
              ? "No scapes saved yet"
              : `${scapes.length} ${scapes.length === 1 ? "scape" : "scapes"}`}
          </p>
        </div>

        {/* view toggle */}
        {scapes.length > 0 && (
          <div className="ml-2 flex overflow-hidden rounded-md border border-mist/15">
            {(["grid", "showroom"] as ViewKind[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${
                  view === v
                    ? "bg-moss text-sumi"
                    : "bg-mist/[0.04] text-mist/75 hover:bg-mist/[0.1]"
                }`}
              >
                {v === "grid" ? "▦ Grid" : "▭ Showroom"}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={startNew}
            className="rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi transition-colors hover:bg-moss-bright"
          >
            ＋ New scape
          </button>
          <button
            onClick={() => setGallery(false)}
            className="rounded-md border border-mist/15 bg-mist/[0.06] px-3 py-1.5 text-xs text-mist/85 transition-colors hover:bg-mist/[0.12]"
            aria-label="Close gallery"
          >
            ✕ Close
          </button>
        </div>
      </header>

      {scapes.length === 0 ? (
        <EmptyState onNew={startNew} />
      ) : view === "grid" ? (
        <GridView
          scapes={scapes}
          currentId={currentId}
          onOpen={open}
          onRename={renameScape}
          onRemove={removeScape}
        />
      ) : (
        <Showroom3D scapes={scapes} currentId={currentId} onOpen={open} />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="font-display text-base italic text-mist/40">
        Your gallery is empty.
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-stone/70">
        Design a scape, then press <span className="text-mist/80">Save</span> in
        the toolbar to hang it here. The tank is flooded automatically so every
        tile is an underwater shot.
      </p>
      <button
        onClick={onNew}
        className="mt-1 rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi hover:bg-moss-bright"
      >
        Start a new scape
      </button>
    </div>
  );
}

/* ---------------- Grid view ---------------- */

function GridView({
  scapes,
  currentId,
  onOpen,
  onRename,
  onRemove,
}: {
  scapes: SavedScape[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="calm-scroll flex-1 overflow-y-auto px-6 py-6">
      <ul className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {scapes.map((scape, i) => (
          <li
            key={scape.id}
            className="group relative cursor-pointer"
            onClick={() => onOpen(scape.id)}
          >
            <div
              className={`relative overflow-hidden rounded-xl border bg-soil shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.9)] ${
                scape.id === currentId
                  ? "border-moss/70 ring-1 ring-moss/40"
                  : "border-mist/10 group-hover:border-mist/25"
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                <LiveTank
                  layout={scape.layout}
                  thumb={scape.thumb}
                  alt={scape.name}
                />
              </div>

              <span className="absolute left-3 top-2 font-display text-sm tracking-wider text-mist/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {String(i + 1).padStart(2, "0")}
              </span>

              {scape.id === currentId && (
                <span className="absolute right-3 top-3 rounded-full bg-moss/90 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sumi">
                  Open
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sumi/95 via-sumi/70 to-transparent px-3.5 pb-3 pt-8">
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm text-mist">
                      {scape.name}
                    </p>
                    <p className="text-[10px] text-stone/70">
                      {fmtDate(scape.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = prompt("Rename scape", scape.name);
                        if (name) onRename(scape.id, name.trim());
                      }}
                      className="rounded bg-mist/10 px-1.5 py-1 text-[10px] text-mist/85 hover:bg-mist/20"
                      aria-label="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${scape.name}"?`))
                          onRemove(scape.id);
                      }}
                      className="rounded bg-mist/10 px-1.5 py-1 text-[10px] text-mist/85 hover:bg-red-500/70 hover:text-mist"
                      aria-label="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

