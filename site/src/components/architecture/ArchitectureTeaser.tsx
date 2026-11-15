"use client";

import { useEffect, useRef, useState } from "react";
import { createSpring, play } from "@usefluid/motion";
import { useReducedMotion } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { architecture } from "@/content/architecture";
import styles from "./architecture.module.css";

/** Tiny hero version: the lead pulses and plans fan out to scout, builder and reviewer. */
const W = 300;
const H = 200;
const LEAD = { x: 75, y: 16, w: 150, h: 46 };
const CHILD_W = 84;
const CHILD_Y = 140;
const CHILD_H = 44;
const CHILD_IDS = ["scout", "builder", "reviewer"] as const;
const CHILD_X = [8, 108, 208];
const START: [number, number] = [150, LEAD.y + LEAD.h];
const ends = CHILD_X.map((x): [number, number] => [x + CHILD_W / 2, CHILD_Y]);
const PERIOD = 2.8;
const TRAVEL = { w: 5, z: 1 };

const curve = (to: [number, number]) => {
  const my = (START[1] + to[1]) / 2;
  return `M${START[0]} ${START[1]}C${START[0]} ${my} ${to[0]} ${my} ${to[0]} ${to[1]}`;
};
function bez(to: [number, number], t: number): [number, number] {
  const my = (START[1] + to[1]) / 2;
  const u = 1 - t;
  return [
    u * u * u * START[0] + 3 * u * u * t * START[0] + 3 * u * t * t * to[0] + t * t * t * to[0],
    u * u * u * START[1] + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * to[1],
  ];
}

export function ArchitectureTeaser() {
  const t = useTranslations("architecture.teaser");
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGRectElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const active = visible && !hidden && !reduced;
  useEffect(() => {
    if (!active) return;
    let clock = 0;
    const sp = CHILD_IDS.map(() => createSpring(0, TRAVEL));
    const running = CHILD_IDS.map(() => false);
    const nextStart = CHILD_IDS.map((_, i) => i * 0.32);
    const stop = play((dt) => {
      clock += dt;
      const r = ring.current;
      if (r) {
        const s = (clock % 2.4) / 2.4;
        r.style.transform = `scale(${1 + 0.16 * s})`;
        r.style.opacity = String(0.7 * (1 - s));
      }
      CHILD_IDS.forEach((_, i) => {
        const el = dots.current[i];
        if (!el) return;
        if (!running[i]) {
          if (clock < nextStart[i]) return;
          running[i] = true;
          sp[i].jump(0);
          sp[i].target = 1;
        }
        sp[i].step(dt);
        const v = Math.min(1, sp[i].value);
        const [x, y] = bez(ends[i], v);
        el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        el.style.opacity = String(Math.min(1, v * 10, (1 - v) * 10 + 0.15));
        if (v > 0.985) {
          running[i] = false;
          el.style.opacity = "0";
          nextStart[i] = clock + (PERIOD - 1.4) + i * 0.1;
        }
      });
      return true;
    });
    return stop;
  }, [active]);

  const label = (id: string) => architecture.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div ref={root} className={styles.teaser} role="img" aria-label={t("label")}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden focusable="false">
        {ends.map((to, i) => (
          <path key={i} d={curve(to)} className={styles.teaserLine} />
        ))}
        <rect ref={ring} className={styles.teaserRing} x={LEAD.x} y={LEAD.y} width={LEAD.w} height={LEAD.h} />
        <rect className={styles.teaserLead} x={LEAD.x} y={LEAD.y} width={LEAD.w} height={LEAD.h} />
        <text className={styles.teaserText} x={W / 2} y={LEAD.y + LEAD.h / 2 + 5} textAnchor="middle">
          {t("lead")}
        </text>
        {CHILD_IDS.map((id, i) => (
          <g key={id}>
            <rect className={styles.teaserChild} x={CHILD_X[i]} y={CHILD_Y} width={CHILD_W} height={CHILD_H} />
            <text className={styles.teaserText} x={CHILD_X[i] + CHILD_W / 2} y={CHILD_Y + CHILD_H / 2 + 4} textAnchor="middle">
              {label(id)}
            </text>
          </g>
        ))}
        {CHILD_IDS.map((id, i) => (
          <circle
            key={id}
            ref={(el) => {
              dots.current[i] = el;
            }}
            r={4.5}
            className={styles.teaserPacket}
            transform={`translate(${START[0]} ${START[1]})`}
            style={{ opacity: reduced ? 0 : 0 }}
          />
        ))}
      </svg>
    </div>
  );
}
