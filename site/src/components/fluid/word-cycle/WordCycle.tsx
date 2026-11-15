"use client";

import { useReducedMotion } from "@usefluid/motion/react";
import { useEffect, useState } from "react";
import styles from "./WordCycle.module.css";

type Props = {
  words: string[];
  every?: number;
  loop?: boolean;
  play?: boolean;
};

export function WordCycle({ words, every = 1.6, loop = true, play = true }: Props) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const last = words.length - 1;
  const finished = !loop && index >= last;

  useEffect(() => {
    if (!play || reduced || finished || words.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (!loop && i >= last) return i;
        setLeaving(i);
        return i + 1 <= last ? i + 1 : 0;
      });
    }, every * 1000);
    return () => clearInterval(timer);
  }, [play, reduced, finished, every, loop, last, words.length]);

  const current = reduced ? last : index;
  const out = reduced ? null : leaving;

  return (
    <span className={styles.root}>
      <span className={styles.srOnly}>{words[last]}</span>
      <span className={styles.stack} aria-hidden>
        {words.map((word) => (
          <span key={word} className={styles.sizer}>{word}</span>
        ))}
        <span
          key={`in-${current}`}
          className={out === null ? styles.still : styles.in}
          onAnimationEnd={() => setLeaving(null)}
        >
          {words[current]}
        </span>
        {out !== null && <span key={`out-${out}`} className={styles.out}>{words[out]}</span>}
      </span>
    </span>
  );
}
