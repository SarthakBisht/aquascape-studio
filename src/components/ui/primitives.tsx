"use client";

import type { ReactNode } from "react";

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
