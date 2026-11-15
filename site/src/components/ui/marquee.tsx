import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  direction?: "left" | "right";
  /** Seconds for one full loop. */
  speed?: number;
  className?: string;
};

/**
 * CSS-only infinite marquee. The track holds the items twice and slides by
 * -50%; the copy is aria-hidden and inert. Pauses on hover and focus-within.
 * With reduced motion the copy is hidden and the items wrap as a static grid.
 *
 * Decorative only: children must not be interactive (links, buttons, inputs),
 * because the duplicate group is inert and unreachable.
 */
export function Marquee({ children, direction = "left", speed = 40, className }: Props) {
  const style = {
    "--marquee-duration": `${speed}s`,
    "--marquee-dir": direction === "left" ? "normal" : "reverse",
  } as CSSProperties;
  return (
    <div className={cn("marquee", className)} style={style}>
      <div className="marquee-track">
        <div className="marquee-group">{children}</div>
        <div className="marquee-group marquee-dup" aria-hidden inert>
          {children}
        </div>
      </div>
    </div>
  );
}
