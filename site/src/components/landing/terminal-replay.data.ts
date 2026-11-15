/**
 * Wizard transcript. Product output, not marketing copy, so it lives next to the player rather than in messages.
 * Script: docs/assets/demo/demo.html (wizardScene, the source of demo.gif).
 * Prompts and option labels: lib/i18n.mjs:8-63. Doctor check names: lib/doctor.mjs:24-46.
 */
export type Cls = "p" | "g" | "d" | "y" | "k" | "h" | "c";
export type Seg = string | readonly [Cls, string];
export type Line = readonly Seg[];
export type Frame = { dur: number; lines: Line[] };
export type Step = { frames?: Frame[]; commit: Line[]; pause?: number; stagger?: number };
export type Act = { cmd: string; head?: Line[]; steps: Step[] };

const q = (msg: string, extra?: string): Line => [["k", "? "], ["c", msg], ...(extra ? ([["d", `  ${extra}`]] as Seg[]) : [])];
const ans = (msg: string, v: string): Line => [["g", "✔ "], ["c", `${msg} `], ["k", v]];
const ok = (...s: Seg[]): Line => [["g", "  ✓ "], ...s];

function select(msg: string, opts: string[], cur: number, hints: string[] = []): Line[] {
  return [
    q(msg, "↑/↓ enter"),
    ...opts.map((o, i): Line => [i === cur ? (["k", `❯ ${o}`] as const) : `  ${o}`, ...(hints[i] ? ([["d", `  ${hints[i]}`]] as Seg[]) : [])]),
  ];
}

function multi(msg: string, opts: { label: string; hint?: string; lock?: boolean }[], on: number[], cur: number): Line[] {
  return [
    q(msg, "space toggle · enter confirm"),
    ...opts.map((o, i): Line => [
      i === cur ? (["k", "❯"] as const) : " ",
      " ",
      o.lock ? (["d", "◉"] as const) : on.includes(i) ? (["g", "◉"] as const) : "◯",
      " ",
      i === cur ? (["k", o.label] as const) : o.label,
      ...(o.lock ? ([["d", "  (always)"]] as Seg[]) : []),
      ...(o.hint ? ([["d", `  ${o.hint}`]] as Seg[]) : []),
    ]),
  ];
}

const mask = (n: number): Line[] => [q("NVIDIA API key", "free at build.nvidia.com"), [["k", "› "], "•".repeat(n), ["k", "▏"]]];

const COMPONENTS = [
  { label: "Core: Opus guard, scout/builder/reviewer subagents, RTK", lock: true },
  { label: "caveman", hint: "terse replies, fewer output tokens" },
  { label: "Spec Kit", hint: "spec-driven development (/speckit.*)" },
  { label: "graphify", hint: "code knowledge graph, fewer file reads" },
  { label: "Antigravity CLI (agy)", hint: "Gemini scouts + Opus reviews on Google quota" },
  { label: "Free-model worker (OpenCode, sandboxed)", hint: "mechanical edits at zero cost" },
  { label: "Free models (9Router + NVIDIA NIM + curator)", hint: "self-healing free combo" },
  { label: "Hermes assistant (Discord/Telegram)", hint: "daily digest + alerts on your phone" },
];
const BASE = [1, 2, 3, 4, 6, 7];

const DIGEST = [
  "Free-model status",
  "Tokens and quota",
  "Tool updates",
  "Spec Kit progress",
  "AI radar (news that affects your setup)",
  "What you did yesterday",
  "Hours per project",
  "3 priorities for today",
].map((label) => ({ label }));

const PRESET = ["Recommended", "Token savers only", "Custom"];
const PRESET_H = [
  "everything that fits this OS: orchestration, free models, token savers, Hermes",
  "guard + subagents + RTK + caveman + Spec Kit + graphify (no workers, no Hermes)",
  "pick each component",
];
const CAVEMAN = ["caveman: terse", "megacave: terser", "ultracave: maximum compression", "off: install, start disabled"];
const CURATOR = ["3x a day (07:30 13:30 19:30)", "2x a day (08:00 18:00)", "Every 3 hours while you work (08-23h)", "Custom times"];
const PLATFORM = ["Discord", "Telegram", "Nowhere for now (local only)"];
const MENU = [
  "Update / repair",
  "Change settings",
  "Wire more projects",
  "Create a new project",
  "Check the installation (doctor)",
  "Uninstall",
  "Exit",
];
const MENU_H = [
  "re-run the install with your saved answers + refresh wired projects",
  "answer the questions again (pre-filled with your current choices)",
];

const banner: Line[] = [
  [["c", "  agentic-dev-"], ["y", "stack"]],
  [["d", "  smart vibe coding: Opus plans, cheap & free models execute, another provider reviews"]],
  [""],
];

/** doctor output on a default install (lib/doctor.mjs:24-46); Codex is off by default. */
const DOCTOR_NAMES: [string, boolean?][] = [
  ["Claude Code"],
  ["RTK"],
  ["agent-model-guard hook"],
  ["default subagent model = sonnet"],
  ["subagents scout/builder/reviewer"],
  ["orchestration block in ~/.claude/CLAUDE.md"],
  ["caveman"],
  ["Spec Kit (specify)"],
  ["graphify"],
  ["alethe (audited)"],
  ["Antigravity CLI (agy)"],
  ["OpenCode"],
  ["opencode-safe (sandboxed free worker)"],
  ["Codex", true],
  ["9Router"],
  ["9Router running"],
  ["NVIDIA NIM provider in 9Router"],
  ["combo 'free'"],
  ["curator scheduled"],
  ["Hermes Agent"],
  ["digest collector scheduled"],
];

const doctorLines: Line[] = DOCTOR_NAMES.map(([name, off]): Line => (off ? [["d", `  · ${name}  (disabled)`]] : [["g", "  ✓ "], name]));

export const ACTS: Act[] = [
  {
    cmd: "npx agentic-dev-stack",
    head: banner,
    steps: [
      {
        frames: [
          { dur: 800, lines: select("How much do you want to install?", PRESET, 0, PRESET_H) },
          { dur: 800, lines: select("How much do you want to install?", PRESET, 2, PRESET_H) },
        ],
        commit: [ans("How much do you want to install?", "Custom")],
      },
      {
        frames: [
          { dur: 600, lines: multi("Pick the components", COMPONENTS, BASE, 1) },
          { dur: 260, lines: multi("Pick the components", COMPONENTS, BASE, 2) },
          { dur: 260, lines: multi("Pick the components", COMPONENTS, BASE, 3) },
          { dur: 260, lines: multi("Pick the components", COMPONENTS, BASE, 4) },
          { dur: 500, lines: multi("Pick the components", COMPONENTS, BASE, 5) },
          { dur: 900, lines: multi("Pick the components", COMPONENTS, [...BASE, 5], 5) },
        ],
        commit: [ans("Pick the components", "caveman, Spec Kit, graphify, agy, free worker, free models, Hermes")],
      },
      {
        frames: [
          { dur: 700, lines: select("caveman default intensity", CAVEMAN, 0) },
          { dur: 800, lines: select("caveman default intensity", CAVEMAN, 2) },
        ],
        commit: [ans("caveman default intensity", "ultracave")],
      },
      {
        frames: [0, 5, 10, 16, 22, 28].map((n) => ({ dur: 200, lines: mask(n) })),
        commit: [ans("NVIDIA API key", "•••• (saved)")],
        pause: 200,
      },
      {
        frames: [{ dur: 1000, lines: select("How often should the curator re-check the free models?", CURATOR, 0) }],
        commit: [ans("How often should the curator re-check the free models?", "3x a day (07:30 13:30 19:30)")],
      },
      {
        frames: [{ dur: 900, lines: select("Where should Hermes talk to you?", PLATFORM, 0) }],
        commit: [ans("Where should Hermes talk to you?", "Discord")],
      },
      {
        frames: [{ dur: 900, lines: [q("Discord bot token"), [["k", "› "], "•".repeat(32)]] }],
        commit: [ans("Discord bot token", "•••• (saved)"), ok("Bot verified: dev-hermes")],
        pause: 200,
      },
      {
        frames: [
          { dur: 500, lines: multi("What goes into the daily digest?", DIGEST, [0, 1, 2, 3, 4, 5, 6], 7) },
          { dur: 800, lines: multi("What goes into the daily digest?", DIGEST, [0, 1, 2, 3, 4, 5, 6, 7], 7) },
        ],
        commit: [ans("What goes into the daily digest?", "all")],
      },
      {
        frames: [{ dur: 800, lines: [q("Daily digest time (HH:MM)"), [["k", "› "], "08:00"]] }],
        commit: [ans("Daily digest time (HH:MM)", "08:00")],
      },
      {
        frames: [{ dur: 900, lines: [[["k", "? "], ["c", "Install now?"], "  ", ["k", "Yes"], " / no"]] }],
        commit: [ans("Install now?", "Yes")],
        pause: 300,
      },
      {
        commit: [
          [["h", "==> "], "core · workers · free-models · hermes"],
          ok("9Router: NVIDIA connected · combo 'free' created · OpenCode -> 9router/free"),
          ok("Hermes: daily-digest 08:00 · 3 projects wired (append-only)"),
          [["g", "◆ All set ✔ "], ["d", "  next: open a project and run claude"]],
        ],
        stagger: 350,
        pause: 1200,
      },
    ],
  },
  {
    cmd: "npx agentic-dev-stack",
    steps: [
      {
        frames: [0, 1, 2, 3, 4].map((cur) => ({
          dur: cur === 0 ? 900 : cur === 4 ? 1000 : 320,
          lines: select("agentic-dev-stack is already installed here. What do you want to do?", MENU, cur, MENU_H),
        })),
        commit: [ans("What do you want to do?", "Check the installation (doctor)")],
      },
      {
        commit: [[["h", "==> doctor"]], ...doctorLines, [""], [["d", "  platform: macOS"]]],
        stagger: 110,
        pause: 600,
      },
    ],
  },
];
