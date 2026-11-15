const base =
  "inline-flex min-h-11 items-center justify-center gap-2 px-5 font-mono text-sm font-bold whitespace-nowrap select-none touch-manipulation transition-transform duration-150 active:translate-y-px";

/** Primary: gradient fill with a BLACK bold label (white fails AA on the gradient). */
export const btnPrimary = `${base} [background:var(--grad-primary)] text-black hover:brightness-110`;

/** Secondary: 2px outline in the foreground colour. */
export const btnSecondary = `${base} border-2 border-foreground text-foreground hover:bg-foreground hover:text-background`;
