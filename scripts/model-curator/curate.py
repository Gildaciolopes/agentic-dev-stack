#!/usr/bin/env python3
"""Free-model curator for 9router's `free` combo.

Runs 3x/day (launchd). Probes NVIDIA NIM chat models through the local 9router,
keeps the best healthy ones (must answer AND do tool calls), rewrites the combo
with a DB backup first. Never empties the combo: if nothing passes, keeps current.
Writes status.json + history.jsonl for the daily Hermes summary.
"""
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import sys
import time
import urllib.request

HOME = os.path.expanduser("~")
DB = f"{HOME}/.9router/db/data.sqlite"
OPENCODE_CFG = f"{HOME}/.config/opencode/opencode.json"
STATE_DIR = os.environ.get("CURATOR_STATE_DIR", f"{HOME}/.local/share/agentic-dev-stack/model-curator")
ROUTER = "http://127.0.0.1:20128/v1"
NVIDIA_MODELS = "https://integrate.api.nvidia.com/v1/models"
COMBO = os.environ.get("CURATOR_COMBO", "free")
KEEP = 4               # models in the combo
MAX_PROBES = 14        # stay well under NVIDIA's 40 req/min (2 calls per model)
TIMEOUT = 45           # seconds per call; slower than this is useless for coding
MAX_LATENCY = 30.0     # healthy only if the slower of the two probes is under this

# Quality ranking by family (lower = better), shared with lib/ninerouter.mjs. Unknown families are still probed if they match.
try:
    _MODELS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "models.json")))
except (OSError, ValueError):
    # no ranking file: no new candidates, but the current combo is still re-probed and kept healthy
    print("models.json missing or invalid next to curate.py; only re-checking the current combo", file=sys.stderr)
    _MODELS = {"families": [], "exclude": "$^"}
FAMILIES = [(pat, score) for pat, score in _MODELS["families"]]
EXCLUDE = re.compile(_MODELS["exclude"], re.I)


def now():
    return dt.datetime.now(dt.UTC)


def router_key():
    """9Router API key: $NINEROUTER_API_KEY, else the key 9Router wrote into OpenCode's config."""
    if os.environ.get("NINEROUTER_API_KEY"):
        return os.environ["NINEROUTER_API_KEY"]
    return json.load(open(OPENCODE_CFG))["provider"]["9router"]["options"]["apiKey"]


def http_json(url, payload=None, key=None, timeout=TIMEOUT):
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload else None)
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def rank(model_id):
    for pat, score in FAMILIES:
        if re.search(pat, model_id, re.I):
            return score
    return None


def candidates(current):
    ids = [m["id"] for m in http_json(NVIDIA_MODELS, timeout=30)["data"]]
    pool = []
    for i in ids:
        if EXCLUDE.search(i):
            continue
        r = rank(i)
        if r is not None:
            pool.append((r, i))
    pool.sort()
    chosen = [i for _, i in pool[:MAX_PROBES]]
    # always re-probe what is in the combo now, so dead ones get dropped
    for c in current:
        if c.startswith("nvidia/") and c[len("nvidia/"):] in ids and c[len("nvidia/"):] not in chosen:
            chosen.append(c[len("nvidia/"):])
    return chosen, set(ids)


def probe(model_id, key):
    full = f"nvidia/{model_id}"
    res = {"model": full, "ok": False, "tools": False, "latency": None, "error": None}
    try:
        t = time.time()
        d = http_json(f"{ROUTER}/chat/completions", {
            "model": full, "stream": False, "max_tokens": 300,
            "messages": [{"role": "user", "content": "Reply with exactly: OK"}]}, key)
        lat1 = time.time() - t
        msg = d["choices"][0]["message"]
        if not ((msg.get("content") or "") + (msg.get("reasoning_content") or "")).strip():
            raise ValueError("empty answer")
        t = time.time()
        d = http_json(f"{ROUTER}/chat/completions", {
            "model": full, "stream": False, "max_tokens": 300,
            "tools": [{"type": "function", "function": {
                "name": "get_time", "description": "Returns the current time",
                "parameters": {"type": "object", "properties": {}, "required": []}}}],
            "messages": [{"role": "user", "content": "Call the get_time tool now."}]}, key)
        lat2 = time.time() - t
        calls = d["choices"][0]["message"].get("tool_calls") or []
        res.update(ok=True, tools=bool(calls), latency=round(max(lat1, lat2), 1))
        if not calls:
            res["error"] = "no tool call"
    except Exception as e:  # noqa: BLE001 - every failure just marks the model unhealthy
        res["error"] = str(e)[:160]
    return res


def read_combo(conn):
    row = conn.execute("SELECT models FROM combos WHERE name = ?", (COMBO,)).fetchone()
    return json.loads(row[0]) if row else None


def write_combo(models):
    os.makedirs(f"{STATE_DIR}/backups", exist_ok=True)
    stamp = now().strftime("%Y%m%d-%H%M%S")
    src = sqlite3.connect(DB, timeout=15)
    dst = sqlite3.connect(f"{STATE_DIR}/backups/data-{stamp}.sqlite")
    src.backup(dst)
    dst.close()
    ts = now().isoformat(timespec="milliseconds").replace("+00:00", "Z")
    src.execute("UPDATE combos SET models = ?, updatedAt = ? WHERE name = ?", (json.dumps(models), ts, COMBO))
    src.commit()
    src.close()
    # keep the 20 newest backups
    bks = sorted(os.listdir(f"{STATE_DIR}/backups"))
    for old in bks[:-20]:
        os.remove(f"{STATE_DIR}/backups/{old}")


def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    started = now()
    key = router_key()
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    current = read_combo(conn) or []
    conn.close()

    probes, alert = [], None
    try:
        ids, _ = candidates(current)
        for mid in ids:
            probes.append(probe(mid, key))
            time.sleep(1.5)
    except Exception as e:  # noqa: BLE001
        alert = f"could not list/probe models: {str(e)[:160]}"

    healthy = [p for p in probes if p["ok"] and p["tools"] and p["latency"] is not None and p["latency"] <= MAX_LATENCY]
    healthy.sort(key=lambda p: (rank(p["model"]) or 99, p["latency"]))
    new = [p["model"] for p in healthy[:KEEP]]

    changed = False
    if not new:
        alert = alert or "no healthy model passed; combo left unchanged"
        new = current
    elif new != current:
        write_combo(new)
        changed = True

    status = {
        "ranAt": started.isoformat(timespec="seconds"),
        "durationSec": round((now() - started).total_seconds()),
        "changed": changed, "before": current, "after": new,
        "removed": [m for m in current if m not in new], "added": [m for m in new if m not in current],
        "alert": alert, "probes": probes,
    }
    json.dump(status, open(f"{STATE_DIR}/status.json", "w"), indent=2)
    with open(f"{STATE_DIR}/history.jsonl", "a") as f:
        f.write(json.dumps({k: status[k] for k in ("ranAt", "changed", "before", "after", "alert")}) + "\n")
    print(json.dumps({k: status[k] for k in ("changed", "before", "after", "alert")}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
