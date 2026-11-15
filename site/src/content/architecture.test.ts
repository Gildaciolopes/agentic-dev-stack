import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  architecture,
  assemblySteps,
  curatorDemo,
  isHealthy,
  selectKept,
  selectOrKeep,
  sharedIds,
  workflow,
  type CuratorRow,
  type Graph,
} from "./architecture";

const here = dirname(fileURLToPath(import.meta.url));

type Excalidraw = {
  elements: { type: string; text?: string; x: number; y: number; points?: [number, number][] }[];
};

function loadExcalidraw(file: string): Excalidraw {
  return JSON.parse(readFileSync(resolve(here, "../../../docs/assets", file), "utf8")) as Excalidraw;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Split a label into its display segments: lines, then " · " parts. */
const segments = (s: string): string[] =>
  s
    .split("\n")
    .flatMap((line) => line.split(" · "))
    .map(norm)
    .filter((t) => /[\p{L}\p{N}]/u.test(t));

function excalidrawTexts(file: string): string[] {
  return loadExcalidraw(file)
    .elements.filter((e) => e.type === "text" && e.text)
    .flatMap((e) => segments(e.text as string));
}

const legendColor: Record<string, string> = {
  native: "green",
  google: "teal",
  free: "orange",
  optional: "dashed gray",
};

/** Exact set of normalised label segments the typed graph can show. */
function labelSet(g: Graph): Set<string> {
  const parts: string[] = [g.title, g.subtitle];
  for (const n of g.nodes) parts.push(n.label, ...(n.sub ?? []));
  for (const gr of g.groups) parts.push(gr.label);
  for (const e of g.edges) if (e.label) parts.push(e.label);
  const set = new Set(parts.flatMap(segments));
  // The excalidraw legend is one composed line "green: native Claude · teal: Google (agy) · ...";
  // after the " · " split each segment is "<colour>: <label>".
  for (const l of g.legend) set.add(norm(`${legendColor[l.kind]}: ${l.label}`));
  return set;
}

describe.each([
  ["architecture.excalidraw", architecture],
  ["workflow.excalidraw", workflow],
] as const)("%s", (file, graph) => {
  it("has every non-empty label present in the typed graph", () => {
    const known = labelSet(graph);
    const missing = excalidrawTexts(file).filter((t) => !known.has(t));
    expect(missing).toEqual([]);
  });

  it("has edges that reference existing nodes and unique ids", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(graph.nodes.length);
    for (const e of graph.edges) {
      expect(ids.has(e.from), `${e.id}.from=${e.from}`).toBe(true);
      expect(ids.has(e.to), `${e.id}.to=${e.to}`).toBe(true);
    }
    expect(new Set(graph.edges.map((e) => e.id)).size).toBe(graph.edges.length);
  });

  it("has only edges that match an excalidraw arrow (nearest boxes to its start and end)", () => {
    const arrows = loadExcalidraw(file).elements.filter((e) => e.type === "arrow" && e.points && e.points.length > 1);
    expect(arrows.length).toBeGreaterThan(0);
    const boxes = graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
    const gap = (px: number, py: number, b: (typeof boxes)[number]) => {
      const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
      const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
      return Math.hypot(dx, dy);
    };
    // every box within TOL of the point, so a point sitting between two boxes matches both
    const TOL = 60;
    const near = (px: number, py: number) => new Set(boxes.filter((b) => gap(px, py, b) <= TOL).map((b) => b.id));
    const ends = arrows.map((a) => {
      const pts = a.points as [number, number][];
      const first = pts[0];
      const last = pts[pts.length - 1];
      return { start: near(a.x + first[0], a.y + first[1]), end: near(a.x + last[0], a.y + last[1]) };
    });
    const unmatched = graph.edges
      .filter((e) => !ends.some((a) => a.start.has(e.from) && a.end.has(e.to)))
      .map((e) => e.id);
    expect(unmatched).toEqual([]);
  });

  it("puts every node in a known group (or root)", () => {
    const groups = new Set(["root", ...graph.groups.map((g) => g.id)]);
    for (const n of graph.nodes) expect(groups.has(n.group), n.id).toBe(true);
  });
});

describe("sharedIds", () => {
  it("exist in both graphs", () => {
    const a = new Set(architecture.nodes.map((n) => n.id));
    const w = new Set(workflow.nodes.map((n) => n.id));
    for (const id of sharedIds) {
      expect(a.has(id), `architecture:${id}`).toBe(true);
      expect(w.has(id), `workflow:${id}`).toBe(true);
    }
  });
});

describe("assemblySteps", () => {
  it("has 7 steps referencing existing ids", () => {
    expect(assemblySteps).toHaveLength(7);
    const nodes = new Set(architecture.nodes.map((n) => n.id));
    const groups = new Set(architecture.groups.map((g) => g.id));
    const edges = new Set(architecture.edges.map((e) => e.id));
    for (const s of assemblySteps) {
      expect(s.caption.length).toBeGreaterThan(0);
      for (const id of s.nodeIds) expect(nodes.has(id), `${s.id}:${id}`).toBe(true);
      for (const id of s.groupIds) expect(groups.has(id), `${s.id}:${id}`).toBe(true);
      for (const id of s.edgeIds) expect(edges.has(id), `${s.id}:${id}`).toBe(true);
    }
  });

  it("covers every architecture node, group and edge at least once", () => {
    const covered = (pick: (s: (typeof assemblySteps)[number]) => string[]) =>
      new Set(assemblySteps.flatMap(pick));
    const nodes = covered((s) => s.nodeIds);
    const groups = covered((s) => s.groupIds);
    const edges = covered((s) => s.edgeIds);
    expect(architecture.nodes.filter((n) => !nodes.has(n.id)).map((n) => n.id)).toEqual([]);
    expect(architecture.groups.filter((g) => !groups.has(g.id)).map((g) => g.id)).toEqual([]);
    expect(architecture.edges.filter((e) => !edges.has(e.id)).map((e) => e.id)).toEqual([]);
  });
});

const row = (over: Partial<CuratorRow> & { model: string }): CuratorRow => ({
  family: over.model,
  rank: 5,
  chat: { ok: true, latencySec: 2 },
  tool: { ok: true, latencySec: 3, toolCall: true },
  ...over,
});

describe("curator health rule", () => {
  const withLatency = (sec: number) => row({ model: "m", tool: { ok: true, latencySec: sec, toolCall: true } });

  it("accepts exactly 30.0 s and rejects 30.1 s (slower probe decides)", () => {
    expect(isHealthy(withLatency(30.0))).toBe(true);
    expect(isHealthy(withLatency(30.1))).toBe(false);
    expect(isHealthy(row({ model: "m", chat: { ok: true, latencySec: 30.1 } }))).toBe(false);
  });

  it("rejects a model that answered but made no tool call", () => {
    expect(isHealthy(row({ model: "m", tool: { ok: true, latencySec: 3, toolCall: false } }))).toBe(false);
  });

  it("rejects an empty answer (content and reasoning_content both empty)", () => {
    expect(isHealthy(row({ model: "m", empty: true }))).toBe(false);
  });

  it("rejects a failed first probe", () => {
    expect(isHealthy(row({ model: "m", chat: { ok: false, error: "404" }, tool: null }))).toBe(false);
  });
});

describe("selectKept / selectOrKeep", () => {
  it("sorts by rank, then latency, for equal ranks", () => {
    const slow = row({ model: "slow", rank: 4, tool: { ok: true, latencySec: 20, toolCall: true } });
    const fast = row({ model: "fast", rank: 4, tool: { ok: true, latencySec: 9, toolCall: true } });
    const best = row({ model: "best", rank: 1, tool: { ok: true, latencySec: 25, toolCall: true } });
    expect(selectKept([slow, fast, best])).toEqual(["best", "fast", "slow"]);
  });

  it("keeps at most `keep` models", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row({ model: `m${i}`, rank: i + 1 }));
    expect(selectKept(rows)).toEqual(["m0", "m1", "m2", "m3"]);
  });

  it("keeps the current combo when nothing is healthy", () => {
    const rows = [row({ model: "a", empty: true }), row({ model: "b", chat: { ok: false, error: "410" }, tool: null })];
    expect(selectKept(rows)).toEqual([]);
    expect(selectOrKeep(rows, ["nvidia/old"])).toEqual(["nvidia/old"]);
  });

  it("replaces the combo when something is healthy", () => {
    expect(selectOrKeep([row({ model: "a" })], ["nvidia/old"])).toEqual(["a"]);
  });
});

describe("curatorDemo", () => {
  it("stays within curate.py limits with exactly one 410 row", () => {
    expect(curatorDemo.rows.length).toBeLessThanOrEqual(curatorDemo.config.maxProbes);
    const dead = curatorDemo.rows.filter((r) => r.chat.error?.startsWith("410"));
    expect(dead.map((r) => r.model)).toEqual(["nvidia/glm-5.2"]);
    expect(isHealthy(dead[0])).toBe(false);
  });

  it("drops the dead model from the combo and keeps the healthy ones in rank order", () => {
    const healthy = curatorDemo.rows.filter((r) => isHealthy(r));
    expect(healthy.length).toBeGreaterThan(0);
    expect(curatorDemo.before).toContain("nvidia/glm-5.2");
    expect(curatorDemo.after).not.toContain("nvidia/glm-5.2");
    expect(curatorDemo.after).toEqual(
      [...healthy].sort((a, b) => a.rank - b.rank).map((r) => r.model).slice(0, curatorDemo.config.keep),
    );
  });
});
