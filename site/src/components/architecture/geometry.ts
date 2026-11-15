import { fitPath, parsePath, serializePath } from "@usefluid/motion";
import {
  architecture,
  workflow,
  type Graph,
  type GraphEdge,
  type GraphNode,
  type Kind,
} from "@/content/architecture";
import { logo } from "@/lib/logo";

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = [number, number];
export type Layout = { vb: [number, number]; nodes: Record<string, Rect>; groups: Record<string, Rect> };
export type Route = {
  d: string;
  pts: Pt[];
  cum: number[];
  len: number;
  head: { x: number; y: number; angle: number };
  label: Pt;
};
export type ViewId = Graph["id"];

export const GRAPHS: Record<ViewId, Graph> = { architecture, workflow };

/** CSS custom property that carries the colour of a kind (defined in the module CSS). */
export const kindVar = (kind: Kind) => `var(--k-${kind})`;

/* ------------------------------------------------------------------ union of both graphs */

export type NodeItem = { id: string; a?: GraphNode; w?: GraphNode; shared: boolean };

export const NODE_ITEMS: NodeItem[] = (() => {
  const map = new Map<string, NodeItem>();
  for (const n of architecture.nodes) map.set(n.id, { id: n.id, a: n, shared: false });
  for (const n of workflow.nodes) {
    const prev = map.get(n.id);
    if (prev) {
      prev.w = n;
      prev.shared = true;
    } else map.set(n.id, { id: n.id, w: n, shared: false });
  }
  return [...map.values()];
})();

/* ------------------------------------------------------------------ shapes (all cubic, so they morph) */

const f = (n: number) => Math.round(n * 100) / 100;

export function rectPath(w: number, h: number): string {
  const t = (a: number) => f(a);
  return (
    `M0 0C${t(w / 3)} 0 ${t((2 * w) / 3)} 0 ${t(w)} 0` +
    `C${t(w)} ${t(h / 3)} ${t(w)} ${t((2 * h) / 3)} ${t(w)} ${t(h)}` +
    `C${t((2 * w) / 3)} ${t(h)} ${t(w / 3)} ${t(h)} 0 ${t(h)}` +
    `C0 ${t((2 * h) / 3)} 0 ${t(h / 3)} 0 0Z`
  );
}

export function ellipsePath(w: number, h: number): string {
  const k = 0.5523;
  const rx = w / 2;
  const ry = h / 2;
  return (
    `M${f(rx)} 0C${f(rx + rx * k)} 0 ${f(w)} ${f(ry - ry * k)} ${f(w)} ${f(ry)}` +
    `C${f(w)} ${f(ry + ry * k)} ${f(rx + rx * k)} ${f(h)} ${f(rx)} ${f(h)}` +
    `C${f(rx - rx * k)} ${f(h)} 0 ${f(ry + ry * k)} 0 ${f(ry)}` +
    `C0 ${f(ry - ry * k)} ${f(rx - rx * k)} 0 ${f(rx)} 0Z`
  );
}

export function shapePath(node: GraphNode | undefined, w: number, h: number): string {
  return node?.shape === "ellipse" ? ellipsePath(w, h) : rectPath(w, h);
}

/** The logo fitted into the node's local box (square of side h, centred horizontally). */
export function logoPath(w: number, h: number): string {
  const side = Math.min(w, h);
  const fitted = parsePath(fitPath(logo, side, Math.max(2, side * 0.08)));
  const dx = (w - side) / 2;
  const dy = (h - side) / 2;
  return serializePath(
    fitted.map((c) => {
      if (c.c === "M") return { ...c, x: c.x + dx, y: c.y + dy };
      if (c.c === "C") return { ...c, x1: c.x1 + dx, y1: c.y1 + dy, x2: c.x2 + dx, y2: c.y2 + dy, x: c.x + dx, y: c.y + dy };
      return c;
    }),
  );
}

/* ------------------------------------------------------------------ desktop layout = the data coordinates */

export function desktopLayout(g: Graph): Layout {
  const nodes: Layout["nodes"] = {};
  const groups: Layout["groups"] = {};
  for (const n of g.nodes) nodes[n.id] = { x: n.x, y: n.y, w: n.w, h: n.h };
  for (const gr of g.groups) groups[gr.id] = { x: gr.x, y: gr.y, w: gr.w, h: gr.h };
  return { vb: g.viewBox, nodes, groups };
}

/* ------------------------------------------------------------------ mobile layout (stacked groups) */

const M_LABEL_FS = 14;
const M_SUB_FS = 12;
const CHAR = 0.6;

function wrapCount(text: string, fs: number, width: number): number {
  const per = Math.max(4, Math.floor(width / (fs * CHAR)));
  let lines = 1;
  let cur = 0;
  for (const word of text.split(/\s+/)) {
    const len = word.length;
    if (cur === 0) cur = len;
    else if (cur + 1 + len <= per) cur += 1 + len;
    else {
      lines++;
      cur = len;
    }
    while (cur > per) {
      lines++;
      cur -= per;
    }
  }
  return lines;
}

function nodeHeight(n: GraphNode, w: number): number {
  const inner = w - 20;
  let h = 18 + wrapCount(n.label, M_LABEL_FS, inner) * M_LABEL_FS * 1.3;
  for (const s of n.sub ?? []) h += wrapCount(s, M_SUB_FS, inner) * M_SUB_FS * 1.3;
  return Math.ceil(Math.max(h + 6, 46));
}

export function mobileLayout(g: Graph, width: number): Layout {
  const W = Math.max(240, width);
  const nodes: Layout["nodes"] = {};
  const groups: Layout["groups"] = {};
  const GAP = 46;
  let y = 52; // room above for the back-edge lane
  const placeRoot = (n: GraphNode) => {
    const w = n.shape === "ellipse" ? Math.min(190, W - 24) : W - 24;
    const h = n.shape === "ellipse" ? 62 : nodeHeight(n, w);
    nodes[n.id] = { x: (W - w) / 2, y, w, h };
    y += h + GAP;
  };
  for (const n of g.nodes.filter((n) => n.group === "root")) placeRoot(n);
  for (const gr of g.groups) {
    const members = g.nodes.filter((n) => n.group === gr.id);
    if (!members.length) continue;
    const gx = 12;
    const gw = W - 24;
    const cols = W >= 340 && members.length >= 3 ? 2 : 1;
    const pad = 12;
    const gap = 12;
    const cw = (gw - pad * 2 - gap * (cols - 1)) / cols;
    const top = y;
    let cy = top + 38;
    for (let i = 0; i < members.length; i += cols) {
      const row = members.slice(i, i + cols);
      const rh = Math.max(...row.map((n) => nodeHeight(n, row.length === 1 && cols === 2 ? gw - pad * 2 : cw)));
      row.forEach((n, j) => {
        const full = row.length === 1 && cols === 2;
        nodes[n.id] = { x: gx + pad + (full ? 0 : j * (cw + gap)), y: cy, w: full ? gw - pad * 2 : cw, h: rh };
      });
      cy += rh + (i + cols < members.length ? gap + 8 : 0);
    }
    const gh = cy + pad - top;
    groups[gr.id] = { x: gx, y: top, w: gw, h: gh };
    y = top + gh + GAP;
  }
  return { vb: [W, y - GAP + 16], nodes, groups };
}

/* ------------------------------------------------------------------ edge routing */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function polyline(points: Pt[], radius: number): { d: string; pts: Pt[] } {
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1];
    const c = points[i];
    const n = points[i + 1];
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const a: Pt = [c[0] + ((p[0] - c[0]) / l1) * r, c[1] + ((p[1] - c[1]) / l1) * r];
    const b: Pt = [c[0] + ((n[0] - c[0]) / l2) * r, c[1] + ((n[1] - c[1]) / l2) * r];
    d += `L${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
    out.push(a);
    for (let s = 1; s < 6; s++) {
      const t = s / 6;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    out.push(b);
  }
  const last = points[points.length - 1];
  d += `L${f(last[0])} ${f(last[1])}`;
  out.push(last);
  return { d, pts: out };
}

function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt): { d: string; pts: Pt[] } {
  const pts: Pt[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const u = 1 - t;
    pts.push([
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ]);
  }
  return {
    d: `M${f(a[0])} ${f(a[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(b[0])} ${f(b[1])}`,
    pts,
  };
}

function finish(shape: { d: string; pts: Pt[] }, label?: Pt): Route {
  const cum = [0];
  for (let i = 1; i < shape.pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(shape.pts[i][0] - shape.pts[i - 1][0], shape.pts[i][1] - shape.pts[i - 1][1]));
  }
  const len = cum[cum.length - 1] || 1;
  const e = shape.pts[shape.pts.length - 1];
  let k = shape.pts.length - 2;
  while (k > 0 && Math.hypot(e[0] - shape.pts[k][0], e[1] - shape.pts[k][1]) < 2) k--;
  const s = shape.pts[k];
  const angle = (Math.atan2(e[1] - s[1], e[0] - s[0]) * 180) / Math.PI;
  return { d: shape.d, pts: shape.pts, cum, len, head: { x: e[0], y: e[1], angle }, label: label ?? pointAt({ pts: shape.pts, cum, len }, 0.5) };
}

export function pointAt(r: { pts: Pt[]; cum: number[]; len: number }, t: number): Pt {
  const dist = clamp(t, 0, 1) * r.len;
  let lo = 0;
  let hi = r.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.cum[mid] <= dist) lo = mid;
    else hi = mid;
  }
  const span = r.cum[hi] - r.cum[lo] || 1;
  const k = (dist - r.cum[lo]) / span;
  return [r.pts[lo][0] + (r.pts[hi][0] - r.pts[lo][0]) * k, r.pts[lo][1] + (r.pts[hi][1] - r.pts[lo][1]) * k];
}

function segmentHitsRect(a: Pt, b: Pt, r: Rect, pad: number): boolean {
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  return maxX > r.x - pad && minX < r.x + r.w + pad && maxY > r.y - pad && minY < r.y + r.h + pad;
}

export function routeEdge(e: GraphEdge, layout: Layout): Route | null {
  const A = layout.nodes[e.from];
  const B = layout.nodes[e.to];
  if (!A || !B) return null;
  const vbW = layout.vb[0];
  const acx = A.x + A.w / 2;
  const acy = A.y + A.h / 2;
  const bcx = B.x + B.w / 2;
  const bcy = B.y + B.h / 2;
  const gap = B.y - (A.y + A.h);

  if (gap >= 40) {
    const ax = clamp(bcx, A.x + 24, A.x + A.w - 24);
    const bx = clamp(ax, B.x + 24, B.x + B.w - 24);
    const ay = A.y + A.h;
    const my = (ay + B.y) / 2;
    if (Math.abs(ax - bx) < 1) return finish(polyline([[ax, ay], [bx, B.y]], 0));
    return finish(cubic([ax, ay], [ax, my], [bx, my], [bx, B.y]));
  }
  if (gap >= 0) {
    const fromLeft = bcx < acx;
    const start: Pt = [fromLeft ? A.x : A.x + A.w, acy];
    return finish(polyline([start, [bcx, acy], [bcx, B.y]], 14));
  }
  if (B.y + B.h <= A.y) {
    const laneX = vbW - 14;
    const laneY = Math.max(14, B.y - 44);
    return finish(
      polyline([[A.x + A.w, acy], [laneX, acy], [laneX, laneY], [bcx, laneY], [bcx, B.y]], 16),
      [(bcx + laneX) / 2, laneY - 8],
    );
  }
  // same band: straight, unless another node sits in between
  const right = bcx > acx;
  const ax = right ? A.x + A.w : A.x;
  const bx = right ? B.x : B.x + B.w;
  const probeA: Pt = [Math.min(ax, bx), Math.min(acy, bcy)];
  const probeB: Pt = [Math.max(ax, bx), Math.max(acy, bcy)];
  const blocked = Object.entries(layout.nodes).some(
    ([id, r]) => id !== e.from && id !== e.to && segmentHitsRect(probeA, probeB, r, 2),
  );
  if (blocked) {
    const yU = Math.max(A.y + A.h, B.y + B.h) + 34;
    return finish(
      polyline([[acx, A.y + A.h], [acx, yU], [bcx, yU], [bcx, B.y + B.h]], 14),
      [(acx + bcx) / 2, yU - 8],
    );
  }
  if (Math.abs(acy - bcy) < 2) return finish(polyline([[ax, acy], [bx, bcy]], 0));
  const mx = (ax + bx) / 2;
  return finish(cubic([ax, acy], [mx, acy], [mx, bcy], [bx, bcy]));
}

export function routesFor(g: Graph, layout: Layout): Map<string, Route> {
  const out = new Map<string, Route>();
  for (const e of g.edges) {
    const r = routeEdge(e, layout);
    if (r) out.set(e.id, r);
  }
  return out;
}

/* ------------------------------------------------------------------ camera */

export function boundsOf(layout: Layout, nodeIds: string[], groupIds: string[]): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (r?: Rect) => {
    if (!r) return;
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  };
  for (const id of nodeIds) add(layout.nodes[id]);
  for (const id of groupIds) add(layout.groups[id]);
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Grow `b` by a margin and expand it to `aspect` (w/h), centred. */
export function fitView(b: Rect, aspect: number, margin = 40, minW = 560): Rect {
  let w = Math.max(b.w + margin * 2, minW);
  let h = b.h + margin * 2;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/* ------------------------------------------------------------------ neighbours */

export function neighbours(g: Graph, id: string): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set([id]);
  const edges = new Set<string>();
  for (const e of g.edges) {
    if (e.from === id || e.to === id) {
      edges.add(e.id);
      nodes.add(e.from);
      nodes.add(e.to);
    }
  }
  return { nodes, edges };
}

/** Ids revealed by assembly steps 1..step. */
export function revealed(steps: { nodeIds: string[]; groupIds: string[]; edgeIds: string[] }[], step: number) {
  const nodes = new Set<string>();
  const groups = new Set<string>();
  const edges = new Set<string>();
  steps.slice(0, step).forEach((s) => {
    s.nodeIds.forEach((i) => nodes.add(i));
    s.groupIds.forEach((i) => groups.add(i));
    s.edgeIds.forEach((i) => edges.add(i));
  });
  return { nodes, groups, edges };
}
