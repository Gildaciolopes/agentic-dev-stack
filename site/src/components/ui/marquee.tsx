"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  direction?: "left" | "right";
  /** Seconds for one full loop. */
  speed?: number;
  className?: string;
  /** Accessible name of the toggle while the marquee is running. */
  pauseLabel?: string;
  /** Accessible name of the toggle while the marquee is paused. */
  playLabel?: string;
};

/**
 * CSS-only infinite marquee. The track holds the items twice and slides by
 * -50%; the copy is aria-hidden and inert. Pauses on hover and focus-within,
 * and via a visible Pause/Play button (WCAG 2.2.2). With reduced motion the
 * copy is hidden and the items wrap as a static grid.
 *
 * Decorative only: children must not be interactive (links, buttons, inputs),
 * because the duplicate group is inert and unreachable.
 */
export function Marquee({
  children,
  direction = "left",
  speed = 40,
  className,
  pauseLabel = "Pause animation",
  playLabel = "Play animation",
}: Props) {
  const [paused, setPaused] = useState(false);
  const style = {
    "--marquee-duration": `${speed}s`,
    "--marquee-dir": direction === "left" ? "normal" : "reverse",
  } as CSSProperties;
  return (
    <div className={cn("relative", className)}>
      <div className="marquee" style={style} data-paused={paused || undefined}>
        <div className="marquee-track">
          <div className="marquee-group">{children}</div>
          <div className="marquee-group marquee-dup" aria-hidden inert>
            {children}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? playLabel : pauseLabel}
        onClick={() => setPaused((p) => !p)}
        className="marquee-toggle mt-2 inline-flex size-11 items-center justify-center border border-foreground/60 text-foreground hover:border-foreground touch-manipulation"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
          {paused ? <path d="M4 2l10 6-10 6z" /> : <path d="M3 2h4v12H3zM9 2h4v12H9z" />}
        </svg>
      </button>
    </div>
  );
}
