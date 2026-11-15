"use client";

import { useEffect, useRef, useState } from "react";
import { springs } from "@usefluid/motion";
import { useInView, useSpring } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Default CURATOR_TIMES (docs/05-free-models.md:51), minutes after midnight. */
const RUNS = [
  { label: "07:30", min: 7 * 60 + 30 },
  { label: "13:30", min: 13 * 60 + 30 },
  { label: "19:30", min: 19 * 60 + 30 },
] as const;

const R = 128;
const toDeg = (min: number) => (min / 1440) * 360;
const point = (min: number, r: number) => {
  const a = (toDeg(min) * Math.PI) / 180;
  return { x: Number((r * Math.sin(a)).toFixed(2)), y: Number((-r * Math.cos(a)).toFixed(2)) };
};

function nextRunIndex(nowMin: number) {
  const i = RUNS.findIndex((r) => r.min > nowMin);
  return i === -1 ? 0 : i;
}

/** 24 h dial with the three daily curator runs; the next run (on the visitor's clock) is highlighted. */
export function CuratorDial() {
  const t = useTranslations("landing-b.free.dial");
  const wrap = useRef<HTMLDivElement>(null);
  const hand = useRef<SVGGElement>(null);
  const inView = useInView(wrap, 0.3);
  const [nowMin, setNowMin] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    read();
    const id = window.setInterval(read, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const handDeg = nowMin === null ? 0 : toDeg(nowMin);
  useSpring(
    { a: inView ? handDeg : 0 },
    ({ a }) => {
      if (hand.current) hand.current.style.transform = `rotate(${a}deg)`;
    },
    springs.soft,
  );

  const next = nowMin === null ? -1 : nextRunIndex(nowMin);

  return (
    <div ref={wrap} className="flex flex-col gap-6">
      <svg viewBox="-180 -180 360 360" role="img" aria-label={t("svgLabel")} className="mx-auto w-full max-w-[360px] text-foreground">
        <circle r={R} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0;
          const a = point(h * 60, R);
          const b = point(h * 60, R - (major ? 12 : 6));
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeOpacity={major ? 0.9 : 0.4} strokeWidth={major ? 2 : 1} />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const p = point(h * 60, R + 22);
          return (
            <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="currentColor" fillOpacity={0.7} fontFamily="var(--font-mono)">
              {String(h).padStart(2, "0")}
            </text>
          );
        })}
        {RUNS.map((r, i) => {
          const p = point(r.min, R);
          const label = point(r.min, R - 32);
          const isNext = i === next;
          return (
            <g key={r.label}>
              <line x1={0} y1={0} x2={p.x} y2={p.y} stroke={isNext ? "var(--ring)" : "currentColor"} strokeOpacity={isNext ? 1 : 0.18} strokeWidth={isNext ? 2 : 1} />
              <circle cx={p.x} cy={p.y} r={isNext ? 11 : 7} fill={isNext ? "var(--spectrum-cyan)" : "var(--background)"} stroke="currentColor" strokeWidth={2} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={isNext ? 700 : 400} fill="currentColor" fontFamily="var(--font-mono)">
                {r.label}
              </text>
            </g>
          );
        })}
        <g ref={hand} style={{ transformOrigin: "0 0" }}>
          <line x1={0} y1={0} x2={0} y2={-70} stroke="var(--ring)" strokeWidth={3} strokeLinecap="square" />
        </g>
        <circle r={5} fill="var(--ring)" />
      </svg>

      <div>
        <h4 className="section-label mb-3">{t("runs")}</h4>
        <ol className="grid gap-2 sm:grid-cols-3">
          {RUNS.map((r, i) => (
            <li
              key={r.label}
              className={cn(
                "flex items-center justify-between gap-3 border px-4 py-3 text-small",
                i === next ? "border-foreground bg-foreground text-background" : "border-border bg-card",
              )}
            >
              <time className="font-bold">{r.label}</time>
              {i === next ? <span className="text-[length:var(--text-label)] uppercase tracking-widest">{t("next")}</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-small text-muted-foreground">{t("caption")}</p>
      </div>
    </div>
  );
}
