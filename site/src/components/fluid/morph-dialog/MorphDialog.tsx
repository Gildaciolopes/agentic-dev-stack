"use client";

import { createSpring, play, type Spring } from "@usefluid/motion";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import styles from "./MorphDialog.module.css";

type Props = {
  open: boolean;
  onClose(): void;
  from?: HTMLElement | DOMRect | null;
  labelledBy?: string;
  className?: string;
  style?: CSSProperties;
  contained?: boolean;
  children: ReactNode;
};

type Edges = { top: number; right: number; bottom: number; left: number };
const EDGES = ["top", "right", "bottom", "left"] as const;
const EMPTY = { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 } as DOMRect;

const OPEN = { w: 15, z: 0.8 };
const CLOSE = { w: 21, z: 0.92 };
const SPREAD = { top: 1, right: 1.12, bottom: 0.92, left: 1.06 };
const BULGE = 0.035;
const BULGE_MAX = 64;

function local(box: { edges: Edges; radius: number }, base: DOMRect) {
  const { top, right, bottom, left } = box.edges;
  return { edges: { top: top - base.top, right: right - base.left, bottom: bottom - base.top, left: left - base.left }, radius: box.radius };
}
const rectOf = (r: DOMRect, base: DOMRect) => new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height);

function colorOf(from: Props["from"]) {
  if (!(from instanceof HTMLElement)) return null;
  for (const el of [from, from.firstElementChild]) {
    if (!(el instanceof HTMLElement)) continue;
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return null;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

function boxOf(from: Props["from"], fallback: DOMRect): { edges: Edges; radius: number } {
  if (from instanceof HTMLElement) {
    const r = from.getBoundingClientRect();
    return { edges: { top: r.top, right: r.right, bottom: r.bottom, left: r.left }, radius: parseFloat(getComputedStyle(from).borderTopLeftRadius) || 12 };
  }
  if (from) return { edges: { top: from.top, right: from.right, bottom: from.bottom, left: from.left }, radius: 16 };
  const k = 0.08;
  return {
    edges: { top: fallback.top + fallback.height * k, right: fallback.right - fallback.width * k, bottom: fallback.bottom - fallback.height * k, left: fallback.left + fallback.width * k },
    radius: 28,
  };
}

export function MorphDialog({ open, onClose, from, labelledBy, className, style, contained = false, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);

  const springs = useRef<Record<keyof Edges | "radius", Spring> | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const geometry = useRef({ base: EMPTY, panel: EMPTY, radius: 28, startArea: 1, opening: true, fromColor: null as string | null, toColor: "" });
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  const paint = useCallback(() => {
    const s = springs.current;
    const d = surface.current, p = panel.current, c = content.current, m = scrim.current;
    if (!s || !d || !p || !c || !m) return;
    const g = geometry.current;
    const top = s.top.value, right = s.right.value, bottom = s.bottom.value, left = s.left.value;
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const speed = Math.max(...EDGES.map((e) => Math.abs(s[e].velocity)));
    const radius = Math.min(s.radius.value + Math.min(speed * BULGE, BULGE_MAX), width / 2, height / 2);
    const P = g.panel;
    d.style.clipPath = `inset(${top}px ${g.base.width - right}px ${g.base.height - bottom}px ${left}px round ${radius}px)`;
    p.style.clipPath = `inset(${top - P.top}px ${P.right - right}px ${P.bottom - bottom}px ${left - P.left}px round ${radius}px)`;
    const progress = clamp((width * height - g.startArea) / (P.width * P.height - g.startArea || 1));
    m.style.opacity = String(progress);
    if (g.fromColor) {
      const color = `color-mix(in oklab, ${g.toColor} ${Math.round(clamp(progress / 0.6) * 100)}%, ${g.fromColor})`;
      d.style.background = color;
      p.style.backgroundColor = color;
    }
    c.style.opacity = String(g.opening ? clamp((progress - 0.55) / 0.45) : clamp((progress - 0.7) / 0.3));
  }, []);

  const run = useCallback((target: { edges: Edges; radius: number }, config: { w: number; z: number }, done?: () => void) => {
    const s = springs.current;
    if (!s) return;
    stop.current?.();
    for (const e of EDGES) {
      const next = createSpring(s[e].value, { w: config.w * SPREAD[e], z: config.z });
      next.velocity = s[e].velocity;
      next.target = target.edges[e];
      s[e] = next;
    }
    const r = createSpring(s.radius.value, config);
    r.target = target.radius;
    s.radius = r;
    stop.current = play((dt) => {
      let moving = false;
      for (const key of [...EDGES, "radius"] as const) if (s[key].step(dt)) moving = true;
      paint();
      if (!moving) done?.();
      return moving;
    });
  }, [paint]);

  const settle = useCallback(() => {
    const p = panel.current;
    if (!p) return;
    p.style.clipPath = "none";
    p.style.backgroundColor = "";
    p.dataset.rest = "";
  }, []);

  useLayoutEffect(() => {
    const el = dialog.current, p = panel.current, d = surface.current;
    if (!el || !p || !d) return;
    if (open) {
      if (!el.open) {
        if (contained) el.show();
        else el.showModal();
      }
      delete p.dataset.rest;
      const base = el.getBoundingClientRect();
      const screen = p.getBoundingClientRect();
      const rect = rectOf(screen, base);
      const style = getComputedStyle(p);
      p.style.backgroundColor = "";
      const toColor = getComputedStyle(p).backgroundColor;
      d.style.background = toColor;
      const final = { edges: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left }, radius: parseFloat(style.borderTopLeftRadius) || 0 };
      const start = local(boxOf(from, screen), base);
      const g = geometry.current;
      g.base = base;
      g.panel = rect;
      g.radius = final.radius;
      g.opening = true;
      g.toColor = toColor;
      g.fromColor = colorOf(from);
      if (!springs.current || !stop.current) {
        g.startArea = (start.edges.right - start.edges.left) * (start.edges.bottom - start.edges.top);
        springs.current = {
          top: createSpring(start.edges.top),
          right: createSpring(start.edges.right),
          bottom: createSpring(start.edges.bottom),
          left: createSpring(start.edges.left),
          radius: createSpring(start.radius),
        };
      }
      if (reduced()) {
        for (const e of EDGES) springs.current[e].jump(final.edges[e]);
        springs.current.radius.jump(final.radius);
        paint();
        settle();
        return;
      }
      paint();
      run(final, OPEN, settle);
      return;
    }
    if (!el.open) return;
    const finish = () => {
      stop.current = null;
      springs.current = null;
      el.close();
    };
    if (reduced() || !springs.current) return finish();
    const base = el.getBoundingClientRect();
    p.style.clipPath = `inset(0 round ${geometry.current.radius}px)`;
    delete p.dataset.rest;
    geometry.current.opening = false;
    run(local(boxOf(from, p.getBoundingClientRect()), base), CLOSE, finish);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const p = panel.current, s = springs.current;
      if (!p || !s || !("rest" in p.dataset)) return;
      const base = dialog.current!.getBoundingClientRect();
      const rect = rectOf(p.getBoundingClientRect(), base);
      geometry.current.base = base;
      geometry.current.panel = rect;
      s.top.jump(rect.top);
      s.right.jump(rect.right);
      s.bottom.jump(rect.bottom);
      s.left.jump(rect.left);
      paint();
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [open, paint]);

  useEffect(() => () => stop.current?.(), []);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      data-contained={contained ? "" : undefined}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      <div ref={scrim} className={styles.scrim} onClick={() => closeRef.current()} aria-hidden />
      <div ref={surface} className={styles.surface} aria-hidden />
      <div ref={panel} className={`${styles.panel} ${className ?? ""}`} style={style}>
        <div ref={content} className={styles.content}>
          {children}
        </div>
      </div>
    </dialog>
  );
}
