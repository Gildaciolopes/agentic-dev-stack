#!/usr/bin/env python3
"""Generates the architecture diagram (dark theme) in English and Brazilian Portuguese:
  architecture.excalidraw / architecture.pt-BR.excalidraw  (editable at excalidraw.com)
Render to SVG (fonts embedded) locally with headless Chrome:
  npm i --no-save playwright-core && node render.mjs architecture.excalidraw architecture.svg /tmp/a.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from excal_lib import (BLUE, DIM, GRAY, GREEN, MUTED, NEUTRAL, ORANGE, PINK, RED, TEAL, YELLOW,  # noqa: E402
                       arrow, box, path, reset, save, text, zone)

T = {
    "en": dict(
        sub="the expensive model plans · cheap models execute · an independent reviewer checks",
        you=("you", "terminal · phone"),
        lead=("LEAD · Claude Code (Opus)", "plans · decides · integrates · validates\nSpec Kit SDD · graphify · RTK · caveman"),
        z_deleg="delegation layer",
        native=("native subagents", "scout · builder · reviewer\nOpus blocked by agent-model-guard"),
        alethe=("alethe · orchestrator", "playbooks · tier per task · quota · provider switch\npassive mode · cost report"),
        z_workers="workers (writers in isolated git worktrees)",
        scout=("scout", "Haiku\nreads with shell"), builder=("builder", "Sonnet\nbuilds the unit\nOpus if deep/risky"),
        reviewer=("reviewer", "Sonnet\nreviews the diff"), agy=("agy", "Gemini Flash: scout\nClaude Opus: review\nGoogle quota"),
        oc=("opencode-safe", "9router/free\nmechanical · free\nkernel sandbox"), codex=("codex", "pluggable\nbuilder · reviewer\nquota fallback"),
        z_free="free models (self-healing)", nim=("NVIDIA NIM", "free open models\n40 req/min"),
        cur=("curator · 3x/day", "answers? tool call?\nlatency ≤ 30s"), nr=("9Router", "\"free\" combo\nfallback · :20128"),
        probes="probes", writes="writes", uses="uses",
        z_on="always on", col=("daily collector", "git · quota · specs\nhours · AI radar"), her=("Hermes", "Discord / Telegram\nno shell"),
        status="combo status", phone="08:00 digest\nalerts · questions\nfrom your phone",
        z_tok="token economy (always on)",
        tok=[("RTK", "compresses shell output\n(input tokens)"), ("caveman", "terse replies\n(output tokens)"),
             ("graphify", "query the graph\nbefore reading code"), ("lean CLAUDE.md", "only non-inferable facts\n+ /compact per topic")],
        legend="green: native Claude  ·  teal: Google (agy)  ·  orange: free  ·  dashed gray: optional (Codex, Kiro, Copilot…)",
    ),
    "pt-BR": dict(
        sub="o modelo caro planeja · os baratos executam · um revisor independente confere",
        you=("você", "terminal · celular"),
        lead=("LEAD · Claude Code (Opus)", "planeja · decide · integra · valida\nSpec Kit SDD · graphify · RTK · caveman"),
        z_deleg="camada de delegação",
        native=("subagentes nativos", "scout · builder · reviewer\nOpus bloqueado pelo agent-model-guard"),
        alethe=("alethe · orquestrador", "playbooks · tier por tarefa · cota · troca de provedor\nmodo passivo · relatório de custo"),
        z_workers="workers (writers em git worktree isolada)",
        scout=("scout", "Haiku\nleitura com shell"), builder=("builder", "Sonnet\nimplementa a unidade\nOpus se deep/risky"),
        reviewer=("reviewer", "Sonnet\nrevisa o diff"), agy=("agy", "Gemini Flash: scout\nClaude Opus: revisão\ncota Google"),
        oc=("opencode-safe", "9router/free\nmecânico · grátis\nsandbox de kernel"), codex=("codex", "plugável\nbuilder · revisor\nfallback de cota"),
        z_free="modelos grátis (auto-reparo)", nim=("NVIDIA NIM", "modelos abertos grátis\n40 req/min"),
        cur=("curador · 3x/dia", "responde? tool call?\nlatência ≤ 30s"), nr=("9Router", "combo \"free\"\nfallback · :20128"),
        probes="testa", writes="grava", uses="usa",
        z_on="sempre ligado", col=("coletor diário", "git · cota · specs\nhoras · radar de IA"), her=("Hermes", "Discord / Telegram\nsem shell"),
        status="status do combo", phone="resumo 08:00\navisos · perguntas\npelo celular",
        z_tok="economia de tokens (sempre ligada)",
        tok=[("RTK", "comprime saída do shell\n(tokens de entrada)"), ("caveman", "respostas enxutas\n(tokens de saída)"),
             ("graphify", "consulta o grafo\nantes de ler código"), ("CLAUDE.md enxuto", "só o que não dá pra inferir\n+ /compact por assunto")],
        legend="verde: Claude nativo  ·  azul-petróleo: Google (agy)  ·  laranja: grátis  ·  cinza tracejado: opcional (Codex, Kiro, Copilot…)",
    ),
}


def build(lang):
    t = T[lang]
    reset(7)
    W = 1500
    text(W / 2, 20, "agentic-dev-stack", 40)
    text(W / 2, 68, t["sub"], 18, color=MUTED)
    box(60, 140, 170, 80, *t["you"], bg=NEUTRAL, kind="ellipse", tsize=24)
    box(380, 125, 740, 115, *t["lead"], bg=BLUE, tsize=26, ssize=16)
    arrow(232, 180, 376, 180)

    zone(40, 290, 1420, 150, t["z_deleg"], "#17191c")
    box(90, 325, 560, 95, *t["native"], bg=GREEN)
    box(850, 325, 560, 95, *t["alethe"], bg=YELLOW)
    arrow(600, 242, 400, 322)
    arrow(900, 242, 1110, 322)

    zone(40, 480, 1420, 225, t["z_workers"], "#17191c", bottom=True)
    wy, wh, ww = 525, 135, 210
    cols = [(70, "scout", GREEN, "solid"), (295, "builder", GREEN, "solid"), (520, "reviewer", GREEN, "solid"),
            (775, "agy", TEAL, "solid"), (1000, "oc", ORANGE, "solid"), (1225, "codex", GRAY, "dashed")]
    for x, k, bg, st in cols:
        box(x, wy, ww, wh, *t[k], bg=bg, style=st, tsize=21, ssize=14)
    for x in (175, 400, 625):
        arrow(370, 422, x, wy - 4, color="#51cf66")
    for x in (880, 1105, 1330):
        arrow(1130, 422, x, wy - 4, color="#ff922b", style="dashed" if x == 1330 else "solid")

    zone(40, 735, 900, 200, t["z_free"], "#1c1617")
    box(70, 765, 250, 105, *t["nim"], bg=GRAY, tsize=20, ssize=14)
    box(380, 765, 230, 105, *t["cur"], bg=RED, tsize=20, ssize=14)
    box(670, 765, 240, 105, *t["nr"], bg=RED, tsize=20, ssize=14)
    arrow(322, 817, 376, 817)
    text(349, 790, t["probes"], 14, color=DIM)
    arrow(612, 817, 666, 817)
    text(639, 790, t["writes"], 14, color=DIM)
    arrow(1105, 662, 860, 762, t["uses"], color="#ff922b")

    zone(980, 735, 480, 200, t["z_on"], "#1b161d")
    box(1010, 765, 200, 105, *t["col"], bg=GRAY, tsize=20, ssize=14)
    box(1250, 765, 190, 105, *t["her"], bg=PINK, tsize=22, ssize=14)
    arrow(1212, 817, 1246, 817)
    path([(495, 872), (495, 902), (1110, 902), (1110, 874)], style="dashed", color=DIM)
    text(800, 906, t["status"], 14, color=DIM)
    path([(1440, 762), (1440, 712), (1478, 712), (1478, 112), (145, 112), (145, 137)], style="dashed", color="#da77f2")
    text(1285, 150, t["phone"], 16, color="#da77f2")

    zone(40, 965, 1420, 150, t["z_tok"], "#14191f")
    for i, (title, sub) in enumerate(t["tok"]):
        box(70 + i * 350, 1000, 320, 90, title, sub, bg=BLUE, tsize=20, ssize=14)

    text(40, 1135, t["legend"], 15, color=DIM, align="left", w=1100)
    here = os.path.dirname(os.path.abspath(__file__))
    save(os.path.join(here, "architecture.excalidraw" if lang == "en" else f"architecture.{lang}.excalidraw"))


if __name__ == "__main__":
    for lang in T:
        build(lang)
