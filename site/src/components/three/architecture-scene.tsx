"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { createSpring, springs, type Spring } from "@usefluid/motion";
import { memo, type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Graph, GraphEdge, GraphNode, Kind } from "@/content/architecture";
import { ArchitecturePoster } from "./architecture-poster";
import { FitZoom, Glow, gradientBox, useGradientMaterial, useKindColors, type KindColors, type PaletteName } from "./iso-3d";
import { SceneFrame } from "./scene-frame";

type Props = {
  graph: Graph;
  visibleIds?: string[];
  highlightId?: string | null;
  explode?: number;
  onSelect?: (id: string) => void;
};

const S = 0.01; // viewBox px -> scene units
const SLAB = 0.16;
const LAYER_GAP = 1.6;

const PALETTE: Record<Kind, PaletteName> = {
  lead: "cool",
  native: "cool",
  neutral: "cool",
  google: "mint",
  economy: "mint",
  free: "warm",
  hermes: "warm",
  optional: "grey",
};
const HEIGHT: Record<Kind, number> = { lead: 1.6, native: 0.9, google: 0.8, hermes: 0.8, free: 0.7, economy: 0.6, neutral: 0.5, optional: 0.35 };
const KIND_COLOR_KEY = (k: Kind): keyof KindColors => (k === "hermes" ? "free" : k === "economy" ? "google" : k);

type Ctx = { lift: number };

function buildLayout(graph: Graph) {
  const cx = graph.viewBox[0] / 2;
  const cz = graph.viewBox[1] / 2;
  const toXZ = (x: number, y: number): [number, number] => [(x - cx) * S, (y - cz) * S];
  const ys = [...new Set(graph.groups.map((g) => g.y))].sort((a, b) => a - b);
  const rankOf = new Map<string, number>([["root", 0]]);
  graph.groups.forEach((g) => rankOf.set(g.id, ys.indexOf(g.y) + 1));
  const nodes = new Map<string, { n: GraphNode; p: [number, number]; size: [number, number]; rank: number }>();
  graph.nodes.forEach((n) => {
    const p = toXZ(n.x + n.w / 2, n.y + n.h / 2);
    nodes.set(n.id, { n, p, size: [n.w * S * 0.9, n.h * S * 0.9], rank: rankOf.get(n.group) ?? 0 });
  });
  const groups = graph.groups.map((g) => ({ g, p: toXZ(g.x + g.w / 2, g.y + g.h / 2), size: [g.w * S, g.h * S] as [number, number], rank: rankOf.get(g.id) ?? 0 }));
  return { nodes, groups };
}
type Layout = ReturnType<typeof buildLayout>;

/** Lazy spring held in a ref; call the returned getter inside frame callbacks. */
function useSpring(initial: number, config: { w: number; z: number } = springs.soft) {
  const r = useRef<Spring | null>(null);
  return useCallback(() => (r.current ??= createSpring(initial, config)), [initial, config]);
}

/* ------------------------------------------------------------------ pieces */

const Slab = memo(function Slab({ item, ctx, visible }: { item: Layout["groups"][number]; ctx: RefObject<Ctx>; visible: boolean }) {
  const dashed = !!item.g.dashed;
  const mat = useGradientMaterial(dashed ? 0.42 : 0.8);
  const vis = useSpring(visible ? 1 : 0);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    vis().target = visible ? 1 : 0;
    vis().step(Math.min(dt, 0.05));
    const m = ref.current;
    if (!m) return;
    m.position.y = item.rank * ctx.current.lift - SLAB / 2;
    m.scale.set(item.size[0] * vis().value, SLAB, item.size[1] * vis().value);
    m.visible = vis().value > 0.01;
  });
  return (
    <mesh ref={ref} geometry={gradientBox(dashed ? "cool" : "grey")} material={mat} position={[item.p[0], 0, item.p[1]]} dispose={null} />
  );
});

/** Parallel lane strips on the worker slab. */
const Tracks = memo(function Tracks({ item, xs, ctx, visible }: { item: Layout["groups"][number]; xs: number[]; ctx: RefObject<Ctx>; visible: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.position.y = item.rank * ctx.current.lift + 0.005;
    g.visible = visible;
  });
  return (
    <group ref={ref} position={[0, 0, item.p[1]]}>
      {xs.map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, item.size[1] * 0.86]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.14} />
        </mesh>
      ))}
    </group>
  );
});

type BlockProps = {
  entry: Layout["nodes"] extends Map<string, infer V> ? V : never;
  ctx: RefObject<Ctx>;
  visible: boolean;
  highlighted: boolean;
  dimmed: boolean;
  color: THREE.Color;
  onSelect?: (id: string) => void;
};

const Block = memo(function Block({ entry, ctx, visible, highlighted, dimmed, color, onSelect }: BlockProps) {
  const { n, p, size, rank } = entry;
  const h = HEIGHT[n.kind];
  const mat = useGradientMaterial(1);
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const hover = useRef(false);
  const vis = useSpring(visible ? 1 : 0, springs.snappy);
  const hi = useSpring(0, springs.snappy);
  const dim = useSpring(0, springs.soft);
  const setHover = (v: boolean, el?: HTMLElement) => {
    hover.current = v;
    if (el) el.style.cursor = v ? "pointer" : "";
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    vis().target = visible ? 1 : 0;
    hi().target = highlighted || hover.current ? 1 : 0;
    dim().target = dimmed ? 1 : 0;
    vis().step(d);
    hi().step(d);
    dim().step(d);
    const g = group.current;
    const m = mesh.current;
    if (!g || !m) return;
    g.visible = vis().value > 0.01;
    g.position.y = rank * ctx.current.lift + hi().value * 0.4;
    m.scale.set(size[0] * vis().value, h * vis().value, size[1] * vis().value);
    m.position.y = (h * vis().value) / 2;
    mat.opacity = 1 - dim().value * 0.75;
    if (glow.current && glowMat.current) {
      glow.current.visible = hi().value > 0.02;
      glowMat.current.opacity = hi().value * 0.85;
    }
  });
  return (
    <group ref={group} position={[p[0], 0, p[1]]}>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} visible={false}>
        <planeGeometry args={[size[0] + 0.9, size[1] + 0.9]} />
        <meshBasicMaterial ref={glowMat} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh
        ref={mesh}
        geometry={gradientBox(PALETTE[n.kind])}
        material={mat}
        dispose={null}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect?.(n.id);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true, e.nativeEvent.target as HTMLElement);
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => setHover(false, e.nativeEvent.target as HTMLElement)}
      />
    </group>
  );
});

const PACKET_CFG = { w: 4.5, z: 0.9 };
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const Edge = memo(function Edge({
  edge,
  layout,
  ctx,
  visible,
  dimmed,
  color,
  index,
}: {
  edge: GraphEdge;
  layout: Layout;
  ctx: RefObject<Ctx>;
  visible: boolean;
  dimmed: boolean;
  color: THREE.Color;
  index: number;
}) {
  const from = layout.nodes.get(edge.from);
  const to = layout.nodes.get(edge.to);
  const line = useRef<THREE.Mesh>(null);
  const lineMat = useRef<THREE.MeshBasicMaterial>(null);
  const packet = useRef<THREE.Group>(null);
  const vis = useSpring(visible ? 1 : 0, springs.soft);
  const dim = useSpring(0, springs.soft);
  const prog = useSpring(0, PACKET_CFG);
  const clock = useRef(index * 0.37);
  const cycle = useRef(-1);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (!from || !to) return;
    vis().target = visible ? 1 : 0;
    dim().target = dimmed ? 1 : 0;
    vis().step(d);
    dim().step(d);
    clock.current += d;
    const c = Math.floor(clock.current / 3.2);
    if (c !== cycle.current) {
      cycle.current = c;
      prog().jump(0);
      prog().target = 1;
    }
    prog().step(d);
    const m = line.current;
    if (!m || !packet.current) return;
    m.visible = vis().value > 0.01;
    packet.current.visible = m.visible && dim().value < 0.9;
    if (!m.visible) return;
    _a.set(from.p[0], from.rank * ctx.current.lift + 0.05, from.p[1]);
    _b.set(to.p[0], to.rank * ctx.current.lift + 0.05, to.p[1]);
    const len = _a.distanceTo(_b);
    m.position.copy(_a).add(_b).multiplyScalar(0.5);
    m.lookAt(_b);
    m.scale.set(0.05 * vis().value, 0.05 * vis().value, len);
    if (lineMat.current) lineMat.current.opacity = (edge.dashed ? 0.35 : 0.65) * (1 - dim().value * 0.8);
    const t = Math.min(Math.max(prog().value, 0), 1);
    packet.current.position.copy(_a).lerp(_b, t);
    packet.current.scale.setScalar(vis().value * Math.sin(Math.PI * t) * 1.1 + 0.001);
  });
  if (!from || !to) return null;
  return (
    <>
      <mesh ref={line}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={lineMat} color={color} transparent opacity={0.6} />
      </mesh>
      <group ref={packet}>
        <mesh>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
});

/* ------------------------------------------------------------------ world */

function World({ graph, visibleIds, highlightId, explode = 0, onSelect }: Props) {
  const colors = useKindColors();
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const ctxRef = useRef<Ctx>({ lift: 0 });
  const lift = useSpring(0, springs.soft);
  const rig = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const parX = useSpring(0);
  const parY = useSpring(0);

  const visibleSet = useMemo(() => (visibleIds ? new Set(visibleIds) : null), [visibleIds]);
  const isVisible = (id: string) => !visibleSet || visibleSet.has(id);
  const groupVisible = (id: string) => !visibleSet || graph.nodes.some((n) => n.group === id && visibleSet.has(n.id));
  const connected = useMemo(() => {
    if (!highlightId) return null;
    const s = new Set<string>([highlightId]);
    graph.edges.forEach((e) => {
      if (e.from === highlightId) s.add(e.to);
      if (e.to === highlightId) s.add(e.from);
    });
    return s;
  }, [graph, highlightId]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    lift().target = Math.min(Math.max(explode, 0), 1) * LAYER_GAP;
    lift().step(d);
    ctxRef.current.lift = lift().value;
    parX().target = dragging.current ? 0 : state.pointer.x;
    parY().target = dragging.current ? 0 : state.pointer.y;
    parX().step(d);
    parY().step(d);
    if (rig.current) {
      rig.current.rotation.y = parX().value * 0.05;
      rig.current.rotation.x = -parY().value * 0.03;
    }
  });

  const workerXs = useMemo(() => graph.nodes.filter((n) => n.group === "workers").map((n) => layout.nodes.get(n.id)!.p[0]), [graph, layout]);
  const az = Math.PI / 4;
  const rad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <>
      <FitZoom width={21} height={17} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        target={[0, 1.5, 0]}
        minAzimuthAngle={az - rad(35)}
        maxAzimuthAngle={az + rad(35)}
        minPolarAngle={rad(46)}
        maxPolarAngle={rad(64)}
        onStart={() => (dragging.current = true)}
        onEnd={() => (dragging.current = false)}
      />
      <Glow />
      <group ref={rig}>
        {layout.groups.map((item) => (
          <Slab key={item.g.id} item={item} ctx={ctxRef} visible={groupVisible(item.g.id)} />
        ))}
        {layout.groups
          .filter((i) => i.g.id === "workers")
          .map((item) => (
            <Tracks key="tracks" item={item} xs={workerXs} ctx={ctxRef} visible={groupVisible(item.g.id)} />
          ))}
        {graph.edges.map((e, i) => (
          <Edge
            key={e.id}
            edge={e}
            index={i}
            layout={layout}
            ctx={ctxRef}
            visible={isVisible(e.from) && isVisible(e.to)}
            dimmed={!!connected && !(e.from === highlightId || e.to === highlightId)}
            color={colors[KIND_COLOR_KEY(e.kind)]}
          />
        ))}
        {graph.nodes.map((n) => (
          <Block
            key={n.id}
            entry={layout.nodes.get(n.id)!}
            ctx={ctxRef}
            visible={isVisible(n.id)}
            highlighted={highlightId === n.id}
            dimmed={!!connected && highlightId !== n.id}
            color={colors[KIND_COLOR_KEY(n.kind)]}
            onSelect={onSelect}
          />
        ))}
      </group>
    </>
  );
}

/** 3D lift of the architecture graph. The canvas is aria-hidden: the 2D figure keeps the accessible content. */
export default function ArchitectureScene(props: Props) {
  return (
    <SceneFrame aspect={16 / 10} poster={<ArchitecturePoster />}>
      <World {...props} />
    </SceneFrame>
  );
}
