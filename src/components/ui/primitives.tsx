"use client";

import type { ReactNode } from "react";

// Tiny shared UI atoms so the panels stay consistent without pulling in a
// component library.

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
      className={`pointer-events-auto rounded-xl border border-white/10 bg-slate-900/70 p-3 text-slate-100 shadow-xl backdrop-blur-md ${className}`}
    >
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80">
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
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-cyan-400 text-slate-900"
          : "bg-white/5 text-slate-200 hover:bg-white/10"
      } disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
      style={{ backgroundColor: color }}
    />
  );
}
