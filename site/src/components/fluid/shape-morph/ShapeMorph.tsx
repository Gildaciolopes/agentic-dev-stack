"use client";

import { shapes } from "@usefluid/motion";
import { MorphPath, useSequence } from "@usefluid/motion/react";

const DEFAULT_ROUTE = [shapes.dot, shapes.circle, shapes.triangle, shapes.flower, shapes.square, shapes.drop];
const BEAT = 0.42;

type Props = {
  logo: string;
  route?: string[];
  play?: boolean;
  className?: string;
  label?: string;
};

export function ShapeMorph({ logo, route = DEFAULT_ROUTE, play = true, className, label }: Props) {
  const stops = [...route, logo];
  const step = useSequence(stops.map((_, i) => i * BEAT), play);
  return (
    <svg
      viewBox="-8 -8 136 136"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <MorphPath d={stops[step]} fill="currentColor" config={{ w: 14, z: 0.74 }} />
    </svg>
  );
}
