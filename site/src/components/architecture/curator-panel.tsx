"use client";

import { useEffect, useRef, useState } from "react";
import { springs } from "@usefluid/motion";
import { useInView, useReducedMotion, useSequence, useSpring } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { curatorDemo, isHealthy, probeLatency, type CuratorRow } from "@/content/architecture";
import { Button } from "@/components/ui/button";
import styles from "./architecture.module.css";

const N = curatorDemo.rows.length;
/** step s: rows 0..s-1 have a result; N+1 judge/drop; N+2 combo rewritten */
const TIMES = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 5.2, 6.6];
const LAST = N + 2;
const ROW_H = 34;

const ids = [...new Set([...curatorDemo.after, ...curatorDemo.before])];
const slotBefore = (m: string) => curatorDemo.before.indexOf(m);
const slotAfter = (m: string) => curatorDemo.after.indexOf(m);

function ComboRow({ model, done, drop }: { model: string; done: boolean; drop: boolean }) {
  const el = useRef<HTMLLIElement>(null);
  const slot = done ? slotAfter(model) : slotBefore(model);
  const shown = slot >= 0;
  useSpring(
    { y: Math.max(slot, 0) * ROW_H, o: shown ? 1 : 0 },
    ({ y, o }) => {
      if (!el.current) return;
      el.current.style.transform = `translateY(${y}px) translateX(${(1 - Math.min(o, 1)) * 16}px)`;
      el.current.style.opacity = String(Math.min(Math.max(o, 0), 1));
    },
    springs.soft,
  );
  return (
    <li ref={el} className={styles.comboRow} data-bad={drop && !done ? "1" : undefined} style={{ height: ROW_H - 4 }}>
      {model}
    </li>
  );
}

function ProbeRow({ row, state, dropped, t }: { row: CuratorRow; state: "wait" | "probing" | "done"; dropped: boolean; t: (key: string) => string }) {
  const ref = useRef<HTMLLIElement>(null);
  const bad = !isHealthy(row);
  useSpring(
    { o: state === "wait" ? 0.45 : 1 },
    ({ o }) => {
      if (ref.current) ref.current.style.opacity = String(o);
    },
    springs.snappy,
  );
  const lat = probeLatency(row);
  return (
    <li ref={ref} className={styles.probeRow} data-state={state} data-bad={state === "done" && bad ? "1" : undefined} data-dropped={dropped && bad ? "1" : undefined}>
      <span className={styles.probeModel}>{row.model}</span>
      <span className={styles.probeCell}>
        {state === "wait" ? "…" : state === "probing" ? t("probing") : row.chat.ok ? t("ok") : (row.chat.error ?? t("failed"))}
      </span>
      <span className={styles.probeCell}>
        {state !== "done" ? "…" : row.tool?.toolCall ? t("toolOk") : row.chat.ok ? t("failed") : "–"}
      </span>
      <span className={styles.probeCell}>{state === "done" && lat !== null ? `${lat}s` : "–"}</span>
    </li>
  );
}

export function CuratorPanel({ onActive }: { onActive?: (active: boolean) => void }) {
  const t = useTranslations("architecture.curator");
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const seen = useInView(root, 0.45);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const replayTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(replayTimer.current), []);
  const stepRaw = useSequence(TIMES, playing);
  const step = reduced && !playing ? LAST : stepRaw;
  const finished = step >= LAST;

  // auto-play once when scrolled into view (never with reduced motion)
  useEffect(() => {
    if (seen && !started.current && !reduced) {
      started.current = true;
      setPlaying(true);
    }
  }, [seen, reduced]);

  const active = playing && !finished;
  useEffect(() => {
    onActive?.(active);
  }, [active, onActive]);

  const replay = () => {
    started.current = true;
    setPlaying(false);
    window.clearTimeout(replayTimer.current);
    replayTimer.current = window.setTimeout(() => setPlaying(true), 60);
  };

  const dropped = step >= N + 1;
  const dead = curatorDemo.rows.find((r) => !isHealthy(r));
  const status = finished ? t("statusDone") : dropped ? t("statusDrop") : playing ? t("statusProbe") : t("statusIdle");

  return (
    <section ref={root} className={styles.curator} aria-labelledby="curator-title">
      <header className={styles.curatorHead}>
        <div>
          <p className="section-label">
            <span aria-hidden className={styles.dot} style={{ background: "var(--k-free)" }} /> {t("eyebrow")}
          </p>
          <h3 id="curator-title" className="text-h3 mt-2">
            {t("title")}
          </h3>
          <p className="mt-2 max-w-prose text-[length:var(--text-small)] text-muted-foreground">{t("intro", { times: curatorDemo.config.runsPerDay })}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={replay} disabled={active} className="shrink-0">
          {finished || playing ? t("replay") : t("run")}
        </Button>
      </header>

      <div className={styles.curatorGrid}>
        <div>
          <div className={styles.probeHead} aria-hidden>
            <span>{t("cols.model")}</span>
            <span>{t("cols.answers")}</span>
            <span>{t("cols.tool")}</span>
            <span>{t("cols.latency")}</span>
          </div>
          <ul className={styles.probeList}>
            {curatorDemo.rows.map((row, i) => (
              <ProbeRow
                key={row.model}
                row={row}
                t={t}
                dropped={dropped}
                state={step > i ? "done" : step === i && playing && !finished ? "probing" : "wait"}
              />
            ))}
          </ul>
          <p className={styles.probeNote}>{t("illustrative")}</p>
        </div>

        <div>
          <p className="section-label">{t("combo", { name: curatorDemo.config.combo })}</p>
          <ul className={styles.comboList} style={{ height: curatorDemo.before.length * ROW_H }}>
            {ids.map((m) => (
              <ComboRow key={m} model={m} done={step >= LAST} drop={dropped} />
            ))}
          </ul>
          <p className={styles.serving} data-pulse={dropped && !finished ? "1" : undefined}>
            <span aria-hidden className={styles.dot} style={{ background: "var(--success)" }} />
            {t("serving")}
          </p>
          {dead ? (
            <p className={styles.deadNote} data-on={dropped ? "1" : undefined}>
              {dead.chat.error}
            </p>
          ) : null}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
