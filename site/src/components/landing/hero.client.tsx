"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useReducedMotion } from "@usefluid/motion/react";
import { Pet } from "@/components/fluid/pet/Pet";
import { ShapeMorph } from "@/components/fluid/shape-morph/ShapeMorph";
import { WordCycle } from "@/components/fluid/word-cycle/WordCycle";
import { InstallCommand } from "@/components/ui/install-command";
import { logo } from "@/lib/logo";
import { useVisible } from "./use-visible";

/** Shapes flow into the logo once, the first time it is on screen, and then stay on the logo. Reduced motion: logo straight away. */
export function HeroMark({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref, 0.3);
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  if (visible && !started) setStarted(true); // latch: never goes back, so the route is not restarted
  return (
    <div ref={ref} className="mx-auto size-24 text-foreground md:size-28">
      <ShapeMorph logo={logo} label={label} route={reduced ? [] : undefined} play={started} className="size-full" />
    </div>
  );
}

/** "Made for" + a word that cycles once and stops on the last word. */
export function HeroCycle({ lead, words }: { lead: string; words: string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const visible = useVisible(ref, 0.5);
  return (
    <p ref={ref} className="text-h3 font-bold text-muted-foreground">
      {lead} <span className="text-foreground"><WordCycle words={words} loop={false} play={visible} /></span>
    </p>
  );
}

type InstallProps = {
  command: string;
  copyLabel: string;
  copiedLabel: string;
  petLabel: string;
};

/** Install box + the mascot. Lifts "copied" state so the pet turns happy. */
export function HeroInstall({ command, copyLabel, copiedLabel, petLabel }: InstallProps) {
  const [happy, setHappy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest("button")) return;
    setHappy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHappy(false), 2400);
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4 sm:flex-row">
      <div onClick={onClick} className="w-full min-w-0 sm:flex-1">
        <InstallCommand command={command} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <div className="size-16 flex-none text-foreground">
        <Pet follow mood={happy ? "happy" : "idle"} label={petLabel} />
      </div>
    </div>
  );
}
