"use client";

import { useRef } from "react";
import { useSpring } from "@usefluid/motion/react";
import { springs } from "@usefluid/motion";
import { useTranslations } from "next-intl";
import styles from "./architecture.module.css";

/** relative bars only: how much of the baseline is left when each saver is on (illustrative, no figures) */
const LEFT = { rtk: 0.78, caveman: 0.62, graphify: 0.55 } as const;
const KEYS = ["rtk", "caveman", "graphify"] as const;

export function TokenMeter({ progress }: { progress: number }) {
  const t = useTranslations("architecture.meter");
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useSpring(
    { p: progress },
    ({ p }) => {
      KEYS.forEach((k, i) => {
        const el = bars.current[i];
        if (el) el.style.transform = `scaleX(${1 - (1 - LEFT[k]) * p})`;
      });
    },
    springs.soft,
  );
  return (
    <div className={styles.meter} role="group" aria-label={t("label")}>
      <p className="section-label">{t("label")}</p>
      <ul className={styles.meterList}>
        {KEYS.map((k, i) => (
          <li key={k} className={styles.meterRow}>
            <span className={styles.meterName}>{t(`${k}.name`)}</span>
            <span className={styles.meterTrack} aria-hidden>
              <span
                ref={(el) => {
                  bars.current[i] = el;
                }}
                className={styles.meterBar}
              />
            </span>
            <span className={styles.meterNote}>{t(`${k}.note`)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.meterHint}>{t("hint")}</p>
    </div>
  );
}
