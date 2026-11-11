"""Shared Excalidraw scene helpers (dark theme) for the agentic-dev-stack diagrams."""
import json
import os
import random

EL = []


def reset(seed=7):
    EL.clear()
    random.seed(seed)
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





def save(path):
    doc = {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": EL,
           "appState": {"viewBackgroundColor": BG, "gridSize": None}, "files": {}}
    json.dump(doc, open(path, "w"), indent=1)
    print(path, len(EL), "elements")
