import { createSpring, play, springs, type Spring } from "@usefluid/motion";
import { ellipsePath, pointAt, rectPath, type Layout, type Rect, type Route } from "./geometry";

/**
 * Imperative scene driver. React renders a static SVG tree; this class owns every
 * per-frame write (transforms, opacity, stroke-dashoffset, viewBox, packets) so that
 * nothing setStates per frame and nothing reads layout. One Fluid ticker (a single
 * rAF) drives all springs, packets and timers.
 */

const POS = { w: 15, z: 0.86 };
const CAM = { w: 9, z: 0.95 };
const TRAVEL = { w: 4.6, z: 1 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const f2 = (n: number) => Math.round(n * 100) / 100;

type Pending = { at: number; v: number } | null;

type NodeState = {
  id: string;
  g: SVGGElement;
  path: SVGPathElement | null;
  fo: SVGForeignObjectElement | null;
  ta: HTMLElement | null;
  tw: HTMLElement | null;
  ellipse: boolean;
  x: Spring;
  y: Spring;
  w: Spring;
  h: Spring;
  vis: Spring;
  pending: Pending;
  dirty: boolean;
};
type EdgeState = {
  id: string;
  g: SVGGElement;
  line: SVGPathElement;
  solid: boolean;
  draw: Spring;
  pending: Pending;
  dirty: boolean;
};
type GroupState = { id: string; g: SVGGElement; vis: Spring; pending: Pending; dirty: boolean };
type Packet = {
  el: SVGCircleElement;
  spring: Spring;
  route: Route;
  dir: 1 | -1;
  startAt: number;
  batch: Batch;
};
type Batch = { remaining: number; resolve: (ok: boolean) => void };
type Sleeper = { at: number; resolve: (ok: boolean) => void };

export type PacketItem = { edge: string; dir?: 1 | -1; delay?: number };

export class SceneController {
  private svg: SVGSVGElement | null = null;
  private nodes = new Map<string, NodeState>();
  private edges = new Map<string, EdgeState>();
  private groups = new Map<string, GroupState>();
  private frame: { path: SVGPathElement; draw: Spring; pending: Pending; dirty: boolean } | null = null;
  private cam = { x: createSpring(0, CAM), y: createSpring(0, CAM), w: createSpring(1500, CAM), h: createSpring(1160, CAM) };
  private camDirty = true;
  private tview = createSpring(0, springs.soft);
  private tviewDirty = true;
  private routes = new Map<string, { route: Route; kind: string }>();
  private pool: SVGCircleElement[] = [];
  private packets: Packet[] = [];
  private sleepers: Sleeper[] = [];
  private stop: (() => void) | null = null;
  private ui = 0; // always-advancing clock (seconds)
  private clock = 0; // advances only while unpaused (seconds)
  private paused = false;
  private noPackets = false;
  private ready = false;

  /** collect the elements React rendered; call once after mount */
  bind(svg: SVGSVGElement) {
    this.svg = svg;
    this.nodes.clear();
    this.edges.clear();
    this.groups.clear();
    svg.querySelectorAll<SVGGElement>("[data-node]").forEach((g) => {
      const id = g.dataset.node as string;
      const ellipse = g.dataset.shape === "ellipse";
      this.nodes.set(id, {
        id,
        g,
        path: g.dataset.morph ? null : g.querySelector<SVGPathElement>("[data-rect]"),
        fo: g.querySelector<SVGForeignObjectElement>("foreignObject"),
        ta: g.querySelector<HTMLElement>("[data-t='a']"),
        tw: g.querySelector<HTMLElement>("[data-t='w']"),
        ellipse,
        x: createSpring(0, POS),
        y: createSpring(0, POS),
        w: createSpring(100, POS),
        h: createSpring(60, POS),
        vis: createSpring(0, springs.soft),
        pending: null,
        dirty: true,
      });
    });
    svg.querySelectorAll<SVGGElement>("[data-edge]").forEach((g) => {
      const id = g.dataset.edge as string;
      this.edges.set(id, {
        id,
        g,
        line: g.querySelector<SVGPathElement>("[data-line]") as SVGPathElement,
        solid: g.dataset.solid === "1",
        draw: createSpring(0, springs.soft),
        pending: null,
        dirty: true,
      });
    });
    svg.querySelectorAll<SVGGElement>("[data-group]").forEach((g) => {
      const id = g.dataset.group as string;
      this.groups.set(id, { id, g, vis: createSpring(0, springs.soft), pending: null, dirty: true });
    });
    const fr = svg.querySelector<SVGPathElement>("[data-frame]");
    this.frame = fr ? { path: fr, draw: createSpring(0, springs.soft), pending: null, dirty: true } : null;
    this.pool = [...svg.querySelectorAll<SVGCircleElement>("[data-packet]")];
    this.ready = true;
    this.wake();
  }

  /* ---------------------------------------------------------------- targets */

  setLayout(layout: Layout, view: "architecture" | "workflow", immediate: boolean) {
    this.tview.target = view === "workflow" ? 1 : 0;
    if (immediate) this.tview.jump(this.tview.target);
    this.tviewDirty = true;
    for (const [id, n] of this.nodes) {
      const r = layout.nodes[id];
      if (!r) continue;
      this.assignRect(n, r, immediate);
    }
    this.wake();
  }

  private assignRect(n: NodeState, r: Rect, immediate: boolean) {
    n.x.target = r.x;
    n.y.target = r.y;
    n.w.target = r.w;
    n.h.target = r.h;
    if (immediate) {
      n.x.jump(r.x);
      n.y.jump(r.y);
      n.w.jump(r.w);
      n.h.jump(r.h);
    }
    n.dirty = true;
  }

  setCamera(r: Rect, immediate: boolean) {
    this.cam.x.target = r.x;
    this.cam.y.target = r.y;
    this.cam.w.target = r.w;
    this.cam.h.target = r.h;
    if (immediate) {
      this.cam.x.jump(r.x);
      this.cam.y.jump(r.y);
      this.cam.w.jump(r.w);
      this.cam.h.jump(r.h);
    }
    this.camDirty = true;
    this.wake();
  }

  setRoutes(routes: Map<string, Route>, kinds: Map<string, string>) {
    this.routes.clear();
    for (const [id, route] of routes) this.routes.set(id, { route, kind: kinds.get(id) ?? "neutral" });
  }

  visTarget(kind: "node" | "edge" | "group", id: string): number {
    if (kind === "node") return this.nodes.get(id)?.vis.target ?? 0;
    if (kind === "edge") return this.edges.get(id)?.draw.target ?? 0;
    return this.groups.get(id)?.vis.target ?? 0;
  }

  setVis(kind: "node" | "edge" | "group" | "frame", id: string, v: number, delayMs: number, immediate: boolean) {
    const holder =
      kind === "node" ? this.nodes.get(id) : kind === "edge" ? this.edges.get(id) : kind === "group" ? this.groups.get(id) : this.frame;
    if (!holder) return;
    const spring = "vis" in holder ? holder.vis : holder.draw;
    if (immediate) {
      holder.pending = null;
      spring.target = v;
      spring.jump(v);
      holder.dirty = true;
    } else if (delayMs > 0 && v > spring.target) {
      holder.pending = { at: this.ui + delayMs / 1000, v };
    } else {
      holder.pending = null;
      spring.target = v;
    }
    this.wake();
  }

  /** transient highlight used by the Run control and the curator demo */
  setRun(id: string, state: "on" | "fail" | "pass" | null) {
    const el = this.nodes.get(id)?.g;
    if (!el) return;
    if (state) el.dataset.run = state;
    else delete el.dataset.run;
  }
  clearRun() {
    for (const n of this.nodes.values()) delete n.g.dataset.run;
  }

  edgeVisible(id: string): boolean {
    return (this.edges.get(id)?.draw.value ?? 0) > 0.9;
  }

  /* ---------------------------------------------------------------- traffic */

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) this.wake();
  }
  setNoPackets(v: boolean) {
    this.noPackets = v;
  }

  send(items: PacketItem[]): Promise<boolean> {
    if (this.noPackets) return Promise.resolve(true);
    const usable = items.filter((i) => this.routes.has(i.edge) && this.edgeVisible(i.edge));
    if (!usable.length) return Promise.resolve(true);
    return new Promise((resolve) => {
      const batch: Batch = { remaining: 0, resolve };
      for (const item of usable) {
        const el = this.pool.find((p) => !this.packets.some((q) => q.el === p));
        if (!el) continue;
        const r = this.routes.get(item.edge) as { route: Route; kind: string };
        el.dataset.kind = r.kind;
        el.style.opacity = "0";
        el.style.visibility = "visible";
        this.packets.push({
          el,
          spring: Object.assign(createSpring(0, TRAVEL), { target: 1 }),
          route: r.route,
          dir: item.dir ?? 1,
          startAt: this.clock + (item.delay ?? 0) / 1000,
          batch,
        });
        batch.remaining++;
      }
      if (!batch.remaining) resolve(true);
      this.wake();
    });
  }

  sleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.sleepers.push({ at: this.clock + ms / 1000, resolve });
      this.wake();
    });
  }

  /** drop every packet and pending promise (they resolve false) */
  reset() {
    for (const p of this.packets) {
      p.el.style.visibility = "hidden";
      p.batch.resolve(false);
    }
    this.packets = [];
    const s = this.sleepers;
    this.sleepers = [];
    for (const x of s) x.resolve(false);
  }

  /* ---------------------------------------------------------------- loop */

  private wake() {
    if (this.stop || !this.ready) return;
    this.stop = play((dt) => {
      const busy = this.tick(dt);
      if (!busy) this.stop = null;
      return busy;
    });
  }

  dispose() {
    this.reset();
    this.stop?.();
    this.stop = null;
    this.ready = false;
  }

  private tick(dt: number): boolean {
    this.ui += dt;
    let busy = false;
    const tv = this.tview.step(dt);
    if (tv) busy = true;

    for (const n of this.nodes.values()) {
      if (n.pending && this.ui >= n.pending.at) {
        n.vis.target = n.pending.v;
        n.pending = null;
      }
      let moving = n.x.step(dt);
      moving = n.y.step(dt) || moving;
      moving = n.w.step(dt) || moving;
      moving = n.h.step(dt) || moving;
      moving = n.vis.step(dt) || moving;
      if (n.pending) busy = true;
      if (moving || n.dirty || tv || this.tviewDirty) {
        this.writeNode(n);
        n.dirty = false;
      }
      if (moving) busy = true;
    }
    for (const e of this.edges.values()) {
      if (e.pending && this.ui >= e.pending.at) {
        e.draw.target = e.pending.v;
        e.pending = null;
      }
      const moving = e.draw.step(dt);
      if (e.pending) busy = true;
      if (moving || e.dirty) {
        const d = clamp01(e.draw.value);
        if (e.solid) e.line.style.strokeDashoffset = String(f2(1 - d));
        else e.line.style.opacity = String(f2(d));
        const tail = clamp01((d - 0.85) / 0.15);
        e.g.style.setProperty("--tail", String(f2(tail)));
        e.g.style.visibility = d < 0.01 ? "hidden" : "visible";
        e.dirty = false;
      }
      if (moving) busy = true;
    }
    for (const g of this.groups.values()) {
      if (g.pending && this.ui >= g.pending.at) {
        g.vis.target = g.pending.v;
        g.pending = null;
      }
      const moving = g.vis.step(dt);
      if (g.pending) busy = true;
      if (moving || g.dirty) {
        const v = clamp01(g.vis.value);
        g.g.style.opacity = String(f2(v));
        g.g.style.visibility = v < 0.01 ? "hidden" : "visible";
        g.dirty = false;
      }
      if (moving) busy = true;
    }
    if (this.frame) {
      const fr = this.frame;
      if (fr.pending && this.ui >= fr.pending.at) {
        fr.draw.target = fr.pending.v;
        fr.pending = null;
      }
      const moving = fr.draw.step(dt);
      if (fr.pending) busy = true;
      if (moving || fr.dirty) {
        const d = clamp01(fr.draw.value);
        fr.path.style.strokeDashoffset = String(f2(1 - d));
        fr.path.style.visibility = d < 0.01 ? "hidden" : "visible";
        fr.dirty = false;
      }
      if (moving) busy = true;
    }
    {
      const moving = [this.cam.x.step(dt), this.cam.y.step(dt), this.cam.w.step(dt), this.cam.h.step(dt)].some(Boolean);
      if ((moving || this.camDirty) && this.svg) {
        this.svg.setAttribute(
          "viewBox",
          `${f2(this.cam.x.value)} ${f2(this.cam.y.value)} ${f2(this.cam.w.value)} ${f2(this.cam.h.value)}`,
        );
        this.camDirty = false;
      }
      if (moving) busy = true;
    }
    this.tviewDirty = false;

    if (!this.paused) {
      this.clock += dt;
      if (this.stepPackets(dt)) busy = true;
      if (this.sleepers.length) {
        busy = true;
        const due = this.sleepers.filter((s) => this.clock >= s.at);
        if (due.length) {
          this.sleepers = this.sleepers.filter((s) => this.clock < s.at);
          for (const s of due) s.resolve(true);
        }
      }
    } else if (this.packets.length || this.sleepers.length) {
      // frozen while off-screen or hidden: let the loop stop, resume on setPaused(false)
    }
    return busy;
  }

  private writeNode(n: NodeState) {
    const w = n.w.value;
    const h = n.h.value;
    const vis = n.vis.value;
    const s = 0.8 + 0.2 * Math.min(vis, 1.06);
    const cx = n.x.value + w / 2;
    const cy = n.y.value + h / 2;
    n.g.setAttribute("transform", `translate(${f2(cx)} ${f2(cy)}) scale(${f2(s)}) translate(${f2(-w / 2)} ${f2(-h / 2)})`);
    n.g.style.opacity = String(f2(clamp01(vis)));
    n.g.style.visibility = vis < 0.02 ? "hidden" : "visible";
    if (n.path) n.path.setAttribute("d", n.ellipse ? ellipsePath(w, h) : rectPath(w, h));
    if (n.fo) {
      n.fo.setAttribute("width", String(f2(w)));
      n.fo.setAttribute("height", String(f2(h)));
    }
    if (n.ta && n.tw) {
      const t = this.tview.value;
      n.ta.style.opacity = String(f2(clamp01(1 - 2 * t)));
      n.tw.style.opacity = String(f2(clamp01(2 * t - 1)));
    }
  }

  private stepPackets(dt: number): boolean {
    if (!this.packets.length) return false;
    const live: Packet[] = [];
    for (const p of this.packets) {
      if (this.clock < p.startAt) {
        live.push(p);
        continue;
      }
      p.spring.step(dt);
      const t = clamp01(p.spring.value);
      const [x, y] = pointAt(p.route, p.dir === 1 ? t : 1 - t);
      p.el.setAttribute("transform", `translate(${f2(x)} ${f2(y)})`);
      p.el.style.opacity = String(f2(Math.min(1, t * 12, (1 - t) * 12 + 0.2)));
      if (t >= 0.985) {
        p.el.style.visibility = "hidden";
        if (--p.batch.remaining === 0) p.batch.resolve(true);
      } else live.push(p);
    }
    this.packets = live;
    return true;
  }
}
