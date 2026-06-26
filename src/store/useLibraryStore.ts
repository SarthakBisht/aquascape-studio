"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Layout } from "@/lib/types";

// A local gallery of saved aquascapes. Kept in its own persisted store (and its
// own localStorage key) so big thumbnails never bloat the main editor snapshot
// or the undo history. Everything is client-side — no backend, no accounts.

export interface SavedScape {
  id: string;
  name: string;
  /** Downscaled JPEG data URL (gallery tile). */
  thumb: string;
  /** Full serialized look (the v2 Layout). */
  layout: Layout;
  createdAt: number;
  updatedAt: number;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const genId = () =>
  `scape_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

interface LibraryState {
  scapes: SavedScape[];
  /** Which saved scape the editor is currently working on (so Save updates it). */
  currentId: string | null;
  /** Gallery overlay visibility (transient — not persisted). */
  galleryOpen: boolean;

  setGallery: (open: boolean) => void;
  setCurrent: (id: string | null) => void;
  /** Create a new saved scape; returns its id and makes it current. */
  createScape: (name: string, thumb: string, layout: Layout) => string;
  /** Overwrite an existing scape's look + thumbnail. */
  updateScape: (id: string, thumb: string, layout: Layout) => void;
  renameScape: (id: string, name: string) => void;
  removeScape: (id: string) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      scapes: [],
      currentId: null,
      galleryOpen: false,

      setGallery: (open) => set({ galleryOpen: open }),
      setCurrent: (id) => set({ currentId: id }),

      createScape: (name, thumb, layout) => {
        const id = genId();
        const now = Date.now();
        set((s) => ({
          scapes: [
            { id, name, thumb, layout, createdAt: now, updatedAt: now },
            ...s.scapes,
          ],
          currentId: id,
        }));
        return id;
      },
      updateScape: (id, thumb, layout) =>
        set((s) => ({
          scapes: s.scapes.map((sc) =>
            sc.id === id ? { ...sc, thumb, layout, updatedAt: Date.now() } : sc,
          ),
        })),
      renameScape: (id, name) =>
        set((s) => ({
          scapes: s.scapes.map((sc) => (sc.id === id ? { ...sc, name } : sc)),
        })),
      removeScape: (id) =>
        set((s) => ({
          scapes: s.scapes.filter((sc) => sc.id !== id),
          currentId: s.currentId === id ? null : s.currentId,
        })),
    }),
    {
      name: "aquascape-studio:library",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      // ponytail: galleryOpen is transient; thumbnails live in localStorage so a
      // few dozen scapes is the comfortable ceiling (~5 MB). Move to IndexedDB if
      // users hoard hundreds.
      partialize: (s) => ({ scapes: s.scapes, currentId: s.currentId }),
    },
  ),
);
