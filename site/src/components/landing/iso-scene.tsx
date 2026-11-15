import type { CSSProperties } from "react";
import styles from "./landing.module.css";

type Side = "left" | "right";

/** Isometric cube: gradient sides, white top. (x, y) is the top vertex, s the half-width. */
function Cube({ x, y, s, left = "url(#ls-left)", right = "url(#ls-right)" }: { x: number; y: number; s: number; left?: string; right?: string }) {
  const h = s / 2;
  return (
    <g>
      <path d={`M${x - s} ${y + h}L${x} ${y + s}V${y + 2 * s}L${x - s} ${y + 1.5 * s}Z`} fill={left} />
      <path d={`M${x} ${y + s}L${x + s} ${y + h}V${y + 1.5 * s}L${x} ${y + 2 * s}Z`} fill={right} />
      <path d={`M${x} ${y}L${x + s} ${y + h}L${x} ${y + s}L${x - s} ${y + h}Z`} fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

function Crescent({ x, y, fill }: { x: number; y: number; fill: string }) {
  return <path transform={`translate(${x} ${y})`} d="M26 0A26 26 0 1 0 52 36A20 20 0 1 1 26 0Z" fill={fill} />;
}

function Arch({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 64V28a28 14 0 0 1 56 0V64H38V34a10 5 0 0 0-20 0V64Z" fill="url(#ls-left)" />
      <path d="M0 28a28 14 0 0 1 56 0 28 14 0 0 0-56 0Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

function Toggle({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 22L36 40V50L0 32Z" fill="url(#ls-left)" />
      <path d="M36 40L72 22V32L36 50Z" fill="url(#ls-right)" />
      <path d="M36 4L72 22L36 40L0 22Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="50" cy="22" rx="13" ry="7" fill="url(#ls-mint)" />
    </g>
  );
}

function Dashes({ items }: { items: [number, number, number][] }) {
  return (
    <g fill="#8a8a8a" opacity="0.6">
      {items.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height="2" />
      ))}
    </g>
  );
}

function Floating({ d, delay, children }: { d: number; delay: number; children: React.ReactNode }) {
  const style = { "--float-d": `${d}s`, "--float-delay": `${delay}s` } as CSSProperties;
  return (
    <g className={styles.float} style={style}>
      {children}
    </g>
  );
}

/** Static isometric fragments flanking the hero. Decorative: CSS float only, off in reduced motion. */
export function IsoScene({ side, className }: { side: Side; className?: string }) {
  return (
    <svg viewBox="0 0 280 520" fill="none" aria-hidden role="presentation" className={className}>
      <defs>
        <linearGradient id="ls-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d74ef" />
          <stop offset="1" stopColor="#065bbc" />
        </linearGradient>
        <linearGradient id="ls-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#065bbc" />
          <stop offset="1" stopColor="#3a2a8f" />
        </linearGradient>
        <linearGradient id="ls-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f64a35" />
          <stop offset="1" stopColor="#ec3079" />
        </linearGradient>
        <linearGradient id="ls-mint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#befcfc" />
          <stop offset="0.5" stopColor="#2ad8c4" />
          <stop offset="1" stopColor="#257772" />
        </linearGradient>
      </defs>
      {side === "left" ? (
        <>
          <Floating d={8} delay={0}>
            <Cube x={150} y={150} s={64} />
          </Floating>
          <Floating d={6} delay={-2}>
            <Crescent x={30} y={60} fill="url(#ls-warm)" />
          </Floating>
          <Floating d={9} delay={-4}>
            <Toggle x={30} y={330} />
          </Floating>
          <Floating d={7} delay={-1}>
            <Cube x={196} y={400} s={30} left="url(#ls-warm)" />
          </Floating>
          <Dashes items={[[20, 250, 28], [60, 292, 14], [210, 300, 22], [110, 470, 18], [244, 40, 12], [12, 440, 10]]} />
        </>
      ) : (
        <>
          <Floating d={7} delay={-3}>
            <Arch x={150} y={50} />
          </Floating>
          <Floating d={9} delay={-1}>
            <Cube x={110} y={230} s={54} left="url(#ls-warm)" />
          </Floating>
          <Floating d={6} delay={-5}>
            <Crescent x={170} y={380} fill="url(#ls-mint)" />
          </Floating>
          <Floating d={8} delay={-2}>
            <Cube x={50} y={410} s={24} />
          </Floating>
          <Dashes items={[[250, 190, 20], [24, 120, 26], [220, 340, 12], [60, 360, 16], [150, 490, 24], [8, 40, 10]]} />
        </>
      )}
    </svg>
  );
}
