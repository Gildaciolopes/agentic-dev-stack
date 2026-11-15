/**
 * Single source of truth for the architecture + workflow diagrams.
 * Hand-written from docs/01-architecture.md and the EN labels of
 * docs/assets/build_architecture.py / build_workflow.py (the .excalidraw files have no
 * arrow bindings and no text containers, so they cannot be parsed into a graph).
 * Coordinates reuse the excalidraw rectangles. architecture.test.ts checks that every
 * excalidraw label still appears here.
 *
 * Node.group points at a GraphGroup id; "root" means "not inside any frame".
 */

export type Kind =
  | "lead"
  | "native"
  | "google"
  | "free"
  | "optional"
  | "neutral"
  | "hermes"
  | "economy";

export type GraphNode = {
  id: string;
  label: string;
  sub?: string[];
  kind: Kind;
  group: string;
  optional?: boolean;
  model?: string;
  quota?: string;
  /** docs slug, e.g. "05-free-models" */
  doc?: string;
  does: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: "box" | "ellipse";
};

export type GraphGroup = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dashed?: boolean;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: Kind;
  dashed?: boolean;
  flow?: "plan" | "diff" | "data" | "status";
};

export type Graph = {
  id: "architecture" | "workflow";
  title: string;
  subtitle: string;
  viewBox: [number, number];
  nodes: GraphNode[];
  groups: GraphGroup[];
  edges: GraphEdge[];
  legend: { kind: Kind; label: string }[];
};

const legend: Graph["legend"] = [
  { kind: "native", label: "native Claude" },
  { kind: "google", label: "Google (agy)" },
  { kind: "free", label: "free" },
  { kind: "optional", label: "optional (Codex, Kiro, Copilot…)" },
];

/* ------------------------------------------------------------------ architecture */

export const architecture: Graph = {
  id: "architecture",
  title: "agentic-dev-stack",
  subtitle:
    "the expensive model plans · cheap models execute · an independent reviewer checks",
  viewBox: [1500, 1160],
  legend,
  groups: [
    { id: "delegation", label: "delegation layer", x: 40, y: 290, w: 1420, h: 150, dashed: true },
    {
      id: "workers",
      label: "workers (writers in isolated git worktrees)",
      x: 40,
      y: 480,
      w: 1420,
      h: 225,
      dashed: true,
    },
    { id: "free-models", label: "free models (self-healing)", x: 40, y: 735, w: 900, h: 200, dashed: true },
    { id: "always-on", label: "always on", x: 980, y: 735, w: 480, h: 200, dashed: true },
    { id: "economy", label: "token economy (always on)", x: 40, y: 965, w: 1420, h: 150, dashed: true },
  ],
  nodes: [
    {
      id: "you",
      label: "you",
      sub: ["terminal · phone"],
      kind: "neutral",
      group: "root",
      shape: "ellipse",
      x: 60,
      y: 140,
      w: 170,
      h: 80,
      does: "You talk to the lead from the terminal, and to Hermes from your phone.",
    },
    {
      id: "lead",
      label: "LEAD · Claude Code (Opus)",
      sub: ["plans · decides · integrates · validates", "Spec Kit SDD · graphify · RTK · caveman"],
      kind: "lead",
      group: "root",
      model: "Opus",
      doc: "01-architecture",
      x: 380,
      y: 125,
      w: 740,
      h: 115,
      does: "Your main session. It talks to you, holds the context, decides and integrates, so it never reads 40 files or writes boilerplate itself.",
    },
    {
      id: "native",
      label: "native subagents",
      sub: ["scout · builder · reviewer", "Opus blocked by agent-model-guard"],
      kind: "native",
      group: "delegation",
      doc: "01-architecture",
      x: 90,
      y: 325,
      w: 560,
      h: 95,
      does: "Defined in ~/.claude/agents/*.md with the model pinned in the frontmatter. Use them when the unit needs conversation context or is quick; the agent-model-guard hook denies generic subagents that would silently run on Opus.",
    },
    {
      id: "alethe",
      label: "alethe · orchestrator",
      sub: [
        "playbooks · tier per task · quota · provider switch",
        "passive mode · cost report",
      ],
      kind: "neutral",
      group: "delegation",
      doc: "03-alethe",
      x: 850,
      y: 325,
      w: 560,
      h: 95,
      does: "An orchestration skill that runs agent CLIs as workers. Playbooks pick phases and roles, quota reads switch provider before you run out, and passive mode delegates only what becomes cheaper.",
    },
    {
      id: "scout",
      label: "scout",
      sub: ["Haiku", "reads with shell"],
      kind: "native",
      group: "workers",
      model: "Haiku",
      doc: "01-architecture",
      x: 70,
      y: 525,
      w: 210,
      h: 135,
      does: "Reads and searches code, shell included, and returns a conclusion with file:line instead of whole files.",
    },
    {
      id: "builder",
      label: "builder",
      sub: ["Sonnet", "builds the unit", "Opus if deep/risky"],
      kind: "native",
      group: "workers",
      model: "Sonnet",
      doc: "01-architecture",
      x: 295,
      y: 525,
      w: 210,
      h: 135,
      does: "Executes an already-planned unit and runs the checks. It does not commit.",
    },
    {
      id: "reviewer",
      label: "reviewer",
      sub: ["Sonnet", "reviews the diff"],
      kind: "native",
      group: "workers",
      model: "Sonnet",
      doc: "01-architecture",
      x: 520,
      y: 525,
      w: 210,
      h: 135,
      does: "Reads the diff against the acceptance criteria and hunts for bugs without editing.",
    },
    {
      id: "agy",
      label: "agy",
      sub: ["Gemini Flash: scout", "Claude Opus: review", "Google quota"],
      kind: "google",
      group: "workers",
      model: "Gemini Flash / Claude Opus",
      quota: "Google quota, separate from your Claude subscription",
      doc: "01-architecture",
      x: 775,
      y: 525,
      w: 210,
      h: 135,
      does: "Google's Antigravity CLI, with a free tier on a Google account. Gemini Flash is the read-only scout and Claude Opus through agy is the independent reviewer.",
    },
    {
      id: "opencode",
      label: "opencode-safe",
      sub: ["9router/free", "mechanical · free", "kernel sandbox"],
      kind: "free",
      group: "workers",
      model: "9router/free",
      quota: "free",
      doc: "05-free-models",
      x: 1000,
      y: 525,
      w: 210,
      h: 135,
      does: "OpenCode running 9Router's free combo for mechanical edits, always in an isolated worktree inside an OS sandbox that denies reads of .env, keys and credentials.",
    },
    {
      id: "codex",
      label: "codex",
      sub: ["pluggable", "builder · reviewer", "quota fallback"],
      kind: "optional",
      group: "workers",
      optional: true,
      doc: "04-codex-and-other-clis",
      x: 1225,
      y: 525,
      w: 210,
      h: 135,
      does: "An optional pluggable CLI that can act as builder or reviewer and serves as a quota fallback.",
    },
    {
      id: "nim",
      label: "NVIDIA NIM",
      sub: ["free open models", "40 req/min"],
      kind: "neutral",
      group: "free-models",
      quota: "40 req/min per key",
      doc: "05-free-models",
      x: 70,
      y: 765,
      w: 250,
      h: 105,
      does: "Dozens of free open models through an API (Nemotron, Kimi, GLM, DeepSeek, MiniMax, Mistral, Qwen), limited to 40 requests per minute per key. No NVIDIA GPU needed.",
    },
    {
      id: "curator",
      label: "curator · 3x/day",
      sub: ["answers? tool call?", "latency ≤ 30s"],
      kind: "free",
      group: "free-models",
      doc: "05-free-models",
      x: 380,
      y: 765,
      w: 230,
      h: 105,
      does: "curate.py probes each candidate model and writes the best 4 into the free combo after a DB backup. If none pass, it changes nothing.",
    },
    {
      id: "ninerouter",
      label: "9Router",
      sub: ['"free" combo', "fallback · :20128"],
      kind: "free",
      group: "free-models",
      doc: "05-free-models",
      x: 670,
      y: 765,
      w: 240,
      h: 105,
      does: "A local OpenAI-compatible router that merges free providers into a combo with fallback. OpenCode, Hermes and the curator all use the combo named free.",
    },
    {
      id: "collector",
      label: "daily collector",
      sub: ["git · quota · specs", "hours · AI radar"],
      kind: "neutral",
      group: "always-on",
      doc: "06-hermes",
      x: 1010,
      y: 765,
      w: 200,
      h: 105,
      does: "A deterministic script that gathers the data Hermes summarizes: git state, quota, specs, hours and an AI radar.",
    },
    {
      id: "hermes",
      label: "Hermes",
      sub: ["Discord / Telegram", "no shell"],
      kind: "hermes",
      group: "always-on",
      model: "free combo",
      doc: "06-hermes",
      x: 1250,
      y: 765,
      w: 190,
      h: 105,
      does: "Nous Research's open source always-on agent. In this stack it does not code: it runs without a shell and summarizes data that scripts collect, reachable on Discord or Telegram.",
    },
    {
      id: "rtk",
      label: "RTK",
      sub: ["compresses shell output", "(input tokens)"],
      kind: "economy",
      group: "economy",
      doc: "01-architecture",
      x: 70,
      y: 1000,
      w: 320,
      h: 90,
      does: "A PreToolUse(Bash) hook that rewrites git status to rtk git status and strips noise from command output. Measured at 15-30% fewer input tokens.",
    },
    {
      id: "caveman",
      label: "caveman",
      sub: ["terse replies", "(output tokens)"],
      kind: "economy",
      group: "economy",
      doc: "01-architecture",
      x: 420,
      y: 1000,
      w: 320,
      h: 90,
      does: "A skill that makes the model answer without fluff. It cuts output tokens and the context re-read every turn; code and commits stay normal.",
    },
    {
      id: "graphify",
      label: "graphify",
      sub: ["query the graph", "before reading code"],
      kind: "economy",
      group: "economy",
      doc: "01-architecture",
      x: 770,
      y: 1000,
      w: 320,
      h: 90,
      does: "Builds a knowledge graph of the code. Scouts run graphify query before grep, so far fewer files get read.",
    },
    {
      id: "lean-claude-md",
      label: "lean CLAUDE.md",
      sub: ["only non-inferable facts", "+ /compact per topic"],
      kind: "economy",
      group: "economy",
      doc: "00-smart-vibe-coding",
      x: 1120,
      y: 1000,
      w: 320,
      h: 90,
      does: "Keep CLAUDE.md to facts the model cannot infer and compact per topic, so the per-turn context stays small.",
    },
  ],
  edges: [
    { id: "you-lead", from: "you", to: "lead", kind: "neutral", flow: "data" },
    { id: "lead-native", from: "lead", to: "native", kind: "neutral", flow: "plan" },
    { id: "lead-alethe", from: "lead", to: "alethe", kind: "neutral", flow: "plan" },
    { id: "native-scout", from: "native", to: "scout", kind: "native", flow: "plan" },
    { id: "native-builder", from: "native", to: "builder", kind: "native", flow: "plan" },
    { id: "native-reviewer", from: "native", to: "reviewer", kind: "native", flow: "plan" },
    { id: "alethe-agy", from: "alethe", to: "agy", kind: "google", flow: "plan" },
    { id: "alethe-opencode", from: "alethe", to: "opencode", kind: "free", flow: "plan" },
    { id: "alethe-codex", from: "alethe", to: "codex", kind: "optional", dashed: true, flow: "plan" },
    { id: "nim-curator", from: "nim", to: "curator", label: "probes", kind: "neutral", flow: "data" },
    { id: "curator-ninerouter", from: "curator", to: "ninerouter", label: "writes", kind: "neutral", flow: "data" },
    { id: "opencode-ninerouter", from: "opencode", to: "ninerouter", label: "uses", kind: "free", flow: "data" },
    {
      id: "curator-collector",
      from: "curator",
      to: "collector",
      label: "combo status",
      kind: "neutral",
      dashed: true,
      flow: "status",
    },
    { id: "collector-hermes", from: "collector", to: "hermes", kind: "neutral", flow: "status" },
    {
      id: "hermes-you",
      from: "hermes",
      to: "you",
      label: "08:00 digest\nalerts · questions\nfrom your phone",
      kind: "hermes",
      dashed: true,
      flow: "status",
    },
  ],
};

/* ------------------------------------------------------------------ workflow */

export const workflow: Graph = {
  id: "workflow",
  title: "smart vibe coding workflow",
  subtitle: "spec first · cheap models for volume · independent review · minimum tokens",
  viewBox: [1500, 780],
  legend,
  groups: [
    { id: "decide", label: "1 · decide: lead (Opus) + you (Spec Kit)", x: 40, y: 120, w: 1420, h: 175, dashed: true },
    { id: "execute", label: "2 · execute: delegated (alethe / subagents)", x: 40, y: 335, w: 1420, h: 205, dashed: true },
    { id: "save", label: "3 · save tokens on every turn", x: 40, y: 580, w: 1420, h: 165, dashed: true },
  ],
  nodes: [
    {
      id: "lead",
      label: "lead (Opus) + you",
      kind: "lead",
      group: "decide",
      model: "Opus",
      doc: "00-smart-vibe-coding",
      x: 1060,
      y: 124,
      w: 372,
      h: 30,
      does: "Decision phases (specify to analyze) stay with the lead, working with you.",
    },
    {
      id: "hermes",
      label: "Hermes · 08:00",
      sub: ['"where did I stop?"', "specs · hours · plan of the day"],
      kind: "hermes",
      group: "decide",
      doc: "06-hermes",
      x: 70,
      y: 165,
      w: 200,
      h: 100,
      does: "The morning digest tells you where you stopped, which specs are open, your hours and a plan for the day.",
    },
    {
      id: "specify",
      label: "specify",
      sub: ["what & why", "spec.md"],
      kind: "lead",
      group: "decide",
      doc: "01-architecture",
      x: 320,
      y: 160,
      w: 200,
      h: 110,
      does: "Spec Kit step one: write down what and why in spec.md.",
    },
    {
      id: "clarify",
      label: "clarify",
      sub: ["kill ambiguity", "always run"],
      kind: "lead",
      group: "decide",
      doc: "01-architecture",
      x: 548,
      y: 160,
      w: 200,
      h: 110,
      does: "Kill ambiguity before planning. This step is always run.",
    },
    {
      id: "plan",
      label: "plan",
      sub: ["how: research,", "data model, contracts"],
      kind: "lead",
      group: "decide",
      doc: "01-architecture",
      x: 776,
      y: 160,
      w: 200,
      h: 110,
      does: "How to build it: research, data model and contracts.",
    },
    {
      id: "tasks",
      label: "tasks",
      sub: ["units", "[P] = parallel"],
      kind: "lead",
      group: "decide",
      doc: "01-architecture",
      x: 1004,
      y: 160,
      w: 200,
      h: 110,
      does: "tasks.md becomes the units of work; [P] tasks become parallel-worktrees.",
    },
    {
      id: "analyze",
      label: "analyze",
      sub: ["consistency check", "before any code"],
      kind: "lead",
      group: "decide",
      doc: "01-architecture",
      x: 1232,
      y: 160,
      w: 200,
      h: 110,
      does: "A consistency check across spec, plan and tasks before any code is written.",
    },
    {
      id: "scout",
      label: "scouts",
      sub: ["Haiku · Gemini Flash", "map code via graphify"],
      kind: "google",
      group: "execute",
      model: "Haiku / Gemini Flash",
      doc: "01-architecture",
      x: 70,
      y: 385,
      w: 250,
      h: 115,
      does: "Map unfamiliar code by querying graphify, returning conclusions rather than file dumps.",
    },
    {
      id: "builder",
      label: "builders",
      sub: ["Sonnet in parallel", "worktrees, one per [P]"],
      kind: "native",
      group: "execute",
      model: "Sonnet",
      doc: "03-alethe",
      x: 350,
      y: 385,
      w: 250,
      h: 115,
      does: "[P] tasks go to Sonnet builders in parallel worktrees, one per task.",
    },
    {
      id: "free-worker",
      label: "free worker",
      sub: ["renames · i18n · boilerplate", "sandboxed, test-gated"],
      kind: "free",
      group: "execute",
      model: "9router/free",
      doc: "05-free-models",
      x: 630,
      y: 385,
      w: 250,
      h: 115,
      does: "Renames, i18n and boilerplate with tests go to free opencode; if the check fails, the cascade escalates to Sonnet.",
    },
    {
      id: "reviewer",
      label: "review-gate",
      sub: ["other provider", "reads the FULL diff"],
      kind: "neutral",
      group: "execute",
      doc: "03-alethe",
      x: 910,
      y: 385,
      w: 250,
      h: 115,
      does: "The full diff goes to a reviewer from another provider (agy Opus) that hunts for bugs; the lead validates and integrates.",
    },
    {
      id: "verify",
      label: "verify + commit",
      sub: ["tests · typecheck · evidence", "commit only on your ok"],
      kind: "lead",
      group: "execute",
      doc: "00-smart-vibe-coding",
      x: 1190,
      y: 385,
      w: 250,
      h: 115,
      does: "Run tests and typecheck, collect evidence, and commit only when you say so.",
    },
    {
      id: "graphify",
      label: "graphify",
      sub: ["query the graph,", "not the whole repo"],
      kind: "economy",
      group: "save",
      doc: "01-architecture",
      x: 70,
      y: 625,
      w: 320,
      h: 95,
      does: "Query the knowledge graph of the code instead of reading the whole repo.",
    },
    {
      id: "rtk",
      label: "RTK",
      sub: ["every shell command", "compressed"],
      kind: "economy",
      group: "save",
      doc: "01-architecture",
      x: 420,
      y: 625,
      w: 320,
      h: 95,
      does: "Every shell command's output is compressed before it reaches the model.",
    },
    {
      id: "caveman",
      label: "caveman",
      sub: ["terse replies to you;", "code stays normal"],
      kind: "economy",
      group: "save",
      doc: "01-architecture",
      x: 770,
      y: 625,
      w: 320,
      h: 95,
      does: "Terse replies to you; code, briefs and commits stay normal.",
    },
    {
      id: "one-topic",
      label: "one topic per chat",
      sub: ["/compact or new chat;", "spec files carry context"],
      kind: "neutral",
      group: "save",
      doc: "00-smart-vibe-coding",
      x: 1120,
      y: 625,
      w: 320,
      h: 95,
      does: "Compact or start a new chat per topic; the spec files carry the context across.",
    },
  ],
  edges: [
    { id: "hermes-specify", from: "hermes", to: "specify", kind: "hermes", flow: "status" },
    { id: "specify-clarify", from: "specify", to: "clarify", kind: "neutral", flow: "plan" },
    { id: "clarify-plan", from: "clarify", to: "plan", kind: "neutral", flow: "plan" },
    { id: "plan-tasks", from: "plan", to: "tasks", kind: "neutral", flow: "plan" },
    { id: "tasks-analyze", from: "tasks", to: "analyze", kind: "neutral", flow: "plan" },
    { id: "analyze-scout", from: "analyze", to: "scout", kind: "neutral", flow: "plan" },
    { id: "scout-builder", from: "scout", to: "builder", kind: "neutral", flow: "data" },
    { id: "builder-free-worker", from: "builder", to: "free-worker", kind: "neutral", flow: "data" },
    { id: "free-worker-reviewer", from: "free-worker", to: "reviewer", kind: "neutral", flow: "diff" },
    { id: "reviewer-verify", from: "reviewer", to: "verify", kind: "neutral", flow: "diff" },
    {
      id: "verify-specify",
      from: "verify",
      to: "specify",
      label: "next feature",
      kind: "optional",
      dashed: true,
      flow: "plan",
    },
  ],
};

/** ids present in BOTH graphs, so the views can morph between them. */
export const sharedIds: string[] = ["lead", "scout", "builder", "reviewer", "hermes", "rtk", "caveman", "graphify"];

/**
 * The 7 assembly steps for the scroll story. Each step lists only what it INTRODUCES
 * (architecture graph ids); the scene accumulates them.
 */
export type AssemblyStep = {
  id: string;
  caption: string;
  nodeIds: string[];
  groupIds: string[];
  edgeIds: string[];
};

export const assemblySteps: AssemblyStep[] = [
  {
    id: "you",
    caption: "It starts with you, at a terminal or on your phone.",
    nodeIds: ["you"],
    groupIds: [],
    edgeIds: [],
  },
  {
    id: "lead",
    caption: "The lead (Opus) holds the context, decides and integrates, and sends the rest away.",
    nodeIds: ["lead"],
    groupIds: [],
    edgeIds: ["you-lead"],
  },
  {
    id: "delegation",
    caption: "Delegation splits in two: native subagents for quick units, alethe for multi-provider work.",
    nodeIds: ["native", "alethe"],
    groupIds: ["delegation"],
    edgeIds: ["lead-native", "lead-alethe"],
  },
  {
    id: "workers",
    caption: "Workers spring out, each writer in its own isolated git worktree.",
    nodeIds: ["scout", "builder", "reviewer", "agy", "opencode", "codex"],
    groupIds: ["workers"],
    edgeIds: [
      "native-scout",
      "native-builder",
      "native-reviewer",
      "alethe-agy",
      "alethe-opencode",
      "alethe-codex",
    ],
  },
  {
    id: "free-models",
    caption: "The curator probes NVIDIA NIM 3x/day and rewrites the free combo in 9Router, which opencode-safe uses.",
    nodeIds: ["nim", "curator", "ninerouter"],
    groupIds: ["free-models"],
    edgeIds: ["nim-curator", "curator-ninerouter", "opencode-ninerouter"],
  },
  {
    id: "hermes",
    caption: "Hermes lights up: the daily collector and combo status feed it, and it pings you on your phone.",
    nodeIds: ["collector", "hermes"],
    groupIds: ["always-on"],
    edgeIds: ["curator-collector", "collector-hermes", "hermes-you"],
  },
  {
    id: "economy",
    caption: "The token economy layer wraps everything: RTK, caveman, graphify and a lean CLAUDE.md.",
    nodeIds: ["rtk", "caveman", "graphify", "lean-claude-md"],
    groupIds: ["economy"],
    edgeIds: [],
  },
];

/* ------------------------------------------------------------------ curator demo */

/** Constants mirrored from scripts/model-curator/curate.py. */
export const curatorConfig = {
  keep: 4,
  maxProbes: 14,
  maxLatencySec: 30,
  timeoutSec: 45,
  budgetMin: 11,
  combo: "free",
  chatPrompt: "Reply with exactly: OK",
  toolPrompt: "Call the get_time tool now.",
  toolName: "get_time",
  runsPerDay: 3,
} as const;

export type ProbeResult = { ok: boolean; latencySec?: number; error?: string };

export type CuratorRow = {
  model: string;
  family: string;
  /** rank from scripts/model-curator/models.json (lower = better) */
  rank: number;
  /** probe 1: chat "Reply with exactly: OK" */
  chat: ProbeResult;
  /** probe 2: get_time tool call; null when probe 1 failed (curate.py stops at the first error) */
  tool: (ProbeResult & { toolCall: boolean }) | null;
  /** probe 1 returned HTTP 200 but content and reasoning_content were both empty (curate.py "empty answer") */
  empty?: boolean;
};

export type CuratorStep = { id: string; title: string; detail: string };

/**
 * ILLUSTRATIVE rows: model families and ranks come from models.json and the failure
 * (410 Gone for GLM 5.2) from docs/05-free-models.md; the latencies are made up for the demo.
 */
export const curatorRows: CuratorRow[] = [
  {
    model: "nvidia/nemotron-3-ultra",
    family: "nemotron-3-ultra",
    rank: 1,
    chat: { ok: true, latencySec: 3.1 },
    tool: { ok: true, latencySec: 6.2, toolCall: true },
  },
  {
    model: "nvidia/glm-5.2",
    family: "glm-5",
    rank: 3,
    chat: { ok: false, error: "410 Gone: reached its end of life" },
    tool: null,
  },
  {
    model: "nvidia/minimax-m3",
    family: "minimax-m3",
    rank: 6,
    chat: { ok: true, latencySec: 11.7 },
    tool: { ok: true, latencySec: 19.4, toolCall: true },
  },
  {
    model: "nvidia/nemotron-3-super",
    family: "nemotron-3-super",
    rank: 7,
    chat: { ok: true, latencySec: 6.8 },
    tool: { ok: true, latencySec: 14.3, toolCall: true },
  },
  {
    model: "nvidia/gpt-oss-120b",
    family: "gpt-oss-120b",
    rank: 8,
    chat: { ok: true, latencySec: 4.5 },
    tool: { ok: true, latencySec: 9.1, toolCall: true },
  },
];

/** Slower of the two probes, as curate.py computes it; null when a probe failed. */
export function probeLatency(row: CuratorRow): number | null {
  if (!row.chat.ok || !row.tool || !row.tool.ok) return null;
  return Math.max(row.chat.latencySec ?? 0, row.tool.latencySec ?? 0);
}

/** healthy = answered AND made a tool call AND latency <= 30 s. */
export function isHealthy(row: CuratorRow, maxLatencySec: number = curatorConfig.maxLatencySec): boolean {
  const lat = probeLatency(row);
  return !row.empty && row.chat.ok && !!row.tool && row.tool.ok && row.tool.toolCall && lat !== null && lat <= maxLatencySec;
}

/** Best `keep` healthy models by family rank, then latency (what gets written to the combo). */
export function selectKept(rows: CuratorRow[], keep: number = curatorConfig.keep): string[] {
  return rows
    .filter((r) => isHealthy(r))
    .sort((a, b) => a.rank - b.rank || (probeLatency(a) ?? 0) - (probeLatency(b) ?? 0))
    .slice(0, keep)
    .map((r) => r.model);
}

/**
 * What curate.py writes: the best `keep` healthy models, or, when none is healthy,
 * the current combo unchanged ("no healthy model passed; combo left unchanged").
 */
export function selectOrKeep(rows: CuratorRow[], current: string[], keep: number = curatorConfig.keep): string[] {
  const kept = selectKept(rows, keep);
  return kept.length > 0 ? kept : current;
}

export const curatorSteps: CuratorStep[] = [
  {
    id: "list",
    title: "List",
    detail: "Fetch NVIDIA's public model list and keep only known good families (small, embedding, vision and safety models are excluded).",
  },
  {
    id: "probe",
    title: "Probe",
    detail: `Up to ${curatorConfig.maxProbes} models, two requests each: "${curatorConfig.chatPrompt}", then a ${curatorConfig.toolName} tool call. The run stops after ${curatorConfig.budgetMin} minutes.`,
  },
  {
    id: "judge",
    title: "Judge",
    detail: `Healthy means it answered, made the tool call and the slower probe took ${curatorConfig.maxLatencySec} s or less. Any error, such as HTTP 410 Gone, simply marks the model unhealthy.`,
  },
  {
    id: "rank",
    title: "Rank",
    detail: `Sort healthy models by family rank, then latency, and keep the best ${curatorConfig.keep}.`,
  },
  {
    id: "write",
    title: "Write",
    detail: `Back up 9Router's SQLite database, then rewrite the "${curatorConfig.combo}" combo. If nothing passes, the combo is left unchanged and an alert is recorded.`,
  },
];

const curatorBefore = ["nvidia/glm-5.2", "nvidia/nemotron-3-super", "nvidia/minimax-m3", "nvidia/gpt-oss-120b"];

export const curatorDemo = {
  config: curatorConfig,
  steps: curatorSteps,
  rows: curatorRows,
  /** combo before the run; the dead model sits in it, which takes down every call until the curator drops it */
  before: curatorBefore,
  after: selectOrKeep(curatorRows, curatorBefore),
};
