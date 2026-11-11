#!/usr/bin/env node
// PreToolUse guard for Claude Code's Agent tool: no subagent may silently run on Opus/Fable.
// Generic subagents (general-purpose, Explore, Plan) inherit the main session model, so on an
// Opus session they run on Opus unless a cheap model is passed. A rule in CLAUDE.md is not
// enforcement; this hook is.
//
// Allowed: scout / builder / reviewer (model pinned in frontmatter), helper agents with their own
//          definitions, and any agent type WITH model "haiku" | "sonnet".
// Denied:  generic types without a cheap model, explicit opus/fable, and fork (inherits the lead).
// Escape hatch for a deliberate exception: start claude with ALLOW_OPUS_SUBAGENT=1.
// Extra pinned agents: AGENT_GUARD_ALLOW="my-agent,other-agent".

const PINNED = new Set(["scout", "builder", "reviewer", "claude-code-guide", "web-fetch", "statusline-setup",
  ...(process.env.AGENT_GUARD_ALLOW || "").split(",").map((s) => s.trim()).filter(Boolean)]);
const CHEAP = new Set(["haiku", "sonnet"]);

export function decide(input, env = process.env) {
  if (env.ALLOW_OPUS_SUBAGENT === "1") return null;
  const ti = (input && input.tool_input) || {};
  const kind = String(ti.subagent_type || "general-purpose").trim();
  const model = String(ti.model || "").trim().toLowerCase();
  let reason = null;
  if (kind === "fork") reason = "fork inherits the main session model (Opus).";
  else if (!PINNED.has(kind) && !CHEAP.has(model))
    reason = `subagent_type '${kind}' without a cheap model (got '${model || "none"}') would run on Opus.`;
  if (!reason) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `Blocked by agent-model-guard: ${reason} Use subagent \`scout\` (read-only, haiku), \`builder\` (implementation, sonnet), ` +
        "`reviewer` (review, sonnet), or pass model: \"haiku\"/\"sonnet\". For several units or other providers (agy/codex/opencode) " +
        "use alethe: python3 .claude/skills/alethe/scripts/orchestrate.py (see the 'alethe' section of CLAUDE.md). Opus stays with the lead.",
    },
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    let input = {};
    try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }
    const out = decide(input);
    if (out) process.stdout.write(JSON.stringify(out));
    process.exit(0);
  });
}
