"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion, MorphPath } from "@usefluid/motion/react";
import { useTranslations } from "next-intl";
import { MorphButton, type MorphButtonState } from "@/components/fluid/morph-button/MorphButton";
import { MorphDialog } from "@/components/fluid/morph-dialog/MorphDialog";
import { IslandToast } from "@/components/fluid/island-toast/IslandToast";
import { SegmentedPicker } from "@/components/fluid/segmented-picker/SegmentedPicker";
import { Button } from "@/components/ui/button";
import { LegendChip, type LegendKind } from "@/components/ui/legend-chip";
import { Link } from "@/i18n/navigation";
import { architecture, assemblySteps, workflow, type GraphNode, type Kind } from "@/content/architecture";
import { cn } from "@/lib/utils";
import { CuratorPanel } from "./curator-panel";
import {
  GRAPHS,
  NODE_ITEMS,
  boundsOf,
  desktopLayout,
  fitView,
  logoPath,
  mobileLayout,
  neighbours,
  rectPath,
  revealed,
  routesFor,
  shapePath,
  type Layout,
  type NodeItem,
  type ViewId,
} from "./geometry";
import { SceneController } from "./scene-controller";
import { ambientWaves, runFeature, type StageKey } from "./scripts";
import { TokenMeter } from "./token-meter";
import styles from "./architecture.module.css";

const DESK: Record<ViewId, Layout> = { architecture: desktopLayout(architecture), workflow: desktopLayout(workflow) };
const STEPS = assemblySteps;
const POOL = Array.from({ length: 10 }, (_, i) => i);
const GROUP_ITEMS = [
  ...architecture.groups.map((g) => ({ g, view: "architecture" as ViewId })),
  ...workflow.groups.map((g) => ({ g, view: "workflow" as ViewId })),
];
const EDGE_ITEMS = [
  ...architecture.edges.map((e) => ({ e, view: "architecture" as ViewId })),
  ...workflow.edges.map((e) => ({ e, view: "workflow" as ViewId })),
];
const INIT = (id: string) => DESK.architecture.nodes[id] ?? DESK.workflow.nodes[id];

function Loading3D() {
  const t = useTranslations("architecture.toolbar");
  return (
    <p role="status" className={styles.loading3d}>
      {t("loading3d")}
    </p>
  );
}
const Scene3D = dynamic(() => import("@/components/three/architecture-scene"), { ssr: false, loading: () => <Loading3D /> });

type Mode = "desktop" | "mobile";
const DESKTOP_Q = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP_Q);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function NodeText({ n }: { n: GraphNode }) {
  return (
    <>
      <span className={styles.label}>{n.label}</span>
      {n.sub?.map((s) => (
        <span key={s} className={styles.sub}>
          {s}
        </span>
      ))}
    </>
  );
}

export function ArchitectureExplorer() {
  const t = useTranslations("architecture");
  const reduced = useReducedMotion();
  const ctrl = useState(() => new SceneController())[0];

  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_Q).matches, () => true);
  const mode: Mode = isDesktop ? "desktop" : "mobile";
  const [view, setView] = useState<ViewId>("architecture");
  const [step, setStep] = useState(1);
  const [bw, setBw] = useState(360);
  const [box, setBox] = useState({ w: 1200, h: 650 });
  const [filter, setFilter] = useState<Set<Kind>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [formed, setFormed] = useState(true);
  const [use3d, setUse3d] = useState(false);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<HTMLElement | null>(null);
  const [selNode, setSelNode] = useState<GraphNode | null>(null);
  const [runState, setRunState] = useState<MorphButtonState>("idle");
  const [announce, setAnnounce] = useState("");
  const [meter, setMeter] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [freeActive, setFreeActive] = useState(false);

  const effStep = reduced ? STEPS.length : step;
  const graph = GRAPHS[view];

  /* ------------------------------------------------------------ layouts + routes */
  const layouts = useMemo<Record<ViewId, Layout>>(
    () => (mode === "desktop" ? DESK : { architecture: mobileLayout(architecture, bw), workflow: mobileLayout(workflow, bw) }),
    [mode, bw],
  );
  const routes = useMemo(
    () => ({ architecture: routesFor(architecture, layouts.architecture), workflow: routesFor(workflow, layouts.workflow) }),
    [layouts],
  );
  const rv = useMemo(() => revealed(STEPS, effStep), [effStep]);
  /** mobile: the viewBox only reaches as far down as what has been revealed */
  const mobileH = useMemo(() => {
    const full = layouts[view].vb[1];
    if (mode !== "mobile" || view !== "architecture" || reduced) return full;
    const b = boundsOf(layouts[view], [...rv.nodes], [...rv.groups]);
    return b ? Math.min(full, b.y + b.h + 20) : full;
  }, [layouts, view, mode, reduced, rv]);

  /* ------------------------------------------------------------ bind + mode + size */
  const applied = useRef({ layouts: null as Record<ViewId, Layout> | null, view: null as ViewId | null, first: true, cam: true });
  useLayoutEffect(() => {
    if (svgRef.current) ctrl.bind(svgRef.current);
    const a = applied;
    return () => {
      ctrl.dispose();
      a.current = { layouts: null, view: null, first: true, cam: true };
    };
  }, [ctrl]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1) return;
      setBw(Math.max(240, Math.round(width / 4) * 4));
      setBox((b) => (Math.abs(b.w - width) < 2 && Math.abs(b.h - height) < 2 ? b : { w: Math.round(width), h: Math.max(200, Math.round(height)) }));
    });
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------------ visibility (traffic is paused off-screen / hidden tab) */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "80px 0px" });
    io.observe(root);
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const playing = mounted && inView && !pageHidden && !use3d;
  useEffect(() => ctrl.setPaused(!playing), [ctrl, playing]);
  useEffect(() => ctrl.setNoPackets(reduced), [ctrl, reduced]);

  /* ------------------------------------------------------------ scroll assembly (desktop, pinned) */
  useEffect(() => {
    if (!mounted || mode !== "desktop" || reduced) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let top = 0;
    let span = 1;
    let ticking = false;
    let listening = false;
    const measure = () => {
      const r = wrap.getBoundingClientRect(); // one cached read per resize / entry
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;
      top = r.top + window.scrollY - navH;
      span = Math.max(1, r.height - (window.innerHeight - navH));
    };
    const update = () => {
      ticking = false;
      const p = clamp((window.scrollY - top) / span, 0, 0.9999);
      const s = Math.min(STEPS.length, Math.floor(p * STEPS.length) + 1);
      setStep((prev) => (prev === s ? prev : s));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          measure();
          update();
          if (!listening) {
            window.addEventListener("scroll", onScroll, { passive: true });
            listening = true;
          }
        } else if (listening) {
          window.removeEventListener("scroll", onScroll);
          listening = false;
          measure();
          update();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(wrap);
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    ro.observe(wrap);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [mounted, mode, reduced]);

  /* ------------------------------------------------------------ apply layout / visibility / camera to the scene */
  useEffect(() => {
    if (!mounted) return;
    const a = applied.current;
    const immediate = reduced || a.first || a.layouts !== layouts;
    ctrl.setLayout(layouts[view], view, immediate);
    ctrl.setRoutes(routes[view], new Map(GRAPHS[view].edges.map((e) => [e.id, e.kind])));
    a.layouts = layouts;
  }, [mounted, ctrl, layouts, routes, view, reduced]);

  useEffect(() => {
    if (!mounted) return;
    const a = applied.current;
    const viewChanged = a.view !== null && a.view !== view;
    const base = viewChanged ? 300 : 0;
    const snap = reduced || a.first;
    const all = view === "workflow";
    let k = 0;
    for (const item of NODE_ITEMS) {
      const present = view === "architecture" ? !!item.a : !!item.w;
      const v = present && (all || rv.nodes.has(item.id)) ? 1 : 0;
      const delay = v > ctrl.visTarget("node", item.id) ? base + k++ * (viewChanged ? 40 : 90) : 0;
      ctrl.setVis("node", item.id, v, delay, snap);
    }
    const seenGroups = new Set<string>();
    for (const { g, view: gv } of GROUP_ITEMS) {
      if (seenGroups.has(g.id)) continue;
      seenGroups.add(g.id);
      const v = gv === view && (all || rv.groups.has(g.id)) ? 1 : 0;
      const delay = v > ctrl.visTarget("group", g.id) ? base + 60 + k++ * 40 : 0;
      ctrl.setVis("group", g.id, v, delay, snap);
    }
    let j = 0;
    for (const { e, view: ev } of EDGE_ITEMS) {
      const v = ev === view && (all || rv.edges.has(e.id)) ? 1 : 0;
      const delay = v > ctrl.visTarget("edge", e.id) ? base + 280 + j++ * 80 : 0;
      ctrl.setVis("edge", e.id, v, delay, snap);
    }
    ctrl.setVis("frame", "economy", view === "architecture" && rv.nodes.has("rtk") ? 1 : 0, base + 300, snap);
    a.view = view;
    a.first = false;
  }, [mounted, ctrl, view, rv, reduced]);

  useEffect(() => {
    if (!mounted) return;
    const L = layouts[view];
    if (mode === "mobile") {
      ctrl.setCamera({ x: 0, y: 0, w: L.vb[0], h: mobileH }, true);
      applied.current.cam = false;
      return;
    }
    const aspect = box.w / box.h;
    const canvas = { x: 0, y: 0, w: L.vb[0], h: L.vb[1] };
    let target = fitView(canvas, aspect, 0, 0);
    if (view === "architecture" && effStep < STEPS.length && !reduced) {
      const b = boundsOf(L, [...rv.nodes], [...rv.groups]);
      if (b) target = fitView(b, aspect, 56, 520);
    }
    ctrl.setCamera(target, reduced || applied.current.cam);
    applied.current.cam = false;
  }, [mounted, ctrl, layouts, view, mode, box, rv, effStep, reduced, mobileH]);

  /* ------------------------------------------------------------ lead node: logo -> rect */
  useEffect(() => {
    if (!mounted) return;
    const grow = reduced || effStep >= 2;
    const id = window.setTimeout(() => setFormed(grow), grow && !reduced ? 520 : 0);
    return () => window.clearTimeout(id);
  }, [mounted, effStep, reduced]);

  /* ------------------------------------------------------------ ambient traffic */
  useEffect(() => {
    if (!mounted || reduced || runState !== "idle") return;
    let alive = true;
    const waves = ambientWaves(view);
    void (async () => {
      if (!(await ctrl.sleep(500))) return;
      while (alive) {
        for (const w of waves) {
          if (!(await ctrl.send(w)) || !alive) return;
          if (!(await ctrl.sleep(240))) return;
        }
        if (!(await ctrl.sleep(1100))) return;
      }
    })();
    return () => {
      alive = false;
      ctrl.reset();
    };
  }, [mounted, reduced, runState, view, mode, ctrl]);

  /* ------------------------------------------------------------ Run a feature */
  useEffect(() => {
    if (runState !== "loading") return;
    let alive = true;
    ctrl.clearRun();
    void runFeature(view, {
      send: (items) => ctrl.send(items),
      sleep: (ms) => ctrl.sleep(reduced ? ms * 0.5 : ms),
      mark: (id, s) => ctrl.setRun(id, s),
      stage: (key: StageKey, progress: number) => {
        if (!alive) return;
        setAnnounce(t(`run.stages.${key}`));
        setMeter(progress);
        if (key === "commit") setToast(t("run.toast"));
      },
    }).then((ok) => {
      if (alive && ok) setRunState("done");
    });
    return () => {
      alive = false;
      ctrl.reset();
      ctrl.clearRun();
    };
  }, [runState, view, ctrl, reduced, t]);

  useEffect(() => {
    if (runState !== "done") return;
    const id = window.setTimeout(() => {
      setToast(null);
      ctrl.clearRun();
    }, 3600);
    const id2 = window.setTimeout(() => {
      setRunState("idle");
      setMeter(0);
      setAnnounce("");
    }, 5200);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
    };
  }, [runState, ctrl]);

  const onRun = () => {
    if (runState === "idle") {
      setMeter(0);
      setRunState("loading");
    }
  };

  /* ------------------------------------------------------------ free-models highlight while the curator demo plays */
  useEffect(() => {
    for (const id of ["nim", "curator", "ninerouter"]) ctrl.setRun(id, freeActive && runState === "idle" ? "on" : null);
  }, [freeActive, runState, ctrl]);
  const onCuratorActive = useCallback((a: boolean) => setFreeActive(a), []);

  /* ------------------------------------------------------------ dim / hot */
  const activeId = hoverId ?? focusId;
  const nb = useMemo(() => (activeId ? neighbours(graph, activeId) : null), [graph, activeId]);
  const filterOn = filter.size > 0;
  const kindIn = (item: NodeItem) => (view === "architecture" ? (item.a ?? item.w) : (item.w ?? item.a))?.kind as Kind;
  const kindById = (id: string) => graph.nodes.find((n) => n.id === id)?.kind as Kind | undefined;
  const matches = (k: Kind | undefined) => !filterOn || (k !== undefined && filter.has(k));

  const toggleKind = (kind: Kind, on: boolean) =>
    setFilter((prev) => {
      const next = new Set(prev);
      if (on) next.add(kind);
      else next.delete(kind);
      return next;
    });

  const openNode = (node: GraphNode, el: HTMLElement | null) => {
    setSelNode(node);
    setFrom(el);
    setOpen(true);
  };

  /* ------------------------------------------------------------ render */
  const scroll = mounted && mode === "desktop" && !reduced;
  const story = mounted && mode === "mobile" && !reduced;
  const L = layouts[view];
  const lead = L.nodes.lead;
  const leadShape = view === "workflow" || formed ? rectPath(lead.w, lead.h) : logoPath(lead.w, lead.h);
  const caption = view === "architecture" ? STEPS[effStep - 1].caption : workflow.subtitle;
  const visibleIds = view === "architecture" ? [...rv.nodes] : undefined;
  const mobileVb = mode === "mobile" ? `${L.vb[0]} / ${mobileH}` : undefined;
  const frameRect = layouts.architecture.vb;
  const areaStyle = mobileVb
    ? { aspectRatio: mobileVb }
    : !scroll
      ? { aspectRatio: `${L.vb[0]} / ${L.vb[1]}` }
      : undefined;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-ready={mounted ? "1" : "0"}
      data-mode={mode}
      data-view={view}
      data-reduced={reduced ? "1" : "0"}
    >
      <div ref={wrapRef} className={styles.wrap} style={scroll ? { height: `${STEPS.length * 70}vh` } : undefined}>
        <div className={cn(styles.stage, scroll && styles.pinned)}>
          <div className={styles.toolbar}>
            <SegmentedPicker
              label={t("toolbar.view")}
              value={view}
              onChange={(v) => setView(v)}
              options={[
                { value: "architecture", label: t("toolbar.architecture") },
                { value: "workflow", label: t("toolbar.workflow") },
              ]}
            />
            <div className={styles.chips} role="group" aria-label={t("toolbar.filter")}>
              {graph.legend.map((l) => (
                <LegendChip
                  key={l.kind}
                  kind={l.kind as LegendKind}
                  label={l.label}
                  pressed={filter.has(l.kind)}
                  onPressedChange={(p) => toggleKind(l.kind, p)}
                />
              ))}
            </div>
            <Button variant="secondary" size="sm" aria-pressed={use3d} onClick={() => setUse3d((v) => !v)} className={styles.toggle3d}>
              {use3d ? t("toolbar.to2d") : t("toolbar.to3d")}
            </Button>
          </div>

          <div ref={areaRef} className={styles.area} style={areaStyle}>
            <svg
              ref={svgRef}
              className={cn(styles.svg, use3d && styles.svgHidden)}
              viewBox="0 0 1500 1160"
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label={t("explorer.label")}
            >
              <g aria-hidden>
                {GROUP_ITEMS.map(({ g, view: gv }) => {
                  const r = layouts[gv].groups[g.id];
                  if (!r) return null;
                  return (
                    <g key={g.id} data-group={g.id} className={styles.group} style={{ opacity: 0 }}>
                      <rect className={styles.groupFrame} x={r.x} y={r.y} width={r.w} height={r.h} />
                      <text className={styles.groupLabel} x={r.x + 14} y={r.y + 24}>
                        {g.label}
                      </text>
                    </g>
                  );
                })}
                <path
                  data-frame="economy"
                  className={styles.frame}
                  d={`M10 10H${frameRect[0] - 10}V${frameRect[1] - 10}H10Z`}
                  pathLength={1}
                  style={{ strokeDashoffset: 1, visibility: "hidden" }}
                />
              </g>

              <g aria-hidden>
                {EDGE_ITEMS.map(({ e, view: ev }) => {
                  const route = routes[ev].get(e.id);
                  if (!route) return null;
                  const dim = ev === view && ((nb && !nb.edges.has(e.id)) || (filterOn && !(matches(kindById(e.from)) || matches(kindById(e.to)))));
                  return (
                    <g
                      key={e.id}
                      data-edge={e.id}
                      data-solid={e.dashed ? "0" : "1"}
                      data-kind={e.kind}
                      data-dim={dim ? "1" : "0"}
                      data-hot={ev === view && nb?.edges.has(e.id) ? "1" : "0"}
                      className={styles.edge}
                      style={{ visibility: "hidden" }}
                    >
                      <path
                        data-line
                        className={styles.line}
                        d={route.d}
                        pathLength={e.dashed ? undefined : 1}
                        strokeDasharray={e.dashed ? "7 6" : "1 1"}
                        style={e.dashed ? { opacity: 0 } : { strokeDashoffset: 1 }}
                      />
                      <path
                        className={styles.head}
                        d="M0 0L-11 -5.5L-11 5.5Z"
                        transform={`translate(${route.head.x} ${route.head.y}) rotate(${route.head.angle})`}
                      />
                      {e.label ? (
                        <text className={styles.edgeLabel} x={route.label[0]} y={route.label[1]} textAnchor="middle">
                          {e.label.replace(/\n/g, " · ")}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g aria-hidden>
                {POOL.map((i) => (
                  <circle key={i} data-packet r={5} className={styles.packet} style={{ visibility: "hidden" }} />
                ))}
              </g>

              {NODE_ITEMS.map((item) => {
                const init = INIT(item.id);
                const cur = (view === "architecture" ? (item.a ?? item.w) : (item.w ?? item.a)) as GraphNode;
                const own = (item.a ?? item.w) as GraphNode;
                const isLead = item.id === "lead";
                const present = view === "architecture" ? !!item.a : !!item.w;
                const dim = present && ((nb && !nb.nodes.has(item.id)) || (filterOn && !matches(kindIn(item))));
                return (
                  <g
                    key={item.id}
                    data-node={item.id}
                    data-shape={own.shape ?? "box"}
                    data-morph={isLead ? "1" : undefined}
                    data-lead={isLead ? "1" : undefined}
                    data-formed={isLead ? (formed || view === "workflow" ? "1" : "0") : undefined}
                    data-kind={cur.kind}
                    data-dim={dim ? "1" : "0"}
                    data-hot={present && nb?.nodes.has(item.id) ? "1" : "0"}
                    className={styles.node}
                    transform={`translate(${init.x} ${init.y})`}
                    style={{ opacity: 0, visibility: "hidden" }}
                  >
                    <g className={styles.body}>
                      {isLead ? (
                        <MorphPath data-rect className={styles.rect} d={leadShape} config={{ w: 11, z: 0.82 }} />
                      ) : (
                        <path data-rect className={styles.rect} d={shapePath(own, init.w, init.h)} />
                      )}
                      <foreignObject x={0} y={0} width={init.w} height={init.h} overflow="visible">
                        <button
                          type="button"
                          className={styles.nodeBtn}
                          aria-label={`${cur.label}, ${t(`kinds.${cur.kind}`)}`}
                          aria-hidden={!present || undefined}
                          tabIndex={present ? 0 : -1}
                          onClick={(ev) => openNode(cur, ev.currentTarget)}
                          onPointerEnter={() => setHoverId(item.id)}
                          onPointerLeave={() => setHoverId(null)}
                          onFocus={() => setFocusId(item.id)}
                          onBlur={() => setFocusId(null)}
                        >
                          {item.a ? (
                            <span data-t="a" className={styles.txt}>
                              <NodeText n={item.a} />
                            </span>
                          ) : null}
                          {item.w ? (
                            <span data-t="w" className={styles.txt}>
                              <NodeText n={item.w} />
                            </span>
                          ) : null}
                        </button>
                      </foreignObject>
                    </g>
                  </g>
                );
              })}
            </svg>

            {use3d ? (
              <div className={styles.scene3d}>
                <Scene3D
                  graph={graph}
                  visibleIds={visibleIds}
                  highlightId={activeId}
                  onSelect={(id) => {
                    const n = graph.nodes.find((x) => x.id === id);
                    if (n) openNode(n, areaRef.current);
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className={styles.dock}>
            <div className={styles.story}>
              {story ? (
                <div className={styles.storyNav}>
                  <Button
                    variant="secondary"
                    size="md"
                    className={styles.storyBtn}
                    disabled={step <= 1}
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    aria-label={t("story.prev")}
                  >
                    <span aria-hidden>←</span>
                  </Button>
                  <p className={styles.storyCount}>{t("story.count", { n: effStep, total: STEPS.length })}</p>
                  <Button
                    variant="secondary"
                    size="md"
                    className={styles.storyBtn}
                    disabled={step >= STEPS.length}
                    onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
                    aria-label={t("story.next")}
                  >
                    <span aria-hidden>→</span>
                  </Button>
                </div>
              ) : null}
              <p className={styles.caption} aria-live="polite">
                {caption}
              </p>
            </div>

            <div className={styles.runBox}>
              <div className={styles.runRow}>
                <MorphButton
                  state={runState}
                  labels={{ idle: t("run.idle"), loading: t("run.loading"), done: t("run.done") }}
                  onClick={onRun}
                />
                <p className={styles.runStatus} role="status" aria-live="polite">
                  {announce}
                </p>
              </div>
              <TokenMeter progress={meter} />
            </div>
          </div>
        </div>
      </div>

      <CuratorPanel onActive={onCuratorActive} />

      <MorphDialog open={open} onClose={() => setOpen(false)} from={from} labelledBy="arch-node-title" className={styles.dialog}>
        {selNode ? (
          <div className={styles.dialogBody}>
            <p className={styles.dialogKind}>
              <span aria-hidden className={styles.dot} style={{ background: `var(--k-${selNode.kind})` }} />
              {t(`kinds.${selNode.kind}`)}
            </p>
            <h2 id="arch-node-title" className="text-h3">
              {selNode.label}
            </h2>
            <p className={styles.dialogText}>{selNode.does}</p>
            <dl className={styles.dialogDl}>
              {selNode.model ? (
                <>
                  <dt>{t("dialog.model")}</dt>
                  <dd>{selNode.model}</dd>
                </>
              ) : null}
              {selNode.quota ? (
                <>
                  <dt>{t("dialog.quota")}</dt>
                  <dd>{selNode.quota}</dd>
                </>
              ) : null}
              {selNode.optional ? (
                <>
                  <dt>{t("dialog.status")}</dt>
                  <dd>{t("dialog.optional")}</dd>
                </>
              ) : null}
            </dl>
            <div className={styles.dialogActions}>
              {selNode.doc ? (
                <Link href={`/docs/${selNode.doc}`} className={styles.dialogLink}>
                  {t("dialog.docs")} <span aria-hidden>→</span>
                </Link>
              ) : (
                <span />
              )}
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                {t("dialog.close")}
              </Button>
            </div>
          </div>
        ) : null}
      </MorphDialog>

      <div className={styles.toastLayer}>
        <IslandToast message={toast} />
      </div>
    </div>
  );
}
