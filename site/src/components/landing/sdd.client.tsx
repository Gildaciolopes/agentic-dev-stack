"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { springs } from "@usefluid/motion";
import { useReducedMotion, useSpring } from "@usefluid/motion/react";
import { cn } from "@/lib/utils";
import { useVisible } from "./use-visible";

type Step = { id: string; what: string; why: string };

/** Clickable steps (a radio group: arrows move). A spring-driven rail shows progress through the pipeline. */
export function SddStepper({ steps, label, codes }: { steps: Step[]; label: string; codes: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const rail = useRef<HTMLSpanElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useSpring(
    { p: (index / (steps.length - 1)) * 100 },
    ({ p }) => {
      if (rail.current) rail.current.style.width = `${p}%`;
    },
    springs.soft,
  );

  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + steps.length) % steps.length;
    setIndex(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-border" />
        <span ref={rail} aria-hidden className="absolute left-0 top-0 h-0.5 bg-[image:var(--grad-primary)]" style={{ width: 0 }} />
        <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="grid grid-cols-2 gap-px pt-2 sm:grid-cols-4 lg:grid-cols-8">
          {steps.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => { buttons.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={i === index}
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                "flex min-h-11 flex-col items-start gap-1 px-3 py-3 text-left transition-colors duration-150",
                i === index ? "bg-foreground text-background" : i < index ? "bg-secondary text-foreground" : "bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <span className="text-label uppercase opacity-70">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-bold">{s.id}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2" aria-live="polite">
        <div className="flex flex-col gap-2 border border-border bg-card p-6">
          <p className="text-h3 font-bold">{steps[index].what}</p>
          <p className="text-muted-foreground">{steps[index].why}</p>
        </div>
        <div>{codes.map((c, i) => (i === index ? <div key={steps[i].id}>{c}</div> : null))}</div>
      </div>
    </div>
  );
}

type FanLabels = { label: string; tasks: string; builder: string };

const BUILDERS = [{ y: 40, id: "T03 [P]" }, { y: 100, id: "T04 [P]" }];

/** tasks.md fans [P] tasks out to builders, each in its own worktree. Runs only while visible. */
export function Fan({ labels }: { labels: FanLabels }) {
  const root = useRef<SVGSVGElement>(null);
  const visible = useVisible(root, 0.3);
  const reduced = useReducedMotion();
  const [out, setOut] = useState(false);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    if (reduced || !visible) return;
    const first = setTimeout(() => setOut(true), 250);
    const id = setInterval(() => setOut((v) => !v), 2000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [visible, reduced]);
  const shown = reduced || out;

  useSpring(
    { a: shown ? 300 : 136, b: shown ? 300 : 136 },
    (v) => {
      [v.a, v.b].forEach((x, i) => {
        dots.current[i]?.setAttribute("cx", String(x));
      });
    },
    springs.snappy,
  );

  return (
    <svg ref={root} viewBox="0 0 480 140" role="img" aria-label={labels.label} className="h-auto w-full max-w-xl text-foreground">
      <g fontSize="11" fontFamily="var(--font-mono)">
        <rect x="8" y="45" width="104" height="50" fill="var(--card)" stroke="var(--kind-lead)" strokeWidth="2" />
        <text x="60" y="74" textAnchor="middle" fill="currentColor">
          {labels.tasks}
        </text>
        {BUILDERS.map((b, i) => (
          <g key={b.id}>
            <path d={`M112 70L136 70L136 ${b.y}L320 ${b.y}`} stroke="var(--border)" strokeWidth="2" fill="none" strokeDasharray="4 6" />
            <rect x="320" y={b.y - 20} width="150" height="40" fill="var(--card)" stroke="var(--kind-native)" strokeWidth="2" />
            <text x="395" y={b.y + 4} textAnchor="middle" fill="currentColor">
              {labels.builder} {b.id}
            </text>
            <circle ref={(el) => { dots.current[i] = el; }} cx="136" cy={b.y} r="6" fill="var(--spectrum-mint)" />
          </g>
        ))}
      </g>
    </svg>
  );
}
