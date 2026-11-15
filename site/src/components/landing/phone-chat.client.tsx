"use client";

import { type ReactNode, useRef, useState } from "react";
import { springs } from "@usefluid/motion";
import { useInView, useSequence, useSpring } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";

type Section = { title: string; body: string };

/** Appears with a spring (opacity + rise). Always occupies its box, so nothing shifts when it shows. */
function Pop({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useSpring(
    { o: show ? 1 : 0, y: show ? 0 : 14 },
    ({ o, y }) => {
      if (!ref.current) return;
      ref.current.style.opacity = String(Math.max(0, Math.min(1, o)));
      ref.current.style.transform = `translateY(${y}px)`;
    },
    springs.snappy,
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Seconds from start: digest sections one by one, then the question and the answer.
const TIMES = [0, 0.5, 1.1, 1.7, 2.3, 2.9, 4, 5];

function Chat({ play }: { play: boolean }) {
  const t = useTranslations("landing-b.hermes.phone");
  const sections = t.raw("sections") as Section[];
  const step = useSequence(TIMES, play);

  return (
    <div className="flex flex-col gap-3 p-4 text-small">
      <div className="flex flex-col gap-3 bg-[#141414] p-4">
        <p className="text-[length:var(--text-label)] font-bold uppercase tracking-widest text-[#6ee6ff]">{t("digestHead")}</p>
        {sections.map((s, i) => (
          <Pop key={s.title} show={step >= i + 1}>
            <p className="font-bold">{s.title}</p>
            <p className="text-[#8a8a8a]">{s.body}</p>
          </Pop>
        ))}
      </div>
      <Pop show={step >= 6} className="self-end">
        <p className="bg-[image:var(--grad-primary)] px-4 py-2 font-bold text-black">{t("question")}</p>
      </Pop>
      <Pop show={step >= 7}>
        <p className="bg-[#141414] p-4">{t("answer")}</p>
      </Pop>
    </div>
  );
}

export function PhoneChat() {
  const t = useTranslations("landing-b.hermes.phone");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.4);
  const [round, setRound] = useState(0);

  return (
    <div ref={ref} className="mx-auto flex w-full max-w-[360px] flex-col gap-3">
      <div className="border border-white/20 bg-black text-white shadow-[var(--elev-2)]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 96px static avatar, next/image adds nothing here */}
          <img
            src="/hermes-avatar.jpg"
            alt=""
            aria-hidden
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            className="size-8 rounded-[var(--radius-round)] bg-white object-cover"
          />
          <span className="font-bold">{t("header")}</span>
        </div>
        <p className="sr-only">{t("srSummary")}</p>
        <div aria-hidden className="min-h-[34rem]">
          <Chat key={round} play={inView} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[length:var(--text-label)] text-muted-foreground">{t("label")}</p>
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className="min-h-11 shrink-0 touch-manipulation border-2 border-foreground px-4 text-small font-bold transition-colors duration-150 hover:bg-foreground hover:text-background"
        >
          {t("replay")}
        </button>
      </div>
    </div>
  );
}
