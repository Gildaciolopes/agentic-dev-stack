"use client";

import { shapes } from "@usefluid/motion";
import { MorphPath, useReducedMotion } from "@usefluid/motion/react";
import { useEffect, useState } from "react";
import styles from "./MorphLoader.module.css";

const ROUTE = [shapes.circle, shapes.square, shapes.triangle, shapes.flower, shapes.capsule, shapes.drop];
const CHECK = "M18 62L32 48L50 66L88 28L102 42L50 94Z";

type Props = { done: boolean; label?: string; doneLabel?: string };

export function MorphLoader({ done, label = "Loading", doneLabel = "Done" }: Props) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (done || reduced) return;
    const timer = setInterval(() => setI((n) => n + 1), 420);
    return () => clearInterval(timer);
  }, [done, reduced]);

  return (
    <span className={styles.root} role="status">
      <svg viewBox="-6 -6 132 132" aria-hidden className={styles.shape} data-done={done}>
        <MorphPath d={done ? CHECK : ROUTE[i % ROUTE.length]} fill="currentColor" config={{ w: 16, z: 0.72, points: 120 }} />
      </svg>
      <span className={styles.srOnly}>{done ? doneLabel : label}</span>
    </span>
  );
}
