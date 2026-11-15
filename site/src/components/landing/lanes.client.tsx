"use client";

import { useEffect, useRef, useState } from "react";
import { springs } from "@usefluid/motion";
import { useReducedMotion, useSpring } from "@usefluid/motion/react";
import { useVisible } from "./use-visible";

type Labels = { label: string; lead: string; worktree: string; blocked: string; opus: string; gate: string };

const LANES = [30, 80, 130];
const START = 112;
const END = 378;
const GATE = 300;

/**
 * Three parallel worktree lanes with request packets, and an Opus subagent
 * that hits the guard and bounces. Springs run only while visible; with
 * reduced motion it shows the settled frame.
 */
export function Lanes({ labels }: { labels: Labels }) {
  const root = useRef<SVGSVGElement>(null);
  const visible = useVisible(root, 0.3);
  const reduced = useReducedMotion();
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (reduced || !visible) return;
    const first = setTimeout(() => setOut(true), 250);
    const id = setInterval(() => setOut((v) => !v), 2200);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [visible, reduced]);
  const shown = reduced || out;

  const packets = useRef<(SVGGElement | null)[]>([]);
  const opus = useRef<SVGGElement | null>(null);
  const stamp = useRef<SVGGElement | null>(null);

  useSpring(
    { a: shown ? END : START, b: shown ? END : START, c: shown ? END : START },
    (v) => {
      [v.a, v.b, v.c].forEach((x, i) => packets.current[i]?.setAttribute("transform", `translate(${x} ${LANES[i]})`));
    },
    springs.soft,
  );
  useSpring(
    { x: shown ? GATE - 18 : START, s: shown ? 1 : 0 },
    (v) => {
      opus.current?.setAttribute("transform", `translate(${v.x} 190)`);
      if (stamp.current) stamp.current.style.opacity = String(Math.max(0, Math.min(1, v.s)));
    },
    springs.bouncy,
  );

  return (
    <svg ref={root} viewBox="0 0 520 230" role="img" aria-label={labels.label} className="h-auto w-full text-foreground">
      <g fontSize="11" fontFamily="var(--font-mono)">
        <rect x="8" y="55" width="68" height="50" fill="var(--card)" stroke="var(--kind-lead)" strokeWidth="2" />
        <text x="42" y="84" textAnchor="middle" fill="currentColor">
          {labels.lead}
        </text>
        <path d={`M76 80H${START - 12}M${START - 12} ${LANES[0]}V${LANES[2]}`} stroke="var(--border)" strokeWidth="2" fill="none" />
        {LANES.map((y, i) => (
          <g key={y}>
            <path d={`M${START - 12} ${y}H${END + 20}`} stroke="var(--border)" strokeWidth="2" strokeDasharray="4 6" />
            <rect x={END + 20} y={y - 17} width="100" height="34" fill="var(--card)" stroke="var(--kind-native)" strokeWidth="2" />
            <text x={END + 70} y={y + 4} textAnchor="middle" fill="currentColor">
              {labels.worktree} {i + 1}
            </text>
          </g>
        ))}
        {LANES.map((y, i) => (
          <g key={`p${y}`} ref={(el) => { packets.current[i] = el; }} transform={`translate(${START} ${y})`}>
            <circle r="6" fill="var(--spectrum-mint)" />
          </g>
        ))}

        <path d={`M${START - 12} 190H${GATE}`} stroke="var(--border)" strokeWidth="2" strokeDasharray="4 6" />
        <rect x={GATE} y="165" width="6" height="50" fill="var(--destructive)" />
        <text x={GATE + 14} y="186" fill="var(--muted-foreground)">
          {labels.gate}
        </text>
        <g ref={opus} transform={`translate(${START} 190)`}>
          <circle r="8" fill="var(--kind-free)" />
        </g>
        <text x={START - 12} y="216" fill="var(--muted-foreground)">
          {labels.opus}
        </text>
        <g ref={stamp} style={{ opacity: 0 }}>
          <rect x={GATE + 14} y="194" width="64" height="20" fill="var(--destructive)" />
          <text x={GATE + 46} y="208" textAnchor="middle" fill="var(--background)" fontWeight="700">
            {labels.blocked}
          </text>
        </g>
      </g>
    </svg>
  );
}
