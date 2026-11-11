#!/usr/bin/env python3
"""Wire one project into the stack (idempotent, append-only).

  ./scripts/add-project.py ~/projects/my-app [--dry-run] [--no-docs]

What it does:
  1. symlinks .claude/skills/alethe -> ~/.agents/skills/alethe (one audited copy for all projects)
  2. adds the alethe passive hook to .claude/settings.local.json (merged, never overwritten)
  3. adds .claude/skills/alethe, .claude/settings.local.json, .alethe/ to .git/info/exclude (local only,
     never committed). Workspaces without git at the root get it in every sub-repo.
  4. appends the orchestration block to CLAUDE.md and AGENTS.md between markers. Existing content is
     never modified; re-running skips files that already have the block.
     Gates (checks) and parallel units are auto-detected from Makefile / package.json / pyproject.
Review the generated block afterwards: detection is a starting point, your project knows better.
"""
import argparse
import json
import os
import re
import subprocess
import sys

HOME = os.path.expanduser("~")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = f"{HOME}/.agents/skills/alethe"
HOOK = f'python3 -S "{CANON}/scripts/hook.py" 2>/dev/null || true'
EXCLUDES = [".claude/skills/alethe", ".claude/settings.local.json", ".alethe/"]
B, E = "<!-- BEGIN ALETHE ORCHESTRATION -->", "<!-- END ALETHE ORCHESTRATION -->"
SKIP = {"node_modules", ".git", ".venv", "dist", "build", ".next", ".turbo", ".alethe"}


def git_root(d):
    try:
        return subprocess.check_output(["git", "-C", d, "rev-parse", "--show-toplevel"], text=True,
                                       stderr=subprocess.DEVNULL).strip()
    except subprocess.CalledProcessError:
        return None


def sub_repos(d, depth=2):
    found = []
    def walk(p, lvl):
        if lvl and os.path.isdir(os.path.join(p, ".git")):
            found.append(p)
            return
        if lvl >= depth:
            return
        for e in os.scandir(p):
            if e.is_dir() and not e.is_symlink() and e.name not in SKIP and not e.name.startswith("."):
                walk(e.path, lvl + 1)
    walk(d, 0)
    return found


def make_targets(d):
    mk = os.path.join(d, "Makefile")
    if not os.path.exists(mk):
        return []
    return re.findall(r"^([a-zA-Z][\w-]*):", open(mk, errors="ignore").read(), re.M)


def pkg_scripts(d):
    pj = os.path.join(d, "package.json")
    try:
        return list(json.load(open(pj)).get("scripts", {}))
    except Exception:  # noqa: BLE001
        return []


def pkg_runner(d):
    for lock, run in (("pnpm-lock.yaml", "pnpm"), ("bun.lock", "bun run"), ("bun.lockb", "bun run"), ("yarn.lock", "yarn")):
        if os.path.exists(os.path.join(d, lock)):
            return run
    return "npm run"


def detect_gates(root, dirs):
    gates = []
    wanted = ("typecheck", "type-check", "lint", "test", "check", "verify", "test-e2e", "e2e")
    for d in dirs:
        label = "" if d == root else f"`{os.path.relpath(d, root)}/`: "
        mk = [t for t in make_targets(d) if t in wanted or t.startswith("test")]
        if mk:
            gates.append(label + " · ".join(f"`make {t}`" for t in mk[:5]))
            continue
        sc = [s for s in pkg_scripts(d) if s in wanted or s.startswith(("test", "lint", "typecheck"))]
        if sc:
            run = pkg_runner(d)
            gates.append(label + " · ".join(f"`{run} {s}`" for s in sc[:5]))
            continue
        if os.path.exists(os.path.join(d, "pyproject.toml")) or os.path.exists(os.path.join(d, "requirements.txt")):
            gates.append(label + "`pytest` · `ruff check .` (ajuste se o projeto usar outro runner)")
    return gates or ["Nenhum check detectado automaticamente. Defina aqui os comandos de teste/lint/typecheck que aceitam o trabalho de um worker."]


def detect_units(root, dirs):
    units = []
    mono = [g for g in ("apps", "packages", "services", "libs") if os.path.isdir(os.path.join(root, g))]
    if mono:
        units.append(", ".join(f"`{g}/*`" for g in mono) + ": 1 builder por pacote, com paths disjuntos.")
    sides = [n for n in sorted(os.listdir(root)) if os.path.isdir(os.path.join(root, n))
             and re.search(r"(front|back|web|api|mobile|admin|server|client)", n, re.I) and n not in SKIP]
    if sides and not mono:
        units.append(", ".join(f"`{s}/`" for s in sides) + ": feature full-stack = 1 builder por lado, com contrato (API/tipos) definido pelo lead antes.")
    repos = [d for d in dirs if d != root]
    if repos:
        units.append("Repos separados (" + ", ".join(f"`{os.path.relpath(r, root)}`" for r in repos)
                     + "): 1 builder por repo, cada um em worktree do próprio repo.")
    return units or ["Projeto único: unidades = módulos/pastas de feature com ownership de arquivos disjunta."]


WORKFLOW_SDD = """### Integração com o fluxo que já existe (Spec Kit + graphify + RTK)
- O Spec Kit continua sendo o fluxo. O alethe entra no meio sem recomeçar: `tasks.md` vira as unidades e os checks do projeto viram os gates.
- `specify`, `clarify`, `plan` e `analyze` ficam com o lead (Opus). São decisões e não se delegam.
- `implement`:
  - tasks `[P]` independentes → playbook `parallel-worktrees` (1 builder por task, worktree isolada, paths disjuntos);
  - tasks sequenciais → `plan-execute`;
  - diff final → `review-gate` antes de declarar pronto.
"""
WORKFLOW_PLAIN = """### Integração com o fluxo que já existe (graphify + RTK)
- Tarefa grande → o lead escreve um plano curto com unidades e gates; unidades independentes → `parallel-worktrees`; diff final → `review-gate`.
"""


def append_block(path, block, header, dry):
    cur = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    if B in cur:
        return "já tinha o bloco (pulado)"
    if dry:
        return "seria " + ("anexado" if cur else "criado")
    with open(path, "a", encoding="utf-8") as f:
        if not cur:
            f.write(header)
        elif not cur.endswith("\n"):
            f.write("\n")
        f.write("\n" + block)
    assert open(path, encoding="utf-8").read().startswith(cur), "conteúdo original alterado!"
    return "anexado" if cur else "criado"


def git_exclude(repo_dir, prefix, dry):
    gp = subprocess.check_output(["git", "-C", repo_dir, "rev-parse", "--git-path", "info/exclude"], text=True).strip()
    gp = gp if os.path.isabs(gp) else os.path.join(repo_dir, gp)
    cur = open(gp).read() if os.path.exists(gp) else ""
    add = [f"/{prefix}{e}" for e in EXCLUDES if f"/{prefix}{e}" not in cur]
    if add and not dry:
        os.makedirs(os.path.dirname(gp), exist_ok=True)
        with open(gp, "a") as f:
            f.write("\n# agentic-dev-stack (local only)\n" + "\n".join(add) + "\n")
    return add


def wire_dir(d, dry):
    sk = os.path.join(d, ".claude", "skills")
    link = os.path.join(sk, "alethe")
    if not dry:
        os.makedirs(sk, exist_ok=True)
        if os.path.islink(link):
            os.remove(link)
        if not os.path.exists(link):
            os.symlink(CANON, link)
    sp = os.path.join(d, ".claude", "settings.local.json")
    cfg = json.load(open(sp)) if os.path.exists(sp) else {}
    hooks = cfg.setdefault("hooks", {})
    for ev, to in (("UserPromptSubmit", 10), ("PostToolUse", 5)):
        lst = hooks.setdefault(ev, [])
        if not any(h.get("command") == HOOK for e in lst for h in e.get("hooks", [])):
            lst.append({"hooks": [{"type": "command", "command": HOOK, "timeout": to}]})
    if not dry:
        json.dump(cfg, open(sp, "w"), indent=2)
        open(sp, "a").write("\n")
    top = git_root(d)
    if top:
        rel = os.path.relpath(d, top)
        git_exclude(d, "" if rel == "." else rel + "/", dry)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-docs", action="store_true", help="skip CLAUDE.md/AGENTS.md blocks")
    a = ap.parse_args()
    root = os.path.abspath(os.path.expanduser(a.project))
    if not os.path.isdir(root):
        sys.exit(f"não existe: {root}")
    if not os.path.isdir(CANON):
        sys.exit(f"alethe não instalado em {CANON}. Rode ./install.sh --workers primeiro.")

    repos = [] if git_root(root) else sub_repos(root)
    for d in [root] + repos:
        wire_dir(d, a.dry_run)
    print(f"alethe ligado em: {', '.join(os.path.relpath(d, root) or '.' for d in [root] + repos)}")

    if a.no_docs:
        return
    dirs = [root] + repos
    tpl = open(os.path.join(REPO, "templates", "project-claude-block.md"), encoding="utf-8").read()
    sdd = os.path.isdir(os.path.join(root, ".specify")) or os.path.isdir(os.path.join(root, "specs"))
    block = (tpl.replace("{{WORKFLOW_SECTION}}", WORKFLOW_SDD if sdd else WORKFLOW_PLAIN)
                .replace("{{GATES}}", "\n".join(f"- {g}" for g in detect_gates(root, dirs)))
                .replace("{{UNITS}}", "\n".join(f"- {u}" for u in detect_units(root, dirs))))
    agents_tpl = open(os.path.join(REPO, "templates", "project-agents-block.md"), encoding="utf-8").read()
    name = os.path.basename(root)
    r1 = append_block(os.path.join(root, "CLAUDE.md"), block, f"# {name}: instruções do projeto\n", a.dry_run)
    r2 = append_block(os.path.join(root, "AGENTS.md"), agents_tpl, "# AGENTS.md\n\nRegras completas do projeto: `CLAUDE.md`.\n", a.dry_run)
    print(f"CLAUDE.md: {r1} | AGENTS.md: {r2}")
    for sub in repos:
        if os.path.exists(os.path.join(sub, "AGENTS.md")):
            print(f"{os.path.relpath(sub, root)}/AGENTS.md: {append_block(os.path.join(sub, 'AGENTS.md'), agents_tpl, '', a.dry_run)}")
    if a.dry_run:
        print("\n--- bloco que seria anexado ao CLAUDE.md ---\n" + block)
    else:
        print("Revise o bloco no fim do CLAUDE.md (gates e unidades foram detectados automaticamente).")


if __name__ == "__main__":
    main()
