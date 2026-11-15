"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type LegendKind = "native" | "google" | "free" | "optional" | "lead";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  kind: LegendKind;
  label: string;
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

export function LegendChip({ kind, label, pressed, onPressedChange, className, ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      aria-pressed={pressed}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-none border px-4 text-[length:var(--text-small)] transition-colors duration-150 touch-manipulation",
        pressed
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/60 bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground",
        className,
      )}
    >
      <span aria-hidden className="size-3" style={{ background: `var(--kind-${kind})`, opacity: pressed ? 1 : 0.7 }} />
      {label}
    </button>
  );
}
