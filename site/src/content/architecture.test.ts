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
  sharedIds,
  workflow,
  type Graph,
} from "./architecture";

const here = dirname(fileURLToPath(import.meta.url));

function excalidrawTexts(file: string): string[] {
  const raw = readFileSync(resolve(here, "../../../docs/assets", file), "utf8");
  const data = JSON.parse(raw) as { elements: { type: string; text?: string }[] };
  return data.elements
    .filter((e) => e.type === "text" && e.text)
    .flatMap((e) => (e.text as string).split("\n"))
    .flatMap((line) => line.split(" · "));
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const legendColor: Record<string, string> = {
  native: "green",
  google: "teal",
  free: "orange",
  optional: "dashed gray",
};

function haystack(g: Graph): string {
  const parts: string[] = [g.title, g.subtitle];
  for (const n of g.nodes) parts.push(n.label, ...(n.sub ?? []));
  for (const gr of g.groups) parts.push(gr.label);
  for (const e of g.edges) if (e.label) parts.push(e.label);
  // the excalidraw legend is one line "green: native Claude · teal: Google (agy) · ..."
  for (const l of g.legend) parts.push(l.label, `${legendColor[l.kind]}: ${l.label}`);
  return parts.map((p) => norm(p.replace(/ · /g, " · "))).join(" | ");
}

describe.each([
  ["architecture.excalidraw", architecture],
  ["workflow.excalidraw", workflow],
] as const)("%s", (file, graph) => {
  it("has every non-empty label present in the typed graph", () => {
    const hay = haystack(graph);
    const missing = excalidrawTexts(file)
      .map(norm)
      .filter((t) => /[\p{L}\p{N}]/u.test(t))
      .filter((t) => !hay.includes(t));
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

describe("curatorDemo", () => {
  it("stays within curate.py limits and mirrors its health rule", () => {
    expect(curatorDemo.rows.length).toBeLessThanOrEqual(curatorDemo.config.maxProbes);
    const dead = curatorDemo.rows.find((r) => r.chat.error?.startsWith("410"));
    expect(dead).toBeDefined();
    expect(isHealthy(dead!)).toBe(false);
    expect(curatorDemo.after).toHaveLength(curatorDemo.config.keep);
    expect(curatorDemo.after).not.toContain(dead!.model);
    expect(curatorDemo.after).toEqual(selectKept(curatorDemo.rows));
  });
});
