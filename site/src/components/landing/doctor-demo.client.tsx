"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { MorphLoader } from "@/components/fluid/morph-loader/MorphLoader";

/**
 * Check names exactly as printed by `doctor` (lib/doctor.mjs:24-46).
 * `off` mirrors a default install: Codex is off unless WITH_CODEX=1 (lib/doctor.mjs:38).
 */
const CHECKS: { name: string; off?: boolean }[] = [
  { name: "Claude Code" },
  { name: "RTK" },
  { name: "agent-model-guard hook" },
  { name: "default subagent model = sonnet" },
  { name: "subagents scout/builder/reviewer" },
  { name: "orchestration block in ~/.claude/CLAUDE.md" },
  { name: "caveman" },
  { name: "Spec Kit (specify)" },
  { name: "graphify" },
  { name: "alethe (audited)" },
  { name: "Antigravity CLI (agy)" },
  { name: "OpenCode" },
  { name: "opencode-safe (sandboxed free worker)" },
  { name: "Codex", off: true },
  { name: "9Router" },
  { name: "9Router running" },
  { name: "NVIDIA NIM provider in 9Router" },
  { name: "combo 'free'" },
  { name: "curator scheduled" },
  { name: "Hermes Agent" },
  { name: "digest collector scheduled" },
];

const STEP_MS = 230;

/** Self-contained: pass `onDone` to also react (for example with the global toast) when the run completes. */
export function DoctorDemo({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("landing-b.one.doctor");
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);
  const [announce, setAnnounce] = useState("");
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const off = CHECKS.filter((c) => c.off).length;
  const ok = CHECKS.length - off;
  const running = started && count < CHECKS.length;
  const done = started && count >= CHECKS.length;

  const finish = () => {
    setAnnounce(t("announceDone", { ok, off }));
    onDoneRef.current?.();
  };

  useEffect(() => {
    if (!started || count >= CHECKS.length) return;
    const id = window.setTimeout(() => {
      const n = count + 1;
      setCount(n);
      if (n >= CHECKS.length) finish();
    }, STEP_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, count]);

  const start = () => {
    if (running) return;
    setStarted(true);
    if (reduced) {
      setCount(CHECKS.length);
      finish();
    } else {
      setAnnounce(t("announceStart"));
      setCount(0);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center bg-[image:var(--grad-primary)] px-6 py-3 text-small font-bold text-black transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {done ? t("again") : t("run")}
        </button>
        <div className="size-[72px]">
          {!started ? null : <MorphLoader done={done} label={t("running")} doneLabel={t("doneLabel")} />}
        </div>
      </div>

      <figure className="overflow-hidden border border-border bg-code text-code-foreground">
        <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 bg-coral" />
            <span className="size-2.5 bg-peach" />
            <span className="size-2.5 bg-mint" />
          </span>
          <span className="flex-1 truncate text-[length:var(--text-label)] tracking-wide text-[#8a8a8a]">{t("windowTitle")}</span>
        </figcaption>
        <ul className="grid gap-x-8 gap-y-1 p-5 text-[length:var(--text-small)] sm:grid-cols-2" aria-live="off">
          {CHECKS.map((c, i) => {
            const checked = i < count;
            return (
              <li key={c.name} className={checked ? "" : "text-[#8a8a8a]"}>
                <span aria-hidden className={checked ? (c.off ? "text-[#8a8a8a]" : "text-[#3ddc84]") : ""}>
                  {checked ? (c.off ? "·" : "✓") : "–"}{" "}
                </span>
                {c.name}
                {checked && c.off ? <span className="text-[#8a8a8a]"> {t("disabled")}</span> : null}
                <span className="sr-only">{checked ? (c.off ? `: ${t("disabled")}` : ": ok") : ""}</span>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-white/10 px-5 py-3 text-[length:var(--text-small)] text-[#8a8a8a]">
          {done ? t("summary", { ok, off }) : " "}
        </p>
      </figure>

      <p className="text-small text-muted-foreground">{t("illustration")}</p>
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
