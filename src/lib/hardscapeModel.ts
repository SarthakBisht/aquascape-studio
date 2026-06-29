import type { HardscapeItem } from "./types";

// Shared predicate so the render (Hardscape.tsx), the Customize panel
// (HardscapeEditPanel.tsx) and convertToSculpt (the store) all agree on which
// rocks render the uploaded base .glb. A rock is a "model rock" when a base model
// is loaded AND it was either placed as a model piece (source "model"), or it's a
// plain procedural rock while the global "use for all rocks" toggle is on.
export function isModelRock(
  item: Pick<HardscapeItem, "kind" | "source">,
  hasModel: boolean,
  allRocks: boolean,
): boolean {
  if (!hasModel) return false;
  if (item.source === "model") return true;
  return (
    allRocks &&
    item.kind === "rock" &&
    (item.source === "procedural" || item.source == null)
  );
}
