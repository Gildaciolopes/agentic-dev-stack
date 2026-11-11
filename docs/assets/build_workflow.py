#!/usr/bin/env python3
"""Generates the smart vibe coding workflow diagram (dark theme), EN + PT-BR:
  workflow.excalidraw / workflow.pt-BR.excalidraw
Render: node render.mjs workflow.excalidraw workflow.svg /tmp/w.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from excal_lib import (BLUE, DIM, GRAY, GREEN, MUTED, ORANGE, PINK, TEAL, YELLOW,  # noqa: E402
                       arrow, box, path, reset, save, text, zone)

T = {
    "en": dict(
        title="smart vibe coding workflow",
        sub="spec first · cheap models for volume · independent review · minimum tokens",
        z1="1 · decide: lead (Opus) + you   (Spec Kit)",
        steps=[("specify", "what & why\nspec.md"), ("clarify", "kill ambiguity\nalways run"), ("plan", "how: research,\ndata model, contracts"),
               ("tasks", "units\n[P] = parallel"), ("analyze", "consistency check\nbefore any code")],
        z2="2 · execute: delegated (alethe / subagents)",
        ex=[("scouts", "Haiku · Gemini Flash\nmap code via graphify", TEAL), ("builders", "Sonnet in parallel\nworktrees, one per [P]", GREEN),
            ("free worker", "renames · i18n · boilerplate\nsandboxed, test-gated", ORANGE), ("review-gate", "other provider\nreads the FULL diff", YELLOW),
            ("verify + commit", "tests · typecheck · evidence\ncommit only on your ok", BLUE)],
        hermes=("Hermes · 08:00", "\"where did I stop?\"\nspecs · hours · plan of the day"),
        z3="3 · save tokens on every turn",
        tok=[("graphify", "query the graph,\nnot the whole repo"), ("RTK", "every shell command\ncompressed"),
             ("caveman", "terse replies to you;\ncode stays normal"), ("one topic per chat", "/compact or new chat;\nspec files carry context")],
        loop="next feature",
    ),
    "pt-BR": dict(
        title="fluxo do vibe coding inteligente",
        sub="spec primeiro · modelos baratos no volume · revisão independente · mínimo de tokens",
        z1="1 · decidir: lead (Opus) + você   (Spec Kit)",
        steps=[("specify", "o quê e por quê\nspec.md"), ("clarify", "mata ambiguidade\nsempre rodar"), ("plan", "como: pesquisa,\nmodelo de dados, contratos"),
               ("tasks", "unidades\n[P] = paralelo"), ("analyze", "checa consistência\nantes do código")],
        z2="2 · executar: delegado (alethe / subagentes)",
        ex=[("scouts", "Haiku · Gemini Flash\nmapeiam via graphify", TEAL), ("builders", "Sonnet em paralelo\nworktree por task [P]", GREEN),
            ("worker grátis", "rename · i18n · boilerplate\nem sandbox, com teste", ORANGE), ("review-gate", "outro provedor\nlê o diff COMPLETO", YELLOW),
            ("verificar + commit", "testes · typecheck · evidência\ncommit só com seu ok", BLUE)],
        hermes=("Hermes · 08:00", "\"onde eu parei?\"\nspecs · horas · plano do dia"),
        z3="3 · economizar tokens em todo turno",
        tok=[("graphify", "consulta o grafo,\nnão o repo inteiro"), ("RTK", "todo comando de shell\ncomprimido"),
             ("caveman", "respostas enxutas;\ncódigo fica normal"), ("um assunto por chat", "/compact ou chat novo;\nos specs levam o contexto")],
        loop="próxima feature",
    ),
}


def build(lang):
    t = T[lang]
    reset(11)
    W = 1500
    text(W / 2, 20, t["title"], 38)
    text(W / 2, 68, t["sub"], 18, color=MUTED)

    # lane 1: decisions
    zone(40, 120, 1420, 175, t["z1"], "#14191f")
    box(70, 165, 200, 100, *t["hermes"], bg=PINK, tsize=18, ssize=13)
    xs = [320 + i * 228 for i in range(5)]
    for i, (x, (title, sub)) in enumerate(zip(xs, t["steps"])):
        box(x, 160, 200, 110, title, sub, bg=BLUE, tsize=22, ssize=14)
        if i:
            arrow(xs[i - 1] + 202, 215, x - 2, 215)
    arrow(272, 215, 318, 215, color="#da77f2")

    # lane 2: execution
    zone(40, 335, 1420, 205, t["z2"], "#17191c", bottom=True)
    ex_x = [70 + i * 280 for i in range(5)]
    for i, (x, (title, sub, bg)) in enumerate(zip(ex_x, t["ex"])):
        box(x, 385, 250, 115, title, sub, bg=bg, tsize=21, ssize=14)
    path([(1232, 272), (1232, 312), (195, 312), (195, 381)], color="#ced4da")
    for i in range(1, 5):
        arrow(ex_x[i - 1] + 252, 442, ex_x[i] - 2, 442)
    # loop back to specify
    path([(1445, 442), (1482, 442), (1482, 104), (420, 104), (420, 156)], style="dashed", color=DIM)
    text(1300, 82, t["loop"], 14, color=DIM, align="left")

    # lane 3: token economy
    zone(40, 580, 1420, 165, t["z3"], "#14191f")
    for i, (title, sub) in enumerate(t["tok"]):
        box(70 + i * 350, 625, 320, 95, title, sub, bg=GRAY if i == 3 else GREEN if i == 0 else BLUE, tsize=20, ssize=14)

    here = os.path.dirname(os.path.abspath(__file__))
    save(os.path.join(here, "workflow.excalidraw" if lang == "en" else f"workflow.{lang}.excalidraw"))


if __name__ == "__main__":
    for lang in T:
        build(lang)
