"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/** Shared 3D helpers: gradient boxes (vertex colours, white tops), theme colours, glow. */

export type PaletteName = "cool" | "warm" | "mint" | "grey";

const STOPS: Record<PaletteName, [string, string, string]> = {
  cool: ["#6ee6ff", "#3d74ef", "#3a2a8f"],
  warm: ["#f64a35", "#ee3d58", "#ec3079"],
  mint: ["#befcfc", "#2ad8c4", "#257772"],
  grey: ["#9aa0a6", "#6b7177", "#3d4146"],
};

const cache = new Map<PaletteName, THREE.BoxGeometry>();

/** Unit box centred on the origin; side faces get a vertical 3-stop gradient, +y is white. */
export function gradientBox(name: PaletteName): THREE.BoxGeometry {
  const hit = cache.get(name);
  if (hit) return hit;
  const g = new THREE.BoxGeometry(1, 1, 1);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const [a, b, c] = STOPS[name].map((s) => new THREE.Color(s));
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    if (ny > 0.5) tmp.set("#ffffff");
    else if (ny < -0.5) tmp.copy(c).multiplyScalar(0.5);
    else {
      const t = 0.5 - pos.getY(i);
      if (t < 0.5) tmp.copy(a).lerp(b, t * 2);
      else tmp.copy(b).lerp(c, (t - 0.5) * 2);
      if (nor.getX(i) > 0.5) tmp.multiplyScalar(0.74);
    }
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  cache.set(name, g);
  return g;
}

export function useGradientMaterial(opacity = 1) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity }), [opacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export type KindColors = Record<"native" | "google" | "free" | "optional" | "lead" | "neutral" | "hermes" | "economy", THREE.Color>;

const FALLBACK: Record<keyof KindColors, string> = {
  native: "#3ddc84",
  google: "#2ad8c4",
  free: "#ff8a3d",
  optional: "#6b7177",
  lead: "#05d7fd",
  neutral: "#9aa0a6",
  hermes: "#da77f2",
  economy: "#4dabf7",
};

function read(): KindColors {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as KindColors;
  (Object.keys(FALLBACK) as (keyof KindColors)[]).forEach((k) => {
    const raw = cs.getPropertyValue(`--kind-${k}`).trim() || FALLBACK[k];
    const c = new THREE.Color();
    try {
      c.set(raw);
    } catch {
      c.set(FALLBACK[k]);
    }
    out[k] = c;
  });
  return out;
}

/** Legend kind colours from CSS variables; re-read when the html class (theme) changes. */
export function useKindColors(): KindColors {
  const [colors, setColors] = useState<KindColors>(() => {
    const out = {} as KindColors;
    (Object.keys(FALLBACK) as (keyof KindColors)[]).forEach((k) => (out[k] = new THREE.Color(FALLBACK[k])));
    return out;
  });
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const update = () => {
      setColors(read());
      invalidate();
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [invalidate]);
  return colors;
}

/** Soft teal radial glow plane under the scene (additive). */
export function Glow({ size = 30, y = -0.3, opacity = 0.55 }: { size?: number; y?: number; opacity?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(42,216,196,1)");
    g.addColorStop(1, "rgba(42,216,196,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Fit the ortho zoom to the canvas box. */
export function FitZoom({ width, height }: { width: number; height: number }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.zoom = Math.min(size.width / width, size.height / height);
    camera.updateProjectionMatrix();
  }, [camera, size, width, height]);
  return null;
}
