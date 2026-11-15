"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Disclosure for the text version of the diagram. The content stays in the accessibility
 * tree at all times (visually clipped, never display:none), so screen readers always get it.
 */
export function ReadAsText({ children, showLabel, hideLabel }: { children: ReactNode; showLabel: string; hideLabel: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-none border border-border px-4 text-[length:var(--text-small)] text-muted-foreground transition-colors hover:text-foreground touch-manipulation"
      >
        <span aria-hidden>{open ? "−" : "+"}</span>
        {open ? hideLabel : showLabel}
      </button>
      <div id={id} className={cn(open ? "mt-4 border border-border bg-card p-6" : "sr-only")}>
        {children}
      </div>
    </div>
  );
}
