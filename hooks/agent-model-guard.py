#!/usr/bin/env python3
"""PreToolUse guard for the Agent tool: no subagent may silently run on Opus/Fable.

Allowed:
  - scout / builder / reviewer (model pinned in ~/.claude/agents/*.md frontmatter)
  - any other agent type WITH an explicit cheap model (haiku | sonnet)
  - helper agents with their own definitions (claude-code-guide, web-fetch, statusline-setup)
Denied:
  - generic types (general-purpose, Explore, Plan, claude, or none) without model, or with opus/fable
  - fork (always inherits the lead model)
Escape hatch for a deliberate exception: export ALLOW_OPUS_SUBAGENT=1 before starting claude.
"""
import json
import os
import sys

PINNED = {"scout", "builder", "reviewer", "claude-code-guide", "web-fetch", "statusline-setup"}
CHEAP = {"haiku", "sonnet"}

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if os.environ.get("ALLOW_OPUS_SUBAGENT") == "1":
    sys.exit(0)

ti = data.get("tool_input") or {}
kind = (ti.get("subagent_type") or "general-purpose").strip()
model = (ti.get("model") or "").strip().lower()

reason = None
if kind == "fork":
    reason = "fork herda o modelo da sessão principal (Opus)."
elif kind not in PINNED and model not in CHEAP:
    reason = (f"subagent_type '{kind}' sem model barato (recebido: '{model or 'nenhum'}') rodaria no Opus.")

if reason:
    msg = (
        f"Bloqueado pelo agent-model-guard: {reason} "
        "Use: subagent `scout` (leitura, haiku), `builder` (implementação, sonnet), `reviewer` (revisão, sonnet), "
        "ou passe model: \"haiku\"/\"sonnet\". Para várias unidades ou workers de outro provedor (agy/opencode), "
        "use o alethe: python3 .claude/skills/alethe/scripts/orchestrate.py (seção 'Orquestração multi-agente' do CLAUDE.md). "
        "Opus fica só com o lead."
    )
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": msg,
    }}))
sys.exit(0)
