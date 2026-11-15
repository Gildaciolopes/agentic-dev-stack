"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useVisible } from "./use-visible";
import { ACTS, type Cls, type Line } from "./terminal-replay.data";

const TYPE_MS = 45;
const AFTER_TYPE_MS = 350;
const GAP_MS = 900;
const FRAME_MS = 33;

const COLOR: Record<Cls, string> = {
  p: "text-[#3ddc84]",
  g: "text-[#3ddc84]",
  d: "text-[#8a8a8a]",
  y: "text-[#facd86]",
  k: "text-[#6ee6ff]",
  h: "text-[#6ee6ff] font-bold",
  c: "text-[#e8e8e8]",
};

type Item =
  | { kind: "cmd"; t0: number; t1: number; text: string }
  | { kind: "frame"; t0: number; t1: number; lines: Line[] }
  | { kind: "commit"; t0: number; lines: Line[] };

/** Flatten the acts into absolute-time items, so any moment t can be rendered deterministically. */
function build() {
  const items: Item[] = [];
  let t = 400;
  for (const act of ACTS) {
    const typed = act.cmd.length * TYPE_MS;
    items.push({ kind: "cmd", t0: t, t1: t + typed, text: act.cmd });
    t += typed + AFTER_TYPE_MS;
    if (act.head) items.push({ kind: "commit", t0: t, lines: act.head });
    t += 300;
    for (const step of act.steps) {
      for (const f of step.frames ?? []) {
        items.push({ kind: "frame", t0: t, t1: t + f.dur, lines: f.lines });
        t += f.dur;
      }
      if (step.stagger) {
        step.commit.forEach((line, i) => items.push({ kind: "commit", t0: t + i * step.stagger!, lines: [line] }));
        t += step.commit.length * step.stagger;
      } else {
        items.push({ kind: "commit", t0: t, lines: step.commit });
      }
      t += step.pause ?? 250;
    }
    t += GAP_MS;
  }
  return { items, total: t };
}

const TIMELINE = build();
const PROMPT: Line = [["p", "❯ "], ["d", "~ "]];

function stateAt(t: number) {
  const lines: Line[] = [];
  let live: Line[] = [];
  let typing = false;
  for (const it of TIMELINE.items) {
    if (t < it.t0) break;
    if (it.kind === "cmd") {
      const n = Math.min(it.text.length, Math.floor((t - it.t0) / TYPE_MS));
      typing = n < it.text.length;
      lines.push([...PROMPT, ["c", it.text.slice(0, n)]]);
    } else if (it.kind === "frame") {
      if (t < it.t1) live = it.lines;
    } else {
      lines.push(...it.lines);
    }
  }
  return { lines: [...lines, ...live], typing };
}

function Row({ line }: { line: Line }) {
  if (line.length === 0 || (line.length === 1 && line[0] === "")) return <div className="whitespace-pre">{" "}</div>;
  return (
    <div className="whitespace-pre">
      {line.map((s, i) =>
        typeof s === "string" ? (
          <span key={i}>{s}</span>
        ) : (
          <span key={i} className={COLOR[s[0]]}>
            {s[1]}
          </span>
        ),
      )}
    </div>
  );
}

export function TerminalReplayPlayer() {
  const t = useTranslations("landing-b.replay");
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const inView = useVisible(wrap, 0.4); // non-latching: pauses off-screen and in a hidden tab
  const [time, setTime] = useState(0);
  // auto: starts once the terminal is first in view. play/pause: the visitor took over.
  const [mode, setMode] = useState<"auto" | "play" | "pause">("auto");
  const clock = useRef(0);
  const shown = useRef(0);

  const total = TIMELINE.total;
  const shownTime = reduced ? total : time;
  const finished = shownTime >= total;
  const playing = inView && !reduced && !finished && mode !== "pause";

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.current = Math.min(total, clock.current + Math.min(Math.max(0, now - last), 100));
      last = now;
      if (clock.current - shown.current >= FRAME_MS || clock.current >= total) {
        shown.current = clock.current;
        setTime(clock.current);
      }
      if (clock.current < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const view = useMemo(() => stateAt(shownTime), [shownTime]);

  useEffect(() => {
    if (screen.current) screen.current.scrollTop = screen.current.scrollHeight;
  }, [view]);

  const restart = () => {
    clock.current = 0;
    shown.current = 0;
    setTime(0);
    setMode("play");
  };
  const toggle = () => {
    if (playing) setMode("pause");
    else if (finished) restart();
    else setMode("play");
  };

  const btn =
    "min-h-11 min-w-[7rem] touch-manipulation border-2 border-foreground px-5 text-small font-bold transition-colors duration-150 hover:bg-foreground hover:text-background active:scale-[0.98]";

  return (
    <div ref={wrap} className="flex flex-col gap-4">
      <figure className="overflow-hidden border border-border bg-code text-code-foreground">
        <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 bg-coral" />
            <span className="size-2.5 bg-peach" />
            <span className="size-2.5 bg-mint" />
          </span>
          <span className="flex-1 truncate text-[length:var(--text-label)] tracking-wide text-[#8a8a8a]">{t("windowTitle")}</span>
        </figcaption>
        <div
          ref={screen}
          role="region"
          aria-label={t("region")}
          aria-live="off"
          aria-busy={playing}
          tabIndex={0}
          className="h-[30rem] overflow-auto p-5 text-[length:var(--text-small)] leading-relaxed"
        >
          {view.lines.map((l, i) => (
            <Row key={i} line={l} />
          ))}
          {finished ? (
            <div className="whitespace-pre">
              <span className="text-[#3ddc84]">❯ </span>
              <span className="text-[#8a8a8a]">~ </span>
              <span aria-hidden className={cn("inline-block h-4 w-2 translate-y-0.5 bg-code-foreground")} />
            </div>
          ) : null}
        </div>
      </figure>

      <div role="group" aria-label={t("controls")} className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggle} className={btn}>
          {playing ? t("pause") : t("play")}
        </button>
        <button type="button" onClick={restart} className={btn}>
          {t("replay")}
        </button>
        <p className="text-small text-muted-foreground">{t("note")}</p>
      </div>

      <p role="status" className="sr-only">
        {finished ? t("summary") : ""}
      </p>
    </div>
  );
}
