"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Tiny shared UI atoms. Panels read as quiet soil-toned cards with hairline
// warm borders — present, but never competing with the scape.

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`pointer-events-auto rounded-lg border border-mist/10 bg-soil/65 p-3.5 text-mist shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md ${className}`}
    >
      <h2 className="mb-2.5 text-[10px] font-normal uppercase tracking-[0.22em] text-moss/90">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Btn({
  active = false,
  children,
  className = "",
  ...props
}: {
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md px-2.5 py-1.5 text-xs font-light transition-colors duration-200 ${
        active
          ? "bg-moss text-sumi"
          : "bg-mist/[0.06] text-mist/85 hover:bg-mist/[0.12]"
      } disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-mist/20"
      style={{ backgroundColor: color }}
    />
  );
}

// Small-caps sub-header used inside panels (was repeated inline everywhere).
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-1.5 text-[10px] uppercase tracking-[0.18em] text-stone/80 ${className}`}
    >
      {children}
    </div>
  );
}

// Styled number/text input. Spreads native props.
export function Field({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-line bg-mist/[0.06] px-1.5 py-1 text-xs text-mist outline-none focus:border-aqua/60 ${className}`}
    />
  );
}

// Styled native <select>; colorScheme:dark keeps the OS dropdown readable.
export function Select({
  className = "",
  children,
  style,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{ colorScheme: "dark", ...style }}
      className={`rounded-md border border-line bg-mist/[0.06] px-1.5 py-1 text-xs text-mist outline-none focus:border-aqua/60 ${className}`}
    >
      {children}
    </select>
  );
}

// Labeled range with an inline value readout (usability + a11y).
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="flex items-center justify-between text-[10px] text-stone">
        <span>{label}</span>
        <span className="tabular-nums text-stone/70">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-moss"
      />
    </label>
  );
}

// Vertical rail tab: icon over label, ARIA tab semantics.
export function IconTab({
  icon,
  label,
  active,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-[9px] transition-colors ${
        active
          ? "bg-soil-3 text-moss"
          : "text-stone/70 hover:bg-mist/[0.06] hover:text-mist"
      } disabled:opacity-30 disabled:hover:bg-transparent`}
    >
      <span className="text-base leading-none" aria-hidden>
        {icon}
      </span>
      <span className="tracking-wide">{label}</span>
    </button>
  );
}

// Native <details> disclosure → an accessible popover with no JS / no dep.
export function Disclosure({
  summary,
  children,
  align = "right",
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  // Native <details> stays open until the summary is re-clicked; close it when
  // the user clicks anywhere outside (and on Escape).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: Event) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") el.open = false;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <details ref={ref} className={`group relative ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md bg-mist/[0.06] px-2.5 py-1.5 text-xs font-light text-mist/85 transition-colors hover:bg-mist/[0.12] [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div
        className={`absolute z-20 mt-1.5 flex max-w-[calc(100vw-1rem)] flex-col gap-2.5 rounded-lg border border-line bg-soil/95 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}
