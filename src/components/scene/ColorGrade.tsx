"use client";

import { EffectComposer, BrightnessContrast, HueSaturation } from "@react-three/postprocessing";
import { useStudioStore } from "@/store/useStudioStore";

/**
 * Global color grade over the whole render (brightness / contrast / saturation /
 * hue tint). Renders into the WebGL buffer so screenshots keep the grade.
 *
 * ponytail: the composer only mounts when the grade is non-neutral, so the
 * default render path (AA, transparent backdrop) stays byte-identical and free.
 * If grading needs to coexist with the transparent "none" backdrop, pass
 * EffectComposer alpha — not needed until someone grades that combo.
 */
export function ColorGrade() {
  const g = useStudioStore((s) => s.grade);
  if (g.brightness === 0 && g.contrast === 0 && g.saturation === 0 && g.hue === 0) {
    return null;
  }
  return (
    <EffectComposer>
      <BrightnessContrast brightness={g.brightness * 0.5} contrast={g.contrast * 0.6} />
      <HueSaturation hue={(g.hue * Math.PI) / 180} saturation={g.saturation} />
    </EffectComposer>
  );
}
