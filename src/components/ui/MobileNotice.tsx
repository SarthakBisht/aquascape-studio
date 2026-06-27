"use client";

import { useState } from "react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { Btn } from "./primitives";

// Shown only below `md` (portrait phones / very small screens). The editor is
// designed for ~768px+; here we point the user to the responsive Gallery or let
// them dismiss and at least orbit the canvas by touch. Pure CSS visibility
// (`md:hidden`) means desktop/tablet never render it.
export function MobileNotice() {
  const [dismissed, setDismissed] = useState(false);
  const setGallery = useLibraryStore((s) => s.setGallery);
  const galleryOpen = useLibraryStore((s) => s.galleryOpen);
  // Step aside while the gallery is open so it isn't covered (it's the
  // touch-friendly experience we send people to).
  if (dismissed || galleryOpen) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-sumi/95 p-6 backdrop-blur-md md:hidden">
      <div className="max-w-xs text-center">
        <span
          className="mx-auto mb-4 block h-4 w-4 rounded-full"
          style={{
            background: "radial-gradient(circle at 32% 30%, #c2a06a, #6f6a4a)",
          }}
        />
        <h1 className="font-display text-lg tracking-wide text-mist">
          Best on a larger screen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone">
          Aquascape Studio is built for designing in 3D — rotate to landscape or
          open it on a desktop. You can still browse the gallery here.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Btn active onClick={() => setGallery(true)}>
            ▦ Browse gallery
          </Btn>
          <Btn onClick={() => setDismissed(true)}>Continue anyway</Btn>
        </div>
      </div>
    </div>
  );
}
