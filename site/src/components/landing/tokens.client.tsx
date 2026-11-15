"use client";

import { useRef } from "react";
import { springs } from "@usefluid/motion";
import { useInView, useSequence, useSpring } from "@usefluid/motion/react";

type Row = { short: string; saved: string; pct: number };

const MAX = 30;

/** One horizontal bar per month, sprung in sequence once in view. Axis 0 to 30 percent. */
export function TokenBars({ rows, label }: { rows: Row[]; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, 0.3);
  const step = useSequence(rows.map((_, i) => i * 0.25), inView);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const target: Record<string, number> = {};
  rows.forEach((r, i) => {
    target[`r${i}`] = inView && i <= step ? (r.pct / MAX) * 100 : 0;
  });

  useSpring(
    target,
    (v) => {
      rows.forEach((_, i) => {
        const el = bars.current[i];
        if (el) el.style.width = `${v[`r${i}`]}%`;
      });
    },
    springs.soft,
  );

  return (
    <div ref={root} role="img" aria-label={label} className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={r.short} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-small">
          <span className="text-muted-foreground">{r.short}</span>
          <span className="h-3 bg-secondary">
            <span
              ref={(el) => { bars.current[i] = el; }}
              className={`block h-full ${i === rows.length - 1 ? "bg-foreground" : "bg-[image:var(--grad-primary)]"}`}
              style={{ width: 0 }}
            />
          </span>
          <span className="text-right font-bold">{r.saved}</span>
        </div>
      ))}
    </div>
  );
}
