"use client";

import { springCss, springs } from "@usefluid/motion";
import { useEffect, useState } from "react";
import styles from "./TextReveal.module.css";

const spring = springCss(springs.bouncy);

export function TextReveal({ text, play = true, stagger = 28 }: { text: string; play?: boolean; stagger?: number }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    if (!play) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [play, text]);

  let index = 0;
  return (
    <span
      className={styles.root}
      data-play={shown}
      style={{ "--easing": spring.easing, "--duration": `${spring.duration}ms` } as React.CSSProperties}
    >
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden>
        {text.split(" ").map((word, w) => (
          <span key={w} className={styles.word}>
            {word.split("").map((char, c) => (
              <span key={c} className={styles.char} style={{ transitionDelay: shown ? `${index++ * stagger}ms` : "0ms" }}>
                {char}
              </span>
            ))}
            {" "}
          </span>
        ))}
      </span>
    </span>
  );
}
