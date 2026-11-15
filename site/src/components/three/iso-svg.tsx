import type { ReactNode } from "react";

/** Shared static SVG pieces in the isometric illustration language (server-safe, no hooks). */

const K = 0.577; // tan(30deg): iso diamond height per half-width

export function IsoDefs() {
  return (
    <defs>
      <linearGradient id="iso3-cool" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6ee6ff" />
        <stop offset="0.5" stopColor="#3d74ef" />
        <stop offset="1" stopColor="#3a2a8f" />
      </linearGradient>
      <linearGradient id="iso3-cool-r" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3d74ef" />
        <stop offset="1" stopColor="#2a1f6e" />
      </linearGradient>
      <linearGradient id="iso3-warm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f64a35" />
        <stop offset="1" stopColor="#ec3079" />
      </linearGradient>
      <linearGradient id="iso3-warm-r" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d23a2c" />
        <stop offset="1" stopColor="#b82364" />
      </linearGradient>
      <linearGradient id="iso3-mint" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#befcfc" />
        <stop offset="0.5" stopColor="#2ad8c4" />
        <stop offset="1" stopColor="#257772" />
      </linearGradient>
      <linearGradient id="iso3-mint-r" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2ad8c4" />
        <stop offset="1" stopColor="#1b5a56" />
      </linearGradient>
      <radialGradient id="iso3-glow">
        <stop offset="0" stopColor="#2ad8c4" stopOpacity="0.45" />
        <stop offset="1" stopColor="#2ad8c4" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export type IsoTone = "cool" | "warm" | "mint";

/** Slab or cube: centre (cx, cy) of the TOP face, half-width a, side thickness d. */
export function IsoBlock({ cx, cy, a, d, tone = "cool", opacity = 1 }: { cx: number; cy: number; a: number; d: number; tone?: IsoTone; opacity?: number }) {
  const h = a * K;
  return (
    <g opacity={opacity}>
      <path d={`M${cx - a} ${cy}L${cx} ${cy + h}V${cy + h + d}L${cx - a} ${cy + d}Z`} fill={`url(#iso3-${tone})`} />
      <path d={`M${cx} ${cy + h}L${cx + a} ${cy}V${cy + d}L${cx} ${cy + h + d}Z`} fill={`url(#iso3-${tone}-r)`} />
      <path d={`M${cx} ${cy - h}L${cx + a} ${cy}L${cx} ${cy + h}L${cx - a} ${cy}Z`} fill="#fff" />
    </g>
  );
}

/** Square ring (frame) seen isometrically: outer half-width a, inner hole ratio r. */
export function IsoRing({ cx, cy, a, d, r = 0.62, tone = "cool" }: { cx: number; cy: number; a: number; d: number; r?: number; tone?: IsoTone }) {
  const h = a * K;
  const b = a * r;
  const g = b * K;
  const top = `M${cx} ${cy - h}L${cx + a} ${cy}L${cx} ${cy + h}L${cx - a} ${cy}ZM${cx} ${cy - g}L${cx - b} ${cy}L${cx} ${cy + g}L${cx + b} ${cy}Z`;
  return (
    <g>
      <path d={`M${cx - a} ${cy}L${cx} ${cy + h}V${cy + h + d}L${cx - a} ${cy + d}Z`} fill={`url(#iso3-${tone})`} />
      <path d={`M${cx} ${cy + h}L${cx + a} ${cy}V${cy + d}L${cx} ${cy + h + d}Z`} fill={`url(#iso3-${tone}-r)`} />
      <path d={top} fill="#fff" fillRule="evenodd" />
    </g>
  );
}

export function IsoGlow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#iso3-glow)" />;
}

export function IsoDash({ x, y, w = 14, o = 0.5 }: { x: number; y: number; w?: number; o?: number }) {
  return <rect x={x} y={y} width={w} height={2} fill="#8a8f94" opacity={o} />;
}

export function SvgFrame({ viewBox, label, children, className }: { viewBox: string; label?: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={viewBox} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
      <IsoDefs />
      {children}
    </svg>
  );
}
