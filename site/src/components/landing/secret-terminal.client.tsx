"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  text: string;
  /** Rule quoted verbatim from sandbox/deny-secrets.sb.template (denied commands only). */
  rule?: string;
};

const COMMANDS: Cmd[] = [
  { id: "env", text: "cat .env", rule: '(regex #"/\\.env$")' },
  { id: "ssh", text: "cat ~/.ssh/id_ed25519", rule: '(subpath "__HOME__/.ssh")' },
  { id: "src", text: "cat src/app.ts" },
];

const TYPE_MS = 38;

/** Interactive leak test: the free worker tries to read secrets inside the kernel sandbox. */
export function SecretTerminal() {
  const t = useTranslations("landing-b.security.terminal");
  const reduced = useReducedMotion();
  const [log, setLog] = useState<Cmd[]>([]);
  const [run, setRun] = useState<{ cmd: Cmd; n: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const body = useRef<HTMLDivElement>(null);

  const finish = (cmd: Cmd) => {
    setLog((l) => [...l, cmd]);
    setRun(null);
    setAnnounce(cmd.rule ? t("announceDenied", { command: cmd.text }) : t("announceAllowed", { command: cmd.text }));
  };

  useEffect(() => {
    if (!run) return;
    const id = window.setTimeout(() => {
      const n = run.n + 1;
      if (n >= run.cmd.text.length) finish(run.cmd);
      else setRun({ cmd: run.cmd, n });
    }, TYPE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [log, run]);

  const start = (cmd: Cmd) => {
    if (run) return;
    setAnnounce("");
    if (reduced) finish(cmd);
    else setRun({ cmd, n: 0 });
  };

  return (
    <figure className="overflow-hidden border border-border bg-code text-code-foreground">
      <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 bg-coral" />
          <span className="size-2.5 bg-peach" />
          <span className="size-2.5 bg-mint" />
        </span>
        <span className="flex-1 truncate text-[length:var(--text-label)] tracking-wide text-[#8a8a8a]">{t("windowTitle")}</span>
        <button
          type="button"
          onClick={() => {
            if (run) return;
            setLog([]);
            setAnnounce("");
          }}
          className="min-h-11 px-3 text-[length:var(--text-label)] uppercase tracking-widest text-[#8a8a8a] hover:text-white"
        >
          {t("clear")}
        </button>
      </figcaption>

      <div ref={body} className="h-80 overflow-y-auto p-5 text-[length:var(--text-small)] leading-relaxed" tabIndex={0} role="region" aria-label={t("title")}>
        {log.length === 0 && !run ? <p className="text-[#8a8a8a]">{t("empty")}</p> : null}
        {log.map((c, i) => (
          <Block key={`${c.id}-${i}`} cmd={c} t={t} />
        ))}
        {run ? (
          <p>
            <span aria-hidden className="mr-3 text-[#3ddc84]">
              ❯
            </span>
            {run.cmd.text.slice(0, run.n)}
            <span aria-hidden className="ml-px inline-block h-4 w-2 translate-y-0.5 bg-code-foreground" />
          </p>
        ) : null}
      </div>

      <div className="border-t border-white/10 p-4">
        <p className="mb-3 text-[length:var(--text-label)] uppercase tracking-widest text-[#8a8a8a]">{t("commands")}</p>
        <div className="flex flex-wrap gap-2">
          {COMMANDS.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={Boolean(run)}
              aria-label={t("runLabel", { command: c.text })}
              onClick={() => start(c)}
              className={cn(
                "min-h-11 touch-manipulation border border-white/50 px-4 py-2 text-[length:var(--text-small)] text-code-foreground transition-colors duration-150",
                "hover:bg-white hover:text-black active:scale-[0.98] disabled:opacity-50",
              )}
            >
              <span aria-hidden>$ </span>
              {c.text}
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="sr-only">
        {announce}
      </p>
    </figure>
  );
}

function Block({ cmd, t }: { cmd: Cmd; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="mb-4">
      <p>
        <span aria-hidden className="mr-3 text-[#3ddc84]">
          ❯
        </span>
        {cmd.text}
      </p>
      {cmd.rule ? (
        <>
          <p className="font-bold text-[#ff5a5f]">{t("denied")}</p>
          <p className="text-[#8a8a8a]">{t("deniedNote")}</p>
          <p className="mt-1 text-[#8a8a8a]">
            {t("rule")}:
            <br />
            <code className="text-[#6ee6ff]">{cmd.rule}</code>
          </p>
        </>
      ) : (
        <>
          <p>{t("fileContent")}</p>
          <p className="text-[#3ddc84]">{t("allowed")}</p>
        </>
      )}
    </div>
  );
}
