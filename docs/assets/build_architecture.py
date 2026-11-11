#!/usr/bin/env python3
"""Generates docs/assets/architecture.excalidraw (editable in excalidraw.com).
Render locally to SVG (fonts embedded) + PNG preview, using the official @excalidraw/excalidraw exportToSvg in headless Chrome:
  cd docs/assets && npm i --no-save playwright-core && node render.mjs architecture.excalidraw architecture.svg /tmp/preview.png
"""
import json
import os
import random

random.seed(7)
EL = []
FONT = 5  # Excalifont

# ---------- dark theme (native colors, no invert filter) ----------
BG = "#121212"      # excalidraw dark canvas
FG = "#e9ecef"      # primary text / default stroke
MUTED = "#adb5bd"   # subtitles
DIM = "#868e96"     # zone labels, annotations
# (fill, stroke): dark fill + vivid outline keeps light text readable
BLUE = ("#1c3a5e", "#4dabf7")
YELLOW = ("#4a3c0c", "#fcc419")
GREEN = ("#163d2b", "#51cf66")
TEAL = ("#0c3f3a", "#38d9a9")
ORANGE = ("#4d2a0d", "#ff922b")
RED = ("#4a1a20", "#ff6b6b")
PINK = ("#3f1a45", "#da77f2")
GRAY = ("#25282c", "#868e96")
NEUTRAL = ("#1e2125", "#ced4da")


def _base(kind, x, y, w, h, **kw):
    e = {"id": f"e{len(EL)}", "type": kind, "x": x, "y": y, "width": w, "height": h, "angle": 0,
         "strokeColor": kw.get("stroke", FG), "backgroundColor": kw.get("bg", "transparent"),
         "fillStyle": kw.get("fill", "solid"), "strokeWidth": kw.get("sw", 2), "strokeStyle": kw.get("style", "solid"),
         "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None,
         "roundness": {"type": 3} if kind in ("rectangle", "diamond") else None,
         "seed": random.randint(1, 2**31), "version": 1, "versionNonce": random.randint(1, 2**31),
         "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False}
    EL.append(e)
    return e


def text(x, y, s, size=20, color=FG, align="center", w=None):
    lines = s.split("\n")
    tw = w or max(len(l) for l in lines) * size * 0.55
    th = len(lines) * size * 1.25
    e = _base("text", x - (tw / 2 if align == "center" else 0), y, tw, th, stroke=color)
    e.update({"text": s, "originalText": s, "fontSize": size, "fontFamily": FONT, "textAlign": align,
              "verticalAlign": "top", "containerId": None, "lineHeight": 1.25, "autoResize": True})
    return e


def box(x, y, w, h, title, sub=None, bg=NEUTRAL, style="solid", tsize=22, ssize=15, kind="rectangle"):
    _base(kind, x, y, w, h, bg=bg[0], stroke=bg[1], style=style)
    n_sub = sub.count("\n") + 1 if sub else 0
    total = tsize * 1.25 + (n_sub * ssize * 1.25 + 6 if sub else 0)
    top = y + (h - total) / 2
    text(x + w / 2, top, title, tsize)
    if sub:
        text(x + w / 2, top + tsize * 1.25 + 6, sub, ssize, color=MUTED)
    return (x, y, w, h)


def arrow(x1, y1, x2, y2, label=None, style="solid", color="#ced4da", both=False):
    e = _base("arrow", x1, y1, x2 - x1, y2 - y1, style=style, stroke=color)
    e.update({"points": [[0, 0], [x2 - x1, y2 - y1]], "lastCommittedPoint": None, "startBinding": None,
              "endBinding": None, "startArrowhead": "arrow" if both else None, "endArrowhead": "arrow", "elbowed": False})
    if label:
        text((x1 + x2) / 2 + 8, (y1 + y2) / 2 - 10, label, 14, color=DIM, align="left", w=len(label) * 14 * 0.55)


def path(pts, style="solid", color="#ced4da"):
    x0, y0 = pts[0]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    e = _base("arrow", x0, y0, max(xs) - min(xs), max(ys) - min(ys), style=style, stroke=color)
    e.update({"points": [[px - x0, py - y0] for px, py in pts], "lastCommittedPoint": None, "startBinding": None,
              "endBinding": None, "startArrowhead": None, "endArrowhead": "arrow", "elbowed": False})
    e["roundness"] = None


def zone(x, y, w, h, label, color, bottom=False):
    _base("rectangle", x, y, w, h, bg=color, fill="solid", style="dashed", sw=1, stroke="#495057")
    text(x + 14, (y + h - 26) if bottom else (y + 8), label, 16, color=DIM, align="left")



W = 1500
text(W / 2, 20, "agentic-dev-stack", 40)
text(W / 2, 68, "o modelo caro planeja · os baratos executam · um revisor independente confere", 18, color=MUTED)

# you
box(60, 140, 170, 80, "você", "terminal · celular", bg=NEUTRAL, kind="ellipse", tsize=24)
# lead
box(380, 125, 740, 115, "LEAD · Claude Code (Opus)", "planeja · decide · integra · valida\nSpec Kit  ·  graphify  ·  RTK  ·  caveman", bg=BLUE, tsize=26, ssize=16)
arrow(232, 180, 376, 180)

# delegation layer
zone(40, 290, 1420, 150, "camada de delegação", "#17191c")
box(90, 325, 560, 95, "subagentes nativos", "scout · builder · reviewer\nbloqueados em Opus pelo agent-model-guard", bg=GREEN)
box(850, 325, 560, 95, "alethe · orquestrador", "playbooks · tier por tarefa · cota · troca de provedor\nmodo passivo · relatório de custo", bg=YELLOW)
arrow(600, 242, 400, 322)
arrow(900, 242, 1110, 322)

# workers
zone(40, 480, 1420, 225, "workers (writers em git worktree isolada)", "#17191c", bottom=True)
wy, wh, ww = 525, 135, 210
cols = [
    (70, "scout", "Haiku\nleitura com shell", GREEN, "solid"),
    (295, "builder", "Sonnet\nimplementa a unidade\nOpus se deep/risky", GREEN, "solid"),
    (520, "reviewer", "Sonnet\nrevisa o diff", GREEN, "solid"),
    (775, "agy", "Gemini Flash: scout\nClaude Opus: revisão\ncota Google", TEAL, "solid"),
    (1000, "opencode-safe", "9router/free\nmecânico · grátis\nsandbox de kernel", ORANGE, "solid"),
    (1225, "codex", "plugável\nbuilder · revisor\nfallback de cota", GRAY, "dashed"),
]
for x, t, s, bg, st in cols:
    box(x, wy, ww, wh, t, s, bg=bg, style=st, tsize=21, ssize=14)
for x in (175, 400, 625):
    arrow(370, 422, x, wy - 4, color="#51cf66")
for x in (880, 1105, 1330):
    arrow(1130, 422, x, wy - 4, color="#ff922b", style="dashed" if x == 1330 else "solid")

# free models
zone(40, 735, 900, 200, "modelos grátis (auto-reparo)", "#1c1617")
box(70, 765, 250, 105, "NVIDIA NIM", "modelos abertos grátis\n40 req/min", bg=GRAY, tsize=20, ssize=14)
box(380, 765, 230, 105, "curador · 3x/dia", "responde? tool call?\nlatência ≤ 30s", bg=RED, tsize=20, ssize=14)
box(670, 765, 240, 105, "9Router", "combo \"free\"\nfallback · :20128", bg=RED, tsize=20, ssize=14)
arrow(322, 817, 376, 817)
text(349, 790, "testa", 14, color=DIM)
arrow(612, 817, 666, 817)
text(639, 790, "grava", 14, color=DIM)
arrow(1105, 662, 860, 762, "usa", color="#ff922b")

# always on
zone(980, 735, 480, 200, "sempre ligado", "#1b161d")
box(1010, 765, 200, 105, "coletor diário", "git · cota · specs\nhoras · radar de IA", bg=GRAY, tsize=20, ssize=14)
box(1250, 765, 190, 105, "Hermes", "Discord / Telegram\nsem shell", bg=PINK, tsize=22, ssize=14)
arrow(1212, 817, 1246, 817)
path([(495, 872), (495, 902), (1110, 902), (1110, 874)], style="dashed", color=DIM)
text(800, 906, "status do combo", 14, color=DIM)
# hermes -> you (phone)
path([(1440, 762), (1440, 712), (1478, 712), (1478, 112), (145, 112), (145, 137)], style="dashed", color="#da77f2")
text(1285, 150, "resumo 08:00\navisos · perguntas\npelo celular", 16, color="#da77f2")

# legend
text(40, 955, "verde: Claude nativo  ·  azul-petróleo: Google (agy)  ·  laranja: grátis  ·  cinza tracejado: opcional (Codex, Kiro, Copilot…)", 15, color=DIM, align="left", w=1100)

doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": EL,
       "appState": {"viewBackgroundColor": BG, "gridSize": None}, "files": {}}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "architecture.excalidraw")
json.dump(doc, open(out, "w"), indent=1)
print(out, len(EL), "elements")
