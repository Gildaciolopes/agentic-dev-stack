"use client";

import { useReducedMotion } from "@usefluid/motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./LogoWipe.module.css";

const COVER_MS = 420;
const HOLD_MS = 240;
const LEAVE_MS = 460;

type Phase = "idle" | "cover" | "leave";

function Curtain({ logo, phase, fixed }: { logo: string; phase: Phase; fixed?: boolean }) {
  if (phase === "idle") return null;
  return (
    <div className={styles.curtain} data-phase={phase} data-fixed={fixed || undefined} aria-hidden>
      <svg viewBox="-8 -8 136 136" className={styles.logo}>
        <path d={logo} fillRule="evenodd" fill="currentColor" />
      </svg>
    </div>
  );
}

type Props = {
  logo: string;
  view: string;
  children: ReactNode;
  fixed?: boolean;
};

export function LogoWipe({ logo, view, children, fixed }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(view);
  const [phase, setPhase] = useState<Phase>("idle");
  const held = useRef(children);
  if (view === shown) held.current = children;

  useEffect(() => {
    if (view === shown) return;
    if (reduced) {
      setShown(view);
      return;
    }
    setPhase("cover");
    const swap = setTimeout(() => setShown(view), COVER_MS);
    const leave = setTimeout(() => setPhase("leave"), COVER_MS + HOLD_MS);
    const done = setTimeout(() => setPhase("idle"), COVER_MS + HOLD_MS + LEAVE_MS);
    return () => {
      clearTimeout(swap);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, [view, reduced]);

  return (
    <div className={styles.root}>
      {view === shown ? children : held.current}
      <Curtain logo={logo} phase={phase} fixed={fixed} />
    </div>
  );
}

export function useCurtain() {
  const reduced = useReducedMotion();
  const [covered, setCovered] = useState(false);
  const cover = useCallback(() => {
    if (reduced) return Promise.resolve();
    setCovered(true);
    return new Promise<void>((resolve) => setTimeout(resolve, COVER_MS + HOLD_MS));
  }, [reduced]);
  const uncover = useCallback(() => setCovered(false), []);
  return { covered, cover, uncover };
}

export function LogoCurtain({ logo, covered, fixed = true }: { logo: string; covered: boolean; fixed?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (covered) {
      setPhase("cover");
      return;
    }
    setPhase((p) => (p === "idle" ? p : "leave"));
    const done = setTimeout(() => setPhase("idle"), LEAVE_MS);
    return () => clearTimeout(done);
  }, [covered]);

  return <Curtain logo={logo} phase={phase} fixed={fixed} />;
}
