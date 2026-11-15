"use client";

import { useFrame } from "@react-three/fiber";
import { createSpring, springs } from "@usefluid/motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FitZoom, Glow, gradientBox, useGradientMaterial, useKindColors, type PaletteName } from "./iso-3d";
import { SceneFrame } from "./scene-frame";
import { FUNNEL_STAGE_Y, TokenFunnelArt } from "./token-funnel-poster";

type Mode = "measured" | "claim";

/** README "Measured, not promised": 14.6% total. docs/01-architecture.md: RTK claim 15-30%. */
const RTK_MEASURED = 0.146;
const RTK_CLAIM: [number, number] = [0.15, 0.3];
/** Visual only, never shown as numbers: caveman and graphify are "not measured yet". */
const ILLUSTRATIVE_CUT = [0.35, 0.4] as const;

const N = 150;
const TOP = 9;
const BOTTOM = -0.6;
const RANGE = TOP - BOTTOM;
const CENTER_Y = 4;
const VIEW_H = 11;
/** World y of the three stages, derived from the DOM label fractions (screen y ~ 0.816 * world y). */
const STAGE_WORLD_Y = FUNNEL_STAGE_Y.map((f) => CENTER_Y + (0.5 - f) * (VIEW_H / 0.816));
const STAGE_PALETTE: PaletteName[] = ["cool", "warm", "mint"];
const STAGE_A = [2.0, 1.7, 1.4];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function Ring({ y, a, palette }: { y: number; a: number; palette: PaletteName }) {
  const mat = useGradientMaterial(1);
  const geo = gradientBox(palette);
  const t = 0.3;
  const hole = a * 0.62;
  const bars: [number, number, number, number][] = [
    [0, a - (a - hole) / 2, a * 2, a - hole],
    [0, -(a - (a - hole) / 2), a * 2, a - hole],
    [a - (a - hole) / 2, 0, a - hole, hole * 2],
    [-(a - (a - hole) / 2), 0, a - hole, hole * 2],
  ];
  return (
    <group position={[0, y, 0]}>
      {bars.map(([x, z, w, d], i) => (
        <mesh key={i} geometry={geo} material={mat} position={[x, -t / 2, z]} scale={[w, t, d]} dispose={null} />
      ))}
    </group>
  );
}

function Particles({ mode }: { mode: Mode }) {
  const colors = useKindColors();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cut1 = useMemo(() => createSpring(RTK_MEASURED, springs.soft), []);
  const clock = useRef(0);
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        // deterministic pseudo-random, stable across renders
        const f = (k: number) => {
          const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
          return x - Math.floor(x);
        };
        return { phase: i / N, x: f(1) * 2 - 1, z: f(2) * 2 - 1, r: (i + 0.5) / N, spin: f(3) * 4 };
      }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const grey = useMemo(() => new THREE.Color("#8a8f94"), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const bright = useMemo(() => new THREE.Color(), []);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    clock.current += d;
    const m = mesh.current;
    if (!m) return;
    if (modeRef.current === "measured") cut1.target = RTK_MEASURED;
    else cut1.target = Math.floor(clock.current / 2.4) % 2 === 0 ? RTK_CLAIM[0] : RTK_CLAIM[1];
    cut1.step(d);
    const c1 = cut1.value;
    const c2 = c1 + (1 - c1) * ILLUSTRATIVE_CUT[0];
    const c3 = c2 + (1 - c2) * ILLUSTRATIVE_CUT[1];
    const cum = [c1, c2, c3];
    bright.copy(colors.lead).lerp(tmp.set("#ffffff"), 0.35);
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const y = TOP - ((clock.current * 2.2 + s.phase * RANGE) % RANGE);
      const spread = 0.35 + 1.15 * smooth(BOTTOM, TOP, y);
      let scale = 1;
      let passed = 0;
      for (let k = 0; k < 3; k++) {
        const sy = STAGE_WORLD_Y[k];
        const through = smooth(sy + 0.5, sy - 0.25, y);
        if (s.r < cum[k]) scale *= 1 - through;
        else passed += through;
      }
      dummy.position.set(s.x * spread, y, s.z * spread);
      dummy.rotation.set(0, s.spin + clock.current * 0.6, 0);
      const base = 0.13 + (passed / 3) * 0.07;
      dummy.scale.set(base * 1.6 * scale, base * 0.5 * scale, base * scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tmp.copy(grey).lerp(bright, passed / 3));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function World({ mode }: { mode: Mode }) {
  return (
    <>
      <FitZoom width={14} height={VIEW_H} />
      <group position={[0, -CENTER_Y, 0]}>
        <Glow size={14} y={-0.4} />
        {STAGE_WORLD_Y.map((y, i) => (
          <Ring key={i} y={y} a={STAGE_A[i]} palette={STAGE_PALETTE[i]} />
        ))}
        <Particles mode={mode} />
      </group>
    </>
  );
}

export default function TokenFunnel() {
  const t = useTranslations("three.funnel");
  const [mode, setMode] = useState<Mode>("measured");
  const labels = [
    { name: t("stageRtk"), note: mode === "measured" ? t("rtkMeasured") : t("rtkClaim") },
    { name: t("stageCaveman"), note: t("notMeasured") },
    { name: t("stageGraphify"), note: t("notMeasured") },
  ];
  return (
    <figure className="m-0" aria-label={t("figureLabel")}>
      <SceneFrame
        aspect={5 / 4}
        cameraPosition={[14, 14, 14]}
        poster={<TokenFunnelArt />}
        overlay={
          <ul className="pointer-events-none absolute inset-y-0 left-0 m-0 list-none p-0 text-xs">
            {labels.map((l, i) => (
              <li key={l.name} className="absolute left-3 w-36 -translate-y-1/2 bg-background/70 px-2 py-1 sm:w-44" style={{ top: `${FUNNEL_STAGE_Y[i] * 100}%` }}>
                <span className="block font-medium text-foreground">{l.name}</span>
                <span className="block text-muted-foreground">{l.note}</span>
              </li>
            ))}
          </ul>
        }
      >
        <World mode={mode} />
      </SceneFrame>
      <div role="group" aria-label={t("modeLabel")} className="mt-4 flex gap-2">
        {(["measured", "claim"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className="min-h-11 border border-border px-4 text-sm text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            {m === "measured" ? t("modeMeasured") : t("modeClaim")}
          </button>
        ))}
      </div>
      <figcaption className="mt-4 text-sm text-muted-foreground">
        <p>{mode === "measured" ? t("sourceMeasured") : t("sourceClaim")}</p>
        <p className="mt-2">{t("illustrative")}</p>
      </figcaption>
    </figure>
  );
}
