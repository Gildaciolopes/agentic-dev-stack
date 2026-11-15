import { architecture, workflow, type Graph } from "@/content/architecture";
import type { PacketItem } from "./scene-controller";
import type { ViewId } from "./geometry";

/** Looks an edge up by its endpoints, so scripts never hard-code edge ids. */
const finder = (g: Graph) => (from: string, to: string) => g.edges.find((e) => e.from === from && e.to === to)?.id ?? "";
const keep = (items: PacketItem[]) => items.filter((i) => i.edge);

/* ------------------------------------------------------------------ ambient traffic */

/**
 * Each wave is sent, awaited, then the next one starts. Architecture: plans flow down,
 * diffs flow up, the review gate bounces one back once and then approves.
 */
export function ambientWaves(view: ViewId): PacketItem[][] {
  if (view === "architecture") {
    const e = finder(architecture);
    const down1 = [e("lead", "native"), e("lead", "alethe")];
    const workers = architecture.edges.filter((x) => x.from === "native" || x.from === "alethe").map((x) => x.id);
    const gate = e("native", "reviewer");
    return [
      keep(down1.map((edge) => ({ edge }))),
      keep(workers.map((edge) => ({ edge }))),
      keep(workers.map((edge) => ({ edge, dir: -1 as const }))),
      keep([{ edge: gate, dir: 1 }]),
      keep([{ edge: gate, dir: -1 }]),
      keep(down1.map((edge) => ({ edge, dir: -1 as const }))),
      keep([{ edge: e("nim", "curator") }]),
      keep([{ edge: e("curator", "ninerouter") }, { edge: e("opencode", "ninerouter") }]),
      keep([{ edge: e("curator", "collector") }]),
      keep([{ edge: e("collector", "hermes") }]),
      keep([{ edge: e("hermes", "you") }]),
    ].filter((w) => w.length);
  }
  const e = finder(workflow);
  const chain = [
    e("specify", "clarify"),
    e("clarify", "plan"),
    e("plan", "tasks"),
    e("tasks", "analyze"),
    e("analyze", "scout"),
    e("scout", "builder"),
    e("builder", "free-worker"),
    e("free-worker", "reviewer"),
  ];
  const gate = e("free-worker", "reviewer");
  return [
    keep([{ edge: e("lead", "specify") }, { edge: e("hermes", "specify") }]),
    keep(chain.map((edge, i) => ({ edge, delay: i * 480 }))),
    keep([{ edge: gate, dir: -1 }]),
    keep([{ edge: gate, dir: 1 }]),
    keep([{ edge: e("reviewer", "verify") }]),
    keep([{ edge: e("verify", "specify") }]),
  ].filter((w) => w.length);
}

/* ------------------------------------------------------------------ "Run a feature" */

export type StageKey = "spec" | "tasks" | "builders" | "review" | "fail" | "retry" | "pass" | "commit";

export type RunApi = {
  send(items: PacketItem[]): Promise<boolean>;
  sleep(ms: number): Promise<boolean>;
  mark(id: string, state: "on" | "fail" | "pass" | null): void;
  stage(key: StageKey, progress: number): void;
};

const ABORT = Symbol("abort");
const must = async (p: Promise<boolean>) => {
  if (!(await p)) throw ABORT;
};

/** Returns true when the whole cycle played, false when it was cancelled. */
export async function runFeature(view: ViewId, api: RunApi): Promise<boolean> {
  const { send, sleep, mark, stage } = api;
  try {
    if (view === "architecture") {
      const e = finder(architecture);
      const gate = e("native", "reviewer");
      // spec -> tasks: the decide nodes
      stage("spec", 0.1);
      mark("you", "on");
      await must(send(keep([{ edge: e("you", "lead") }])));
      mark("lead", "on");
      stage("tasks", 0.25);
      await must(send(keep([{ edge: e("lead", "native") }, { edge: e("lead", "alethe") }])));
      mark("native", "on");
      mark("alethe", "on");
      // three builders in parallel
      stage("builders", 0.45);
      ["builder", "opencode", "codex"].forEach((id) => mark(id, "on"));
      await must(
        send(keep([{ edge: e("native", "builder") }, { edge: e("alethe", "opencode") }, { edge: e("alethe", "codex") }])),
      );
      await must(sleep(500));
      // diffs go up, the reviewer rejects once
      stage("review", 0.6);
      await must(send(keep([{ edge: e("native", "builder"), dir: -1 }, { edge: e("alethe", "opencode"), dir: -1 }, { edge: e("alethe", "codex"), dir: -1 }])));
      await must(send(keep([{ edge: gate }])));
      mark("reviewer", "fail");
      stage("fail", 0.6);
      await must(sleep(900));
      await must(send(keep([{ edge: gate, dir: -1 }])));
      await must(send(keep([{ edge: e("native", "builder") }])));
      mark("reviewer", null);
      stage("retry", 0.75);
      await must(sleep(500));
      await must(send(keep([{ edge: e("native", "builder"), dir: -1 }])));
      await must(send(keep([{ edge: gate }])));
      mark("reviewer", "pass");
      stage("pass", 0.9);
      await must(sleep(600));
      await must(send(keep([{ edge: gate, dir: -1 }])));
      await must(send(keep([{ edge: e("lead", "native"), dir: -1 }])));
      mark("lead", "pass");
      stage("commit", 1);
      await must(sleep(1400));
      return true;
    }
    const e = finder(workflow);
    const gate = e("free-worker", "reviewer");
    stage("spec", 0.1);
    for (const [a, b] of [["specify", "clarify"], ["clarify", "plan"], ["plan", "tasks"], ["tasks", "analyze"]] as const) {
      mark(a, "on");
      await must(send(keep([{ edge: e(a, b) }])));
      mark(b, "on");
    }
    stage("tasks", 0.25);
    await must(sleep(400));
    stage("builders", 0.45);
    ["scout", "builder", "free-worker"].forEach((id) => mark(id, "on"));
    await must(
      send(keep([{ edge: e("analyze", "scout") }, { edge: e("scout", "builder"), delay: 150 }, { edge: e("builder", "free-worker"), delay: 300 }])),
    );
    stage("review", 0.6);
    await must(send(keep([{ edge: gate }])));
    mark("reviewer", "fail");
    stage("fail", 0.6);
    await must(sleep(900));
    await must(send(keep([{ edge: gate, dir: -1 }])));
    await must(send(keep([{ edge: e("builder", "free-worker"), dir: -1 }])));
    mark("reviewer", null);
    stage("retry", 0.75);
    await must(sleep(500));
    await must(send(keep([{ edge: e("builder", "free-worker") }])));
    await must(send(keep([{ edge: gate }])));
    mark("reviewer", "pass");
    stage("pass", 0.9);
    await must(sleep(600));
    await must(send(keep([{ edge: e("reviewer", "verify") }])));
    mark("verify", "pass");
    stage("commit", 1);
    await must(sleep(1400));
    return true;
  } catch (err) {
    if (err === ABORT) return false;
    throw err;
  }
}
