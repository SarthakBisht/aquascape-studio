"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { IconTab } from "./primitives";
import { TankPanel } from "./TankPanel";
import { HardscapePalette } from "./HardscapePalette";
import { HardscapeEditPanel } from "./HardscapeEditPanel";
import { PlantBrowser } from "./PlantBrowser";
import { DrawPanel } from "./DrawPanel";
import { BackgroundPanel } from "./BackgroundPanel";
import { LightPanel } from "./LightPanel";
import { GradePanel } from "./GradePanel";
import { FishPanel } from "./FishPanel";

// One section visible at a time — replaces the old 7-panel scroll stack.
export type Section =
  | "tank"
  | "hardscape"
  | "plants"
  | "terrain"
  | "scene"
  | "fish";

const TABS: {
  id: Section;
  icon: string;
  label: string;
  underwaterOnly?: boolean;
}[] = [
  { id: "tank", icon: "▣", label: "Tank" },
  { id: "hardscape", icon: "▲", label: "Hardscape" },
  { id: "plants", icon: "❀", label: "Plants" },
  { id: "terrain", icon: "✎", label: "Terrain" },
  { id: "scene", icon: "☀", label: "Scene" },
  { id: "fish", icon: "❍", label: "Fish", underwaterOnly: true },
];

export function LeftRail({
  active,
  onSelect,
}: {
  active: Section;
  onSelect: (s: Section) => void;
}) {
  const mode = useStudioStore((s) => s.mode);
  // Manual show/hide of the section panel — the icon rail stays so any tab is
  // one tap away. Clicking the active tab collapses; clicking another reopens.
  const [open, setOpen] = useState(true);

  const handleTab = (id: Section) => {
    if (id === active) setOpen((o) => !o);
    else {
      onSelect(id);
      setOpen(true);
    }
  };

  return (
    <div className="pointer-events-auto flex min-h-0 gap-2">
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label="Editor sections"
        className="flex w-14 shrink-0 flex-col gap-1 self-start rounded-lg border border-line bg-soil/65 p-1.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md"
      >
        {TABS.map((t) => (
          <IconTab
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={open && active === t.id}
            // Fish can only be configured once the tank is flooded.
            disabled={t.underwaterOnly ? mode !== "underwater" : false}
            onClick={() => handleTab(t.id)}
          />
        ))}
        <div className="my-0.5 h-px bg-line" aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide panel" : "Show panel"}
          aria-expanded={open}
          title={open ? "Hide panel" : "Show panel"}
          className="flex w-full items-center justify-center rounded-md py-2 text-base text-stone/70 transition-colors hover:bg-mist/[0.06] hover:text-mist"
        >
          {open ? "‹" : "›"}
        </button>
      </nav>

      {open && (
        <div
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === active)?.label}
          className="calm-scroll flex w-64 flex-col gap-3 overflow-y-auto pr-0.5"
        >
        {active === "tank" && <TankPanel />}
        {active === "hardscape" && (
          <>
            <HardscapePalette />
            {/* self-hides until a piece is selected */}
            <HardscapeEditPanel />
          </>
        )}
        {active === "plants" && <PlantBrowser />}
        {active === "terrain" && <DrawPanel />}
        {active === "scene" && (
          <>
            <BackgroundPanel />
            <LightPanel />
            <GradePanel />
          </>
        )}
          {active === "fish" && <FishPanel />}
        </div>
      )}
    </div>
  );
}
