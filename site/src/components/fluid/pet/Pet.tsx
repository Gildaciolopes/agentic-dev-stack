"use client";

import { springs } from "@usefluid/motion";
import { MorphPath, useReducedMotion, useSpring } from "@usefluid/motion/react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./Pet.module.css";

export type Mood = "idle" | "happy" | "surprised" | "sleepy" | "curious";

const TAU = Math.PI * 2;

function body(w: number, h: number, round: number, cy = 70, lean = 0) {
  let d = "";
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const r = (Math.abs(Math.cos(a) / w) ** round + Math.abs(Math.sin(a) / h) ** round) ** (-1 / round);
    const y = cy + r * Math.sin(a);
    const x = 60 + r * Math.cos(a) + lean * ((cy - y) / h);
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const BODIES: Record<Mood, string> = {
  idle: body(38, 36, 4.2),
  happy: body(42, 32, 4, 72),
  surprised: body(34, 41, 4.6, 66),
  sleepy: body(45, 28, 3.4, 78),
  curious: body(37, 37, 4.2, 70, 7),
};

type Eye = { oval: [number, number]; line: [number, number] };
type Face = { left: Eye; right: Eye; eyeY: number; drop: number; tilt: number };

const open = (w: number, h: number): Eye => ({ oval: [w, h], line: [0, 0] });
const line = (w: number, bend: number): Eye => ({ oval: [0, 0], line: [w, bend] });

const FACES: Record<Mood, Face> = {
  idle: { left: open(4.5, 6.5), right: open(4.5, 6.5), eyeY: 68, drop: 0, tilt: 0 },
  happy: { left: line(5.5, -5), right: line(5.5, -5), eyeY: 68, drop: -6, tilt: 0 },
  surprised: { left: open(6.5, 8.5), right: open(6.5, 8.5), eyeY: 62, drop: -14, tilt: 0 },
  sleepy: { left: line(6, 1.5), right: line(6, 1.5), eyeY: 78, drop: 10, tilt: 0 },
  curious: { left: open(3.8, 5.5), right: open(6, 8), eyeY: 67, drop: -4, tilt: 6 },
};

function eyeAttrs(eye: Eye, cx: number, cy: number, size: number) {
  const lw = eye.line[0] * size;
  const lb = eye.line[1] * size;
  return {
    oval: { cx, cy, rx: eye.oval[0] * size, ry: eye.oval[1] * size },
    line: { d: `M${cx - lw} ${cy} Q${cx} ${cy + lb * 1.6} ${cx + lw} ${cy}`, strokeWidth: lw > 0.4 ? 4.4 * size : 0 },
  };
}

export type Eyes = { x: number; y: number; gap?: number; size?: number };

type Watcher = (x: number, y: number, touch: boolean) => void;
const watchers = new Set<Watcher>();
let pointer = { x: 0, y: 0, touch: false };
let frame = 0;

const flush = () => {
  frame = 0;
  for (const watch of watchers) watch(pointer.x, pointer.y, pointer.touch);
};

const onPointer = (e: PointerEvent) => {
  pointer = { x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse" };
  if (!frame) frame = requestAnimationFrame(flush);
};

function watch(fn: Watcher) {
  if (!watchers.size) {
    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("pointerdown", onPointer, { passive: true });
  }
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
    if (watchers.size) return;
    removeEventListener("pointermove", onPointer);
    removeEventListener("pointerdown", onPointer);
    cancelAnimationFrame(frame);
    frame = 0;
  };
}

function useVisible(ref: { current: Element | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

const OBJECT_CURIOUS: Face = { left: open(4.4, 6.2), right: open(5.4, 7.6), eyeY: 66, drop: 0, tilt: 2 };

type Props = {
  mood?: Mood;
  shape?: string;
  eyes?: Eyes;
  drop?: boolean;
  still?: boolean;
  follow?: boolean;
  look?: { x: number; y: number };
  label?: string;
  color?: string;
  className?: string;
};

export function Pet({ mood = "idle", shape, eyes, drop = !shape, still = false, follow = false, look, label, color, className }: Props) {
  const reduced = useReducedMotion();
  const mask = `pet-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const root = useRef<SVGSVGElement>(null);
  const parts = useRef<Record<string, SVGElement | null>>({});
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const visible = useVisible(root);

  useEffect(() => {
    if (!follow || !visible) return;
    let back: ReturnType<typeof setTimeout> | undefined;
    const stop = watch((px, py, touch) => {
      clearTimeout(back);
      if (touch) back = setTimeout(() => setGaze({ x: 0, y: 0 }), 1200);
      const box = root.current?.getBoundingClientRect();
      if (!box?.width) return;
      const dx = (px - (box.left + box.width / 2)) / (box.width * 2);
      const dy = (py - (box.top + box.height / 2)) / (box.height * 2);
      const x = Math.round(Math.max(-1, Math.min(1, dx)) * 10) / 10;
      const y = Math.round(Math.max(-1, Math.min(1, dy)) * 10) / 10;
      setGaze((g) => (g.x === x && g.y === y ? g : { x, y }));
    });
    return () => {
      clearTimeout(back);
      stop();
    };
  }, [follow, visible]);

  useEffect(() => {
    if (reduced || still || !visible || mood === "sleepy") return;
    let open: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setBlink(true);
      open = setTimeout(() => setBlink(false), 120);
    }, 3400);
    return () => {
      clearInterval(timer);
      clearTimeout(open);
    };
  }, [reduced, still, visible, mood]);

  const f = shape && mood === "curious" ? OBJECT_CURIOUS : FACES[mood];
  const g = follow ? gaze : (look ?? { x: 0, y: 0 });
  const ex = eyes?.x ?? 60;
  const size = eyes?.size ?? 1;
  const gap = eyes?.gap ?? 13;
  const ey = (eyes?.y ?? 68) + (f.eyeY - 68) * size;
  const first = useRef({
    l: eyeAttrs(f.left, ex + g.x * 6 * size - gap, ey + g.y * 4 * size - f.tilt * 0.4, size),
    r: eyeAttrs(f.right, ex + g.x * 6 * size + gap, ey + g.y * 4 * size + f.tilt * 0.4, size),
  });

  useSpring(
    {
      lx: g.x * 6 * size,
      ly: g.y * 4 * size,
      ex,
      ey,
      gap,
      size,
      low: f.left.oval[0] * size,
      loh: (blink ? 0.8 : f.left.oval[1]) * size,
      llw: f.left.line[0] * size,
      llb: f.left.line[1] * size,
      row: f.right.oval[0] * size,
      roh: (blink ? 0.8 : f.right.oval[1]) * size,
      rlw: f.right.line[0] * size,
      rlb: f.right.line[1] * size,
      drop: f.drop,
      tilt: f.tilt,
    },
    (v) => {
      const p = parts.current;
      const x = v.ex + v.lx;
      const y = v.ey + v.ly;
      const set = (el: SVGElement | null, attrs: Record<string, number | string>) => {
        if (el) for (const k in attrs) el.setAttribute(k, String(attrs[k]));
      };
      const eye = (side: "l" | "r", cx: number, cy: number, ow: number, oh: number, lw: number, lb: number) => {
        set(p[`${side}Oval`], { cx, cy, rx: Math.max(0, ow), ry: Math.max(0, oh) });
        set(p[`${side}Line`], {
          d: `M${cx - lw} ${cy} Q${cx} ${cy + lb * 1.6} ${cx + lw} ${cy}`,
          "stroke-width": lw > 0.4 ? 4.4 * v.size : 0,
        });
      };
      eye("l", x - v.gap, y - v.tilt * 0.4, v.low, v.loh, v.llw, v.llb);
      eye("r", x + v.gap, y + v.tilt * 0.4, v.row, v.roh, v.rlw, v.rlb);
      if (p.drop) p.drop.setAttribute("transform", `translate(0 ${v.drop}) rotate(${v.tilt * 2} 88 22)`);
    },
    springs.snappy,
  );

  const ref = (name: string) => (el: SVGElement | null) => {
    parts.current[name] = el;
  };

  return (
    <svg
      ref={root}
      viewBox="0 0 120 120"
      className={[styles.pet, className].filter(Boolean).join(" ")}
      style={color ? { color } : undefined}
      data-mood={mood}
      data-shape={shape ? "" : undefined}
      data-still={still || undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect width="120" height="120" fill="#fff" />
          <ellipse ref={ref("lOval")} fill="#000" {...first.current.l.oval} />
          <ellipse ref={ref("rOval")} fill="#000" {...first.current.r.oval} />
          <path ref={ref("lLine")} fill="none" stroke="#000" strokeLinecap="round" {...first.current.l.line} />
          <path ref={ref("rLine")} fill="none" stroke="#000" strokeLinecap="round" {...first.current.r.line} />
        </mask>
      </defs>
      <g className={styles.pose}>
        <g className={styles.body}>
          <MorphPath d={shape ?? BODIES[mood]} fill="currentColor" mask={`url(#${mask})`} config={{ w: 12, z: 0.72, points: 120, spread: 0.1 }} />
        </g>
      </g>
      {drop && (
        <g ref={ref("drop")}>
          <circle cx="88" cy="22" r="6" fill="currentColor" className={styles.drop} />
        </g>
      )}
    </svg>
  );
}
