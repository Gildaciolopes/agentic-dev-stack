#!/usr/bin/env python3
"""Daily digest collector (read-only). Scheduled by install.sh (launchd/systemd/cron).

Writes $HERMES_DAILY_DIR/YYYY-MM-DD.md with raw data for 7 sections. Hermes (no shell)
turns it into a short summary + plan of the day on Discord/Telegram.
Secrets are masked before anything is written, because the summary goes through a model.

Config: ~/.config/agentic-dev-stack/stack.env (KEY="value" lines, $HOME expanded).
Projects: every git repo under PROJECTS_DIR (depth <= 3), grouped by top-level folder.
Override with ~/.config/agentic-dev-stack/projects.txt, one `name=/abs/path` per line.
"""
import datetime as dt
import glob
import json
import os
import re
import sqlite3
import subprocess
import urllib.request
from collections import defaultdict

HOME = os.path.expanduser("~")
CFG_DIR = f"{HOME}/.config/agentic-dev-stack"
DATA_DIR = f"{HOME}/.local/share/agentic-dev-stack"
STATE = f"{DATA_DIR}/daily-digest/state.json"
DEFAULT_RADAR = ["anthropics/claude-code", "sst/opencode", "github/spec-kit", "rtk-ai/rtk",
                 "JuliusBrussee/caveman", "Kc1t/alethe-orchestrate-skill", "NousResearch/hermes-agent",
                 "chopratejas/headroom", "safishamsi/graphify", "openai/codex"]
SECRET = re.compile(r"(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|"
                    r"xox[abp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|"
                    r"-----BEGIN [A-Z ]*PRIVATE KEY-----|(?i:(password|senha|secret|token|api[_-]?key)\s*[=:]\s*\S+))")
SKIP_DIRS = {"node_modules", ".git", ".alethe", "worktrees", ".venv", "dist", "build", ".next", ".turbo"}
NOW = dt.datetime.now().astimezone()
SINCE = NOW - dt.timedelta(hours=24)
WEEK = NOW - dt.timedelta(days=7)


def load_cfg():
    cfg = {}
    path = f"{CFG_DIR}/stack.env"
    if os.path.exists(path):
        for line in open(path):
            m = re.match(r'^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?', line)
            if m:
                cfg[m.group(1)] = m.group(2).strip().replace("$HOME", HOME)
    return cfg


CFG = load_cfg()
PROJECTS_DIR = CFG.get("PROJECTS_DIR") or f"{HOME}/projects"
OUT_DIR = os.environ.get("HERMES_DAILY_DIR", f"{HOME}/.hermes/workspace/daily")
CURATOR_DIR = f"{DATA_DIR}/model-curator"
RADAR_REPOS = [r for r in CFG.get("RADAR_REPOS", "").split() if r] or DEFAULT_RADAR


def mask(s):
    return SECRET.sub("[REDACTED]", s)


def sh(cmd, cwd=None, timeout=60):
    try:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception as e:  # noqa: BLE001
        return f"(erro: {e})"


def get_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "agentic-dev-stack-digest", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def author_email():
    return CFG.get("GIT_AUTHOR_EMAIL") or sh(["git", "config", "--global", "user.email"]).strip()


def discover_projects():
    """{name: {"root": path, "repos": [git roots]}}"""
    override = f"{CFG_DIR}/projects.txt"
    projects = {}
    if os.path.exists(override):
        for line in open(override):
            if "=" in line and not line.strip().startswith("#"):
                name, path = line.strip().split("=", 1)
                path = os.path.expanduser(path)
                projects[name] = {"root": path, "repos": find_repos(path, 2) or [path]}
        return projects
    if not os.path.isdir(PROJECTS_DIR):
        return projects
    for repo in find_repos(PROJECTS_DIR, 3):
        top = os.path.relpath(repo, PROJECTS_DIR).split(os.sep)[0]
        p = projects.setdefault(top, {"root": os.path.join(PROJECTS_DIR, top), "repos": []})
        p["repos"].append(repo)
    return projects


def find_repos(base, depth):
    found = []
    def walk(d, lvl):
        if os.path.isdir(os.path.join(d, ".git")):
            found.append(d)
        if lvl >= depth:
            return
        try:
            for e in os.scandir(d):
                if e.is_dir() and not e.is_symlink() and e.name not in SKIP_DIRS and not e.name.startswith("."):
                    walk(e.path, lvl + 1)
        except OSError:
            pass
    walk(base, 0)
    return found


def load_state():
    try:
        return json.load(open(STATE))
    except Exception:  # noqa: BLE001
        return {}


# 1. free models -------------------------------------------------------------------------
def sec_models():
    out = ["## 1. Modelos grátis (curador 9Router)"]
    try:
        s = json.load(open(f"{CURATOR_DIR}/status.json"))
        out.append(f"- Última rodada: {s['ranAt']} | combo atual: {', '.join(s['after'])}")
        if s.get("alert"):
            out.append(f"- ALERTA: {s['alert']}")
    except Exception as e:  # noqa: BLE001
        out.append(f"- sem status do curador ({e})")
        return out
    changes = []
    hist = f"{CURATOR_DIR}/history.jsonl"
    for line in open(hist) if os.path.exists(hist) else []:
        h = json.loads(line)
        if dt.datetime.fromisoformat(h["ranAt"]) >= SINCE and (h["changed"] or h.get("alert")):
            changes.append(h)
    for h in changes:
        out.append(f"- {h['ranAt']}: " + (f"trocou {h['before']} -> {h['after']}" if h["changed"] else f"alerta: {h['alert']}"))
    if not changes:
        out.append("- Nenhuma troca nas últimas 24h.")
    return out


# 2. tokens & quota -----------------------------------------------------------------------
def sec_tokens():
    out = ["## 2. Tokens e cota"]
    y = (NOW - dt.timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        daily = json.loads(sh(["rtk", "gain", "--daily", "--format", "json"]))["daily"]
        row = next((r for r in daily if r.get("date") == y), None)
        out.append(f"- RTK ontem ({y}): " + (json.dumps({k: row[k] for k in row if k != 'date'}) if row else "sem uso"))
    except Exception as e:  # noqa: BLE001
        out.append(f"- RTK: indisponível ({e})")
    db = f"{HOME}/.9router/db/data.sqlite"
    if os.path.exists(db):
        try:
            c = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
            r = c.execute("SELECT data FROM usageDaily WHERE dateKey = ?", (y,)).fetchone()
            if r:
                d = json.loads(r[0])
                out.append(f"- 9Router ontem: {d.get('requests')} req, {d.get('promptTokens')} tokens in, "
                           f"{d.get('completionTokens')} out, custo {d.get('cost')} | por modelo: "
                           + ", ".join(f"{k.split('|')[0]}={v.get('requests')}" for k, v in d.get("byModel", {}).items()))
            else:
                out.append("- 9Router ontem: sem uso")
        except Exception as e:  # noqa: BLE001
            out.append(f"- 9Router: erro ({e})")
    alethe = f"{HOME}/.agents/skills/alethe/scripts/orchestrate.py"
    if os.path.exists(alethe):
        try:
            u = json.loads(sh(["python3", "-I", alethe, "usage", "--refresh-claude", "--refresh-agy"], cwd=HOME, timeout=180))
            for prov, p in u.get("providers", {}).items():
                if p.get("missing") or not p.get("windows"):
                    continue
                w = ", ".join(f"{k} {v.get('usedPercent')}%" for k, v in p["windows"].items())
                out.append(f"- cota {prov}: {w}" + (" [desatualizado]" if p.get("stale") else "") + (" [BAIXO]" if p.get("low") else ""))
        except Exception as e:  # noqa: BLE001
            out.append(f"- alethe usage: erro ({e})")
    return out


# 3. tool updates ---------------------------------------------------------------------------
def sec_updates():
    out = ["## 3. Updates disponíveis (nada foi atualizado)"]
    watch = {"opencode", "rtk", "yt-dlp", "tmux", "claude-squad", "uv", "ffmpeg", "claude-code", "antigravity-cli", "codex"}
    try:
        j = json.loads(sh(["brew", "outdated", "--json=v2"], timeout=180))
        items = [f"{f['name']} {f.get('installed_versions', ['?'])[0]} -> {f['current_version']}"
                 for f in j.get("formulae", []) + j.get("casks", []) if f["name"] in watch]
        out += [f"- brew: {i}" for i in items] or ["- brew: tudo em dia"]
    except Exception:  # noqa: BLE001
        out.append("- brew: indisponível")
    try:
        cur = json.loads(sh(["npm", "ls", "-g", "9router", "--json"]))["dependencies"]["9router"]["version"]
        latest = sh(["npm", "view", "9router", "version"]).strip()
        out.append(f"- 9router: {cur}" + (f" -> {latest}" if latest and latest != cur else " (em dia)"))
    except Exception:  # noqa: BLE001
        pass
    hr = f"{HOME}/.local/bin/headroom"
    if os.path.exists(hr):
        try:
            hv = get_json("https://pypi.org/pypi/headroom-ai/json")["info"]["version"]
            cur = sh([hr, "--version"]).strip().split()[-1]
            out.append(f"- headroom: {cur}" + (f" -> {hv}" if hv not in cur else " (em dia)"))
        except Exception:  # noqa: BLE001
            pass
    audited = f"{HOME}/.agents/skills/alethe/.audited-commit"
    if os.path.exists(audited):
        try:
            sha = get_json("https://api.github.com/repos/Kc1t/alethe-orchestrate-skill/commits/HEAD")["sha"][:7]
            mine = open(audited).read().split()[0]
            out.append(f"- alethe: auditado {mine}" + (f", novo commit {sha} (auditar antes de atualizar)" if sha != mine else " (em dia)"))
        except Exception:  # noqa: BLE001
            pass
    hermes = f"{HOME}/.local/bin/hermes"
    if os.path.exists(hermes):
        hu = sh([hermes, "update", "--check"], timeout=60).strip().splitlines()
        if hu:
            out.append(f"- hermes: {hu[-1][:160]}")
    return out


# 4. spec kit -----------------------------------------------------------------------------------
def sec_spec(projects):
    out = ["## 4. Spec Kit: features em andamento"]
    for name, p in sorted(projects.items()):
        feats = []
        for tasks in glob.glob(f"{p['root']}/**/specs/*/tasks.md", recursive=True):
            if any(f"/{d}/" in tasks for d in SKIP_DIRS):
                continue
            txt = open(tasks, encoding="utf-8", errors="ignore").read()
            todo = len(re.findall(r"^\s*- \[ \]", txt, re.M))
            done = len(re.findall(r"^\s*- \[[xX]\]", txt, re.M))
            if todo:
                feats.append((os.path.getmtime(tasks), os.path.relpath(os.path.dirname(tasks), p["root"]), done, todo))
        feats.sort(reverse=True)
        if feats:
            out.append(f"- {name}: " + "; ".join(f"{f[1]} ({f[2]} feitas, {f[3]} faltam)" for f in feats[:3]))
    if len(out) == 1:
        out.append("- nenhuma feature com tasks pendentes")
    return out


# 5. AI radar ------------------------------------------------------------------------------------
def sec_radar(state):
    out = ["## 5. Radar de IA"]
    try:
        ids = sorted(m["id"] for m in get_json("https://integrate.api.nvidia.com/v1/models")["data"])
        prev = set(state.get("nvidiaModels", []))
        new = [i for i in ids if prev and i not in prev]
        gone = [i for i in prev if i not in ids]
        out.append(f"- NVIDIA: {len(ids)} modelos | novos: {', '.join(new) or 'nenhum'} | removidos: {', '.join(gone) or 'nenhum'}")
        state["nvidiaModels"] = ids
    except Exception as e:  # noqa: BLE001
        out.append(f"- NVIDIA: erro ({e})")
    seen = state.setdefault("releases", {})
    for repo in RADAR_REPOS:
        try:
            rel = [r for r in get_json(f"https://api.github.com/repos/{repo}/releases?per_page=5")
                   if not r.get("prerelease") and not r.get("draft")]
            fresh = [r for r in rel if r.get("published_at") and r["tag_name"] != seen.get(repo)
                     and dt.datetime.fromisoformat(r["published_at"].replace("Z", "+00:00")) >= SINCE]
            if rel:
                seen[repo] = rel[0]["tag_name"]
            for r in fresh[:2]:
                out.append(f"- {repo} {r['tag_name']}: " + mask(re.sub(r"\s+", " ", r.get("body") or ""))[:400])
        except Exception:  # noqa: BLE001
            continue
    return out


# 6 + 7. dev diary and hours -------------------------------------------------------------------------
def project_of(cwd, projects):
    best, blen = None, -1
    for name, p in projects.items():
        if cwd and cwd.startswith(p["root"]) and len(p["root"]) > blen:
            best, blen = name, len(p["root"])
    return best or ("outros" if cwd else "?")


def sessions(projects):
    res = []
    for f in glob.glob(f"{HOME}/.claude/projects/*/*.jsonl"):
        if os.path.getmtime(f) < WEEK.timestamp():
            continue
        ts, prompts, cwd, title = [], [], None, None
        for line in open(f, encoding="utf-8", errors="ignore"):
            try:
                d = json.loads(line)
            except Exception:  # noqa: BLE001
                continue
            if d.get("type") == "ai-title":
                title = d.get("aiTitle")
            t = d.get("timestamp")
            if d.get("type") in ("user", "assistant") and t:
                ts.append(dt.datetime.fromisoformat(t.replace("Z", "+00:00")))
                cwd = cwd or d.get("cwd")
            if d.get("type") == "user" and isinstance(d.get("message", {}).get("content"), str):
                c = d["message"]["content"]
                if not c.startswith("<") and len(prompts) < 40:
                    prompts.append((ts[-1] if ts else None, mask(c.strip().replace("\n", " "))[:160]))
        if ts:
            res.append({"project": project_of(cwd, projects), "ts": sorted(ts), "prompts": prompts, "title": title})
    return res


def active_minutes(ts, start, end, gap=20):
    pts = [t for t in ts if start <= t <= end]
    total = sum(min((b - a).total_seconds() / 60, gap + 1) for a, b in zip(pts, pts[1:]) if (b - a).total_seconds() / 60 <= gap)
    return total + (5 if pts else 0)


def sec_diary_hours(ss, projects):
    diary = ["## 6. Diário de dev (últimas 24h), base para o plano do dia"]
    for s in sorted(ss, key=lambda s: s["ts"][-1]):
        recent = [t for t in s["ts"] if t >= SINCE]
        if not recent:
            continue
        ps = [p for t, p in s["prompts"] if t and t >= SINCE]
        diary.append(f"- [{s['project']}] {s['title'] or 'sessão'} ({recent[0].astimezone():%H:%M}-{recent[-1].astimezone():%H:%M}): "
                     + " | ".join(ps[:8]))
    email = author_email()
    for name, p in sorted(projects.items()):
        for repo in p["repos"]:
            args = ["git", "-C", repo, "log", f"--since={SINCE.isoformat()}", "--all", "--no-merges", "--pretty=format:%h %s"]
            if email:
                args += [f"--author={email}", "-i"]
            log = sh(args).strip()
            if log and not log.startswith("(erro"):
                label = name if repo == p["root"] else f"{name}/{os.path.relpath(repo, p['root'])}"
                diary.append(f"- commits {label}: " + mask(log.replace("\n", " | "))[:500])
    if len(diary) == 1:
        diary.append("- sem atividade registrada")
    hours = ["## 7. Horas por projeto (estimativa: sessões do Claude Code, pausa > 20 min separa blocos)"]
    day, week = defaultdict(float), defaultdict(float)
    for s in ss:
        day[s["project"]] += active_minutes(s["ts"], SINCE, NOW)
        week[s["project"]] += active_minutes(s["ts"], WEEK, NOW)
    fmt = lambda m: f"{int(m // 60)}h{int(m % 60):02d}"  # noqa: E731
    for label, bucket in (("Últimas 24h", day), ("Últimos 7 dias", week)):
        items = [f"{k} {fmt(v)}" for k, v in sorted(bucket.items(), key=lambda x: -x[1]) if v >= 5]
        hours.append(f"- {label}: " + (", ".join(items) or "nada"))
    return diary, hours


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    state = load_state()
    projects = discover_projects()
    ss = sessions(projects)
    diary, hours = sec_diary_hours(ss, projects)
    parts = [f"# Coleta diária {NOW:%Y-%m-%d %H:%M}", ""]
    for sec in (sec_models(), sec_tokens(), sec_updates(), sec_spec(projects), sec_radar(state), diary, hours):
        parts += sec + [""]
    path = f"{OUT_DIR}/{NOW:%Y-%m-%d}.md"
    open(path, "w", encoding="utf-8").write(mask("\n".join(parts)))
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(state, open(STATE, "w"))
    for old in sorted(glob.glob(f"{OUT_DIR}/*.md"))[:-30]:
        os.remove(old)
    print(path)


if __name__ == "__main__":
    main()
