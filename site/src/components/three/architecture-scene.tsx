"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { createSpring, springs, type Spring } from "@usefluid/motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Graph, GraphEdge, GraphGroup, GraphNode, Kind } from "@/content/architecture";
import { ArchitecturePoster } from "./architecture-poster";
import { useKindColors, type KindColors } from "./iso-3d";
import { SceneFrame } from "./scene-frame";

type Props = {
  graph: Graph;
  visibleIds?: string[];
  highlightId?: string | null;
  /** kept for API compatibility; the single-floor layout does not explode */
  explode?: number;
  onSelect?: (id: string) => void;
};

const S = 0.01; // viewBox px -> scene units
const PLATE = 0.06;
const HEIGHT: Record<Kind, number> = { lead: 0.7, native: 0.4, google: 0.4, hermes: 0.4, free: 0.4, economy: 0.4, neutral: 0.4, optional: 0.3 };
const AZ = Math.PI / 4;
const rad = (deg: number) => (deg * Math.PI) / 180;

type NodeEntry = { n: GraphNode; p: [number, number]; size: [number, number] };
type GroupEntry = { g: GraphGroup; p: [number, number]; size: [number, number] };

function buildLayout(graph: Graph) {
  const xs: number[] = [];
  const zs: number[] = [];
  [...graph.groups, ...graph.nodes].forEach((o) => {
    xs.push(o.x, o.x + o.w);
    zs.push(o.y, o.y + o.h);
  });
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const toXZ = (x: number, y: number): [number, number] => [(x - cx) * S, (y - cz) * S];
  const nodes = new Map<string, NodeEntry>();
  graph.nodes.forEach((n) => nodes.set(n.id, { n, p: toXZ(n.x + n.w / 2, n.y + n.h / 2), size: [n.w * S * 0.9, n.h * S * 0.9] }));
  const groups: GroupEntry[] = graph.groups.map((g) => ({ g, p: toXZ(g.x + g.w / 2, g.y + g.h / 2), size: [g.w * S, g.h * S] }));
  const half: [number, number] = [((Math.max(...xs) - Math.min(...xs)) / 2) * S, ((Math.max(...zs) - Math.min(...zs)) / 2) * S];
  return { nodes, groups, half };
}
type Layout = ReturnType<typeof buildLayout>;

/** Lazy spring held in a ref; call the returned getter inside frame callbacks. */
function useSpring(initial: number, config: { w: number; z: number } = springs.soft) {
  const r = useRef<Spring | null>(null);
  return useCallback(() => (r.current ??= createSpring(initial, config)), [initial, config]);
}

/* ------------------------------------------------------------------ theme */

type Theme = { plate: THREE.Color; edge: THREE.Color };

function readTheme(): Theme {
  const cs = getComputedStyle(document.documentElement);
  const get = (k: string, fb: string) => cs.getPropertyValue(k).trim() || fb;
  const col = (v: string) => {
    try {
      return new THREE.Color(v);
    } catch {
      return new THREE.Color("#888888");
    }
  };
  const muted = get("--muted-foreground", "#8a8a8a");
  return {
    plate: col(get("--muted", "#141414")),
    edge: col(get("--border", "#1f1f1f")).lerp(col(muted), 0.55),
  };
}

function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => ({ plate: new THREE.Color("#141414"), edge: new THREE.Color("#4a4a4a") }));
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const update = () => {
      setTheme(readTheme());
      invalidate();
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [invalidate]);
  return theme;
}

/* ----------------------------------------------------------------- framing */

/** Fit the ortho zoom so the whole layout (all orbit poses) stays inside the canvas with margin. */
function FitBounds({ half, onZoom }: { half: [number, number]; onZoom: (z: number) => void }) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const tmp = new THREE.OrthographicCamera();
    const dist = camera.position.length();
    const [hx, hz] = [half[0] + 0.25, half[1] + 0.25];
    let zoom = Infinity;
    for (const daz of [-15, 0, 15]) {
      for (const pol of [50, 55, 60]) {
        const az = AZ + rad(daz);
        tmp.position.set(Math.sin(rad(pol)) * Math.sin(az) * dist, Math.cos(rad(pol)) * dist, Math.sin(rad(pol)) * Math.cos(az) * dist);
        tmp.lookAt(0, 0.2, 0);
        tmp.updateMatrixWorld();
        const inv = tmp.matrixWorld.clone().invert();
        const lo = new THREE.Vector3(Infinity, Infinity, 0);
        const hi = new THREE.Vector3(-Infinity, -Infinity, 0);
        for (const x of [-hx, hx])
          for (const z of [-hz, hz])
            for (const y of [0, 1.1]) {
              const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
              lo.min(v);
              hi.max(v);
            }
        zoom = Math.min(zoom, size.width / (hi.x - lo.x), size.height / (hi.y - lo.y));
      }
    }
    camera.zoom = zoom * 0.97;
    camera.updateProjectionMatrix();
    onZoom(camera.zoom);
  }, [camera, size, half, onZoom]);
  return null;
}

/* ------------------------------------------------------------------ pieces */

const Plate = memo(function Plate({ item, theme, visible, zoom, showTitle }: { item: GroupEntry; theme: Theme; visible: boolean; zoom: number; showTitle: boolean }) {
  const dashed = !!item.g.dashed;
  const vis = useSpring(visible ? 1 : 0);
  const root = useRef<THREE.Group>(null);
  const [w, d] = item.size;
  const outline = useMemo(() => {
    const pts = [new THREE.Vector3(-w / 2, 0.004, -d / 2), new THREE.Vector3(w / 2, 0.004, -d / 2), new THREE.Vector3(w / 2, 0.004, d / 2), new THREE.Vector3(-w / 2, 0.004, d / 2), new THREE.Vector3(-w / 2, 0.004, -d / 2)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed ? new THREE.LineDashedMaterial({ color: theme.edge, dashSize: 0.14, gapSize: 0.1 }) : new THREE.LineBasicMaterial({ color: theme.edge });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }, [w, d, dashed, theme.edge]);
  useEffect(
    () => () => {
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
    },
    [outline],
  );
  useFrame((_, dt) => {
    vis().target = visible ? 1 : 0;
    vis().step(Math.min(dt, 0.05));
    const g = root.current;
    if (!g) return;
    g.visible = vis().value > 0.01;
    g.scale.set(vis().value, 1, vis().value);
  });
  return (
    <group ref={root} position={[item.p[0], 0, item.p[1]]}>
      <mesh position={[0, -PLATE / 2, 0]}>
        <boxGeometry args={[w, PLATE, d]} />
        <meshBasicMaterial color={theme.plate} />
      </mesh>
      <primitive object={outline} />
      {visible && showTitle ? (
        <Html position={[-w / 2, 0, -d / 2]} zIndexRange={[10, 0]} pointerEvents="none" aria-hidden style={{ pointerEvents: "none" }}>
          <div aria-hidden style={{ position: "relative", width: 0, height: 0, pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 3,
                whiteSpace: "nowrap",
                transformOrigin: "0 100%",
                transform: "rotate(30deg)",
                fontFamily: "var(--font-mono)",
                fontSize: Math.min(11, Math.max(8, zoom * 0.17)),
                letterSpacing: "0.04em",
                color: "var(--muted-foreground)",
              }}
            >
              {item.g.label}
            </div>
          </div>
        </Html>
      ) : null}
    </group>
  );
});

type BlockProps = {
  entry: NodeEntry;
  visible: boolean;
  highlighted: boolean;
  dimmed: boolean;
  color: THREE.Color;
  zoom: number;
  canvasW: number;
  onSelect?: (id: string) => void;
};

const Block = memo(function Block({ entry, visible, highlighted, dimmed, color, zoom, canvasW, onSelect }: BlockProps) {
  const { n, p, size } = entry;
  const h = HEIGHT[n.kind];
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z. Camera sees +x, +y, +z.
  const mats = useMemo(() => {
    const tone = (k: number) => new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), transparent: true });
    return [tone(0.72), tone(0.5), tone(1), tone(0.45), tone(0.55), tone(0.5)];
  }, [color]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const hover = useRef(false);
  const [hovered, setHovered] = useState(false);
  const vis = useSpring(visible ? 1 : 0, springs.snappy);
  const hi = useSpring(0, springs.snappy);
  const dim = useSpring(0, springs.soft);
  const setHover = (v: boolean, el?: HTMLElement) => {
    hover.current = v;
    setHovered(v);
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
    g.position.y = hi().value * 0.18;
    m.scale.set(size[0] * vis().value, h * vis().value, size[1] * vis().value);
    m.position.y = (h * vis().value) / 2;
    mats.forEach((mt) => (mt.opacity = 1 - dim().value * 0.78));
    if (glow.current && glowMat.current) {
      glow.current.visible = hi().value > 0.02;
      glowMat.current.opacity = hi().value * 0.4;
    }
  });
  const narrow = canvasW < 768;
  const showSub = !narrow && (highlighted || hovered);
  const fs = Math.min(14, Math.max(narrow ? 7 : 8, zoom * 0.21));
  const accent = `#${color.getHexString()}`;
  return (
    <group ref={group} position={[p[0], 0, p[1]]}>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} visible={false}>
        <planeGeometry args={[size[0] + 0.5, size[1] + 0.5]} />
        <meshBasicMaterial ref={glowMat} color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        ref={mesh}
        material={mats}
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
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {visible ? (
        <Html position={[0, h + 0.02, 0]} center zIndexRange={showSub ? [100, 90] : [20, 0]} pointerEvents="none" aria-hidden style={{ pointerEvents: "none" }}>
          <div
            aria-hidden
            style={{
              pointerEvents: "none",
              width: "max-content",
              whiteSpace: "nowrap",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: fs,
              lineHeight: 1.25,
              padding: narrow ? "1px 3px" : "2px 6px",
              background: "color-mix(in srgb, var(--card) 94%, transparent)",
              color: "var(--foreground)",
              border: `1px solid ${highlighted ? accent : "var(--border)"}`,
              borderLeft: `${narrow ? 2 : 3}px solid ${accent}`,
              opacity: dimmed ? 0.3 : 1,
              transition: "opacity 200ms",
            }}
          >
            <div style={{ fontWeight: 700 }}>{n.label}</div>
            {showSub && n.sub?.[0] ? <div style={{ fontSize: "0.85em", color: "var(--muted-foreground)" }}>{n.sub[0]}</div> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
});

const PACKET_CFG = { w: 4.5, z: 0.9 };
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const EDGE_Y = 0.03;

const Edge = memo(function Edge({
  edge,
  layout,
  visible,
  dimmed,
  color,
  index,
}: {
  edge: GraphEdge;
  layout: Layout;
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
    _a.set(from.p[0], EDGE_Y, from.p[1]);
    _b.set(to.p[0], EDGE_Y, to.p[1]);
    const len = _a.distanceTo(_b);
    m.position.copy(_a).add(_b).multiplyScalar(0.5);
    m.lookAt(_b);
    m.scale.set((edge.dashed ? 0.05 : 0.07) * vis().value, 0.02, len);
    if (lineMat.current) lineMat.current.opacity = (edge.dashed ? 0.4 : 0.9) * (1 - dim().value * 0.8);
    const t = Math.min(Math.max(prog().value, 0), 1);
    packet.current.position.copy(_a).lerp(_b, t);
    packet.current.position.y = EDGE_Y + 0.05;
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
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.18, 10, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
});

/* ------------------------------------------------------------------ world */

function World({ graph, visibleIds, highlightId, onSelect }: Props) {
  const colors: KindColors = useKindColors();
  const theme = useTheme();
  const layout = useMemo(() => buildLayout(graph), [graph]);
  const rig = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const parX = useSpring(0);
  const parY = useSpring(0);
  const [zoom, setZoom] = useState(50);
  const canvasW = useThree((s) => s.size.width);
  const gl = useThree((s) => s.gl);
  // true-to-token colours: no filmic tone mapping on flat shaded blocks
  useEffect(() => {
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

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
    parX().target = dragging.current ? 0 : state.pointer.x;
    parY().target = dragging.current ? 0 : state.pointer.y;
    parX().step(d);
    parY().step(d);
    if (rig.current) {
      rig.current.rotation.y = parX().value * 0.03;
      rig.current.rotation.x = -parY().value * 0.02;
    }
  });

  return (
    <>
      <FitBounds half={layout.half} onZoom={setZoom} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.2, 0]}
        minAzimuthAngle={AZ - rad(15)}
        maxAzimuthAngle={AZ + rad(15)}
        minPolarAngle={rad(50)}
        maxPolarAngle={rad(60)}
        onStart={() => (dragging.current = true)}
        onEnd={() => (dragging.current = false)}
      />
      <group ref={rig}>
        {layout.groups.map((item) => (
          <Plate key={item.g.id} item={item} theme={theme} visible={groupVisible(item.g.id)} zoom={zoom} showTitle={canvasW >= 520} />
        ))}
        {graph.edges.map((e, i) => (
          <Edge
            key={e.id}
            edge={e}
            index={i}
            layout={layout}
            visible={isVisible(e.from) && isVisible(e.to)}
            dimmed={!!connected && !(e.from === highlightId || e.to === highlightId)}
            color={colors[e.kind]}
          />
        ))}
        {graph.nodes.map((n) => (
          <Block
            key={n.id}
            entry={layout.nodes.get(n.id)!}
            visible={isVisible(n.id)}
            highlighted={highlightId === n.id}
            dimmed={!!connected && !connected.has(n.id)}
            color={colors[n.kind]}
            zoom={zoom}
            canvasW={canvasW}
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
    <SceneFrame aspect={16 / 10} poster={<ArchitecturePoster />} className="lg:h-full max-lg:absolute max-lg:inset-x-0 max-lg:top-1/2 max-lg:-translate-y-1/2">
      <World {...props} />
    </SceneFrame>
  );
}
