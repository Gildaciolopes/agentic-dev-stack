#!/usr/bin/env bash
# agentic-dev-stack installer. Idempotent: safe to re-run. Backs up any config it edits.
#   ./install.sh --all
#   ./install.sh --core --workers --free-models --extras --hermes
#   ./install.sh --help
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
CFG_DIR="$HOME/.config/agentic-dev-stack"
DATA_DIR="$HOME/.local/share/agentic-dev-stack"
BIN_DIR="$HOME/.local/bin"
BACKUP_DIR="$DATA_DIR/backups/$(date +%Y%m%d-%H%M%S)"
OS="$(uname -s)"

c_blue=$'\033[34m'; c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_red=$'\033[31m'; c_off=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$c_blue" "$*" "$c_off"; }
ok()   { printf '%s  ✓ %s%s\n' "$c_green" "$*" "$c_off"; }
warn() { printf '%s  ! %s%s\n' "$c_yellow" "$*" "$c_off"; }
die()  { printf '%s  ✗ %s%s\n' "$c_red" "$*" "$c_off" >&2; exit 1; }
todo() { TODOS+=("$*"); }
TODOS=()

usage() {
  sed -n '2,6p' "$0"
  cat <<'EOF'

Phases:
  --core         RTK, agents scout/builder/reviewer, agent-model-guard hook, default subagent model, global CLAUDE.md block
  --workers      OpenCode, Antigravity CLI (agy), Codex (if WITH_CODEX=1), claude-squad+tmux, opencode-safe sandbox, alethe + profile
  --free-models  9Router (+ autostart) and the free-model curator (CURATOR_TIMES)
  --extras       Headroom (isolated, telemetry off), yt-dlp
  --hermes       Hermes Agent (hardened), daily digest collector and scheduled summaries
  --all          everything above
Config: config/stack.env (copy from config/stack.env.example)
EOF
}

# ---------- config ----------
[ -f "$REPO/config/stack.env" ] || cp "$REPO/config/stack.env.example" "$REPO/config/stack.env"
# shellcheck disable=SC1091
source "$REPO/config/stack.env"
mkdir -p "$CFG_DIR" "$DATA_DIR" "$BIN_DIR"
cp "$REPO/config/stack.env" "$CFG_DIR/stack.env"

PHASES=()
[ $# -eq 0 ] && { usage; exit 0; }
for a in "$@"; do
  case "$a" in
    --all) PHASES=(core workers free-models extras hermes) ;;
    --core|--workers|--free-models|--extras|--hermes) PHASES+=("${a#--}") ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $a" ;;
  esac
done

backup() { [ -e "$1" ] && { mkdir -p "$BACKUP_DIR"; cp -R "$1" "$BACKUP_DIR/" ; } || true; }
need() { command -v "$1" >/dev/null 2>&1; }
brew_install() { for f in "$@"; do brew list --formula "$f" >/dev/null 2>&1 && ok "$f (já instalado)" || { brew install "$f" >/dev/null && ok "$f"; }; done; }
cask_install() { for f in "$@"; do brew list --cask "$f" >/dev/null 2>&1 && ok "$f (já instalado)" || { brew install --cask "$f" >/dev/null && ok "$f"; }; done; }

# launchd (macOS) / crontab hint (Linux). $1=label $2=times("HH:MM ...") rest=program args
schedule() {
  local label="$1" times="$2"; shift 2
  if [ "$OS" = "Darwin" ]; then
    local plist="$HOME/Library/LaunchAgents/$label.plist" cal=""
    for t in $times; do cal+="<dict><key>Hour</key><integer>$((10#${t%%:*}))</integer><key>Minute</key><integer>$((10#${t##*:}))</integer></dict>"; done
    local args=""; for x in "$@"; do args+="<string>$x</string>"; done
    cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$label</string>
<key>ProgramArguments</key><array>$args</array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>$BIN_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>StartCalendarInterval</key><array>$cal</array>
<key>StandardOutPath</key><string>$DATA_DIR/logs/$label.log</string>
<key>StandardErrorPath</key><string>$DATA_DIR/logs/$label.err</string>
</dict></plist>
EOF
    mkdir -p "$DATA_DIR/logs"
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$plist" && ok "agendado $label ($times)"
  else
    warn "Linux: adicione ao crontab (crontab -e):"
    for t in $times; do echo "    ${t##*:} ${t%%:*} * * * $*"; done
  fi
}

merge_json() { # $1=file $2=python snippet operating on dict c
  python3 -I - "$1" "$2" <<'PY'
import json, os, sys
p, code = sys.argv[1], sys.argv[2]
c = json.load(open(p)) if os.path.exists(p) and os.path.getsize(p) else {}
exec(code, {"c": c, "os": os})
os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(c, open(p, "w"), indent=2); open(p, "a").write("\n")
PY
}

preflight() {
  step "Pré-requisitos"
  [ "$OS" = "Darwin" ] || warn "Linux detectado: sandbox-exec e launchd não existem; ver docs/07-seguranca.md e docs/02-instalacao.md"
  need brew || die "Homebrew não encontrado: https://brew.sh"
  need claude || die "Claude Code não encontrado: brew install --cask claude-code (ou npm i -g @anthropic-ai/claude-code)"
  need git || die "git não encontrado"
  need python3 || die "python3 não encontrado"
  need node || brew_install node
  ok "brew, claude, git, python3, node"
}

phase_core() {
  step "core: RTK"
  brew_install rtk
  rtk init -g --auto-patch >/dev/null 2>&1 && ok "rtk hook global no Claude Code" || warn "rode manualmente: rtk init -g"

  step "core: agentes scout/builder/reviewer"
  mkdir -p "$HOME/.claude/agents"
  for f in "$REPO"/agents/*.md; do
    dst="$HOME/.claude/agents/$(basename "$f")"
    if [ -f "$dst" ] && ! cmp -s "$f" "$dst"; then backup "$dst"; fi
    cp "$f" "$dst"; ok "$(basename "$f")"
  done

  step "core: agent-model-guard + modelo padrão de subagente"
  mkdir -p "$HOME/.claude/hooks"
  cp "$REPO/hooks/agent-model-guard.py" "$HOME/.claude/hooks/"
  chmod +x "$HOME/.claude/hooks/agent-model-guard.py"
  backup "$HOME/.claude/settings.json"
  merge_json "$HOME/.claude/settings.json" '
c.setdefault("env", {})["CLAUDE_CODE_SUBAGENT_MODEL"] = "sonnet"
pre = c.setdefault("hooks", {}).setdefault("PreToolUse", [])
cmd = "python3 -I " + os.path.expanduser("~/.claude/hooks/agent-model-guard.py")
if not any(h.get("command") == cmd for e in pre for h in e.get("hooks", [])):
    pre.append({"matcher": "Agent|Task", "hooks": [{"type": "command", "command": cmd, "timeout": 5}]})
'
  ok "hook PreToolUse(Agent|Task) + CLAUDE_CODE_SUBAGENT_MODEL=sonnet"

  step "core: bloco no ~/.claude/CLAUDE.md"
  touch "$HOME/.claude/CLAUDE.md"
  if grep -q "BEGIN AGENTIC-DEV-STACK" "$HOME/.claude/CLAUDE.md"; then ok "já presente"
  else backup "$HOME/.claude/CLAUDE.md"; printf '\n' >> "$HOME/.claude/CLAUDE.md"; cat "$REPO/templates/claude-global.md" >> "$HOME/.claude/CLAUDE.md"; ok "anexado (nada removido)"; fi

  todo "Caveman (dentro do claude): /plugin marketplace add JuliusBrussee/caveman  →  /plugin install caveman  →  /caveman ultra"
  todo "Spec Kit (opcional): uv tool install specify-cli --from git+https://github.com/github/spec-kit.git  →  specify init <projeto>"
  todo "graphify (opcional): ver https://github.com/safishamsi/graphify"
}

install_alethe() {
  step "workers: alethe (commit auditado $ALETHE_COMMIT)"
  local dst="$HOME/.agents/skills/alethe" tmp
  if [ -f "$dst/.audited-commit" ] && [ "$(cut -d' ' -f1 "$dst/.audited-commit")" = "$ALETHE_COMMIT" ]; then ok "já instalado"; else
    tmp="$(mktemp -d)"
    git clone -q "$ALETHE_REPO" "$tmp/src"
    git -C "$tmp/src" checkout -q "$ALETHE_COMMIT" || die "commit $ALETHE_COMMIT não encontrado em $ALETHE_REPO"
    [ -d "$dst" ] && { backup "$dst"; rm -rf "$dst"; }
    mkdir -p "$HOME/.agents/skills"
    cp -R "$tmp/src/skills/alethe" "$dst"
    echo "$ALETHE_COMMIT $(date +%F) audited" > "$dst/.audited-commit"
    rm -rf "$tmp"; ok "alethe em $dst"
  fi
  python3 -I "$REPO/scripts/configure-alethe.py" --projects-dir "$PROJECTS_DIR"
}

phase_workers() {
  step "workers: CLIs"
  brew_install tmux claude-squad
  [ "${WITH_OPENCODE:-1}" = 1 ] && brew_install opencode
  [ "${WITH_AGY:-1}" = 1 ] && cask_install antigravity-cli
  if [ "${WITH_CODEX:-0}" = 1 ]; then brew_install codex; todo "Codex: rode 'codex login' (conta ChatGPT) e depois ./scripts/configure-alethe.py --force"; fi

  if [ "${WITH_OPENCODE:-1}" = 1 ]; then
    step "workers: sandbox opencode-safe"
    sed "s|__HOME__|$HOME|g" "$REPO/sandbox/deny-secrets.sb.template" > "$CFG_DIR/deny-secrets.sb"
    cp "$REPO/bin/opencode-safe" "$BIN_DIR/opencode-safe"; chmod +x "$BIN_DIR/opencode-safe"
    [ "$OS" = "Darwin" ] && ok "$BIN_DIR/opencode-safe (sandbox-exec + --standalone)" || warn "sem sandbox-exec no Linux: ver docs/07-seguranca.md"
    backup "$HOME/.config/opencode/opencode.json"
    merge_json "$HOME/.config/opencode/opencode.json" "
import json
c['permission'] = json.load(open('$REPO/templates/opencode-permissions.json'))['permission']
"
    ok "permissões do OpenCode (2ª camada)"
    rtk init -g --opencode >/dev/null 2>&1 && ok "rtk no OpenCode" || true
  fi
  [ "${WITH_AGY:-1}" = 1 ] && { rtk init -g --agent antigravity >/dev/null 2>&1 && ok "rtk no agy" || true; todo "agy: rode 'agy' uma vez e faça login com a conta Google"; }
  [ "${WITH_CODEX:-0}" = 1 ] && { rtk init -g --codex >/dev/null 2>&1 && ok "rtk no Codex" || true; }
  install_alethe
  todo "Em cada projeto: $REPO/scripts/add-project.py <pasta-do-projeto>"
}

phase_free_models() {
  step "free-models: 9Router"
  if need 9router; then ok "9router (já instalado)"; else npm install -g 9router >/dev/null 2>&1 && ok "9router" || die "npm install -g 9router falhou"; fi
  local nr_cli node_bin
  nr_cli="$(npm root -g)/9router/cli.js"; node_bin="$(command -v node)"
  if [ "$OS" = "Darwin" ]; then
    local plist="$HOME/Library/LaunchAgents/com.agentic-dev-stack.9router.plist"
    cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.agentic-dev-stack.9router</string>
<key>ProgramArguments</key><array><string>$node_bin</string><string>$nr_cli</string><string>--tray</string><string>--skip-update</string></array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$node_bin"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
<key>StandardOutPath</key><string>$DATA_DIR/logs/9router.log</string>
<key>StandardErrorPath</key><string>$DATA_DIR/logs/9router.err</string>
</dict></plist>
EOF
    mkdir -p "$DATA_DIR/logs"
    if curl -s -o /dev/null -m 3 http://127.0.0.1:20128/v1/models; then warn "9Router já está rodando: o autostart vale a partir do próximo login"
    else launchctl bootout "gui/$(id -u)/com.agentic-dev-stack.9router" 2>/dev/null || true; launchctl bootstrap "gui/$(id -u)" "$plist" && ok "autostart do 9Router (node: $node_bin)"; fi
    [ -f "$HOME/Library/LaunchAgents/com.9router.autostart.plist" ] && warn "existe também o autostart do próprio 9Router (com.9router.autostart); desative um dos dois na WebUI"
  fi
  todo "9Router: abra http://127.0.0.1:20128 (senha inicial 123456, TROQUE), adicione o provider NVIDIA NIM (chave grátis em build.nvidia.com), crie o combo 'free' e em CLI Tools → OpenCode aplique o combo"

  step "free-models: curador (testa e reescreve o combo $CURATOR_TIMES)"
  mkdir -p "$DATA_DIR/model-curator"
  cp "$REPO/scripts/model-curator/curate.py" "$DATA_DIR/model-curator/curate.py"
  schedule com.agentic-dev-stack.model-curator "$CURATOR_TIMES" "$(command -v python3)" -I "$DATA_DIR/model-curator/curate.py"
  todo "Depois de criar o combo 'free': python3 -I $DATA_DIR/model-curator/curate.py  (primeira rodada manual)"
}

phase_extras() {
  step "extras"
  brew_install yt-dlp uv
  if [ "${WITH_HEADROOM:-0}" = 1 ]; then
    need headroom && ok "headroom (já instalado)" || { uv tool install --python 3.12 "headroom-ai[all]" >/dev/null && ok "headroom (Python 3.12 isolado)"; }
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
      [ -f "$rc" ] && ! grep -q HEADROOM_BEACON "$rc" && printf '\n# Headroom: no telemetry\nexport HEADROOM_TELEMETRY=off\nexport HEADROOM_BEACON=off\n' >> "$rc" && ok "telemetria do Headroom off em $(basename "$rc")"
    done
  else warn "Headroom pulado (WITH_HEADROOM=0). Ver docs/01-arquitetura.md antes de ligar."; fi
}

phase_hermes() {
  step "hermes: Hermes Agent"
  if [ -x "$BIN_DIR/hermes" ]; then ok "hermes (já instalado)"; else
    local tmp; tmp="$(mktemp -d)"
    curl -fsSL https://hermes-agent.nousresearch.com/install.sh -o "$tmp/install.sh"
    warn "instalador do Hermes baixado em $tmp/install.sh (sha256: $(shasum -a 256 "$tmp/install.sh" | cut -c1-16)…). Leia antes se quiser; Enter para continuar, Ctrl+C para abortar."
    read -r _
    bash "$tmp/install.sh" --channel stable --skip-browser --skip-computer-use --non-interactive
  fi
  local H="$BIN_DIR/hermes"
  step "hermes: endurecimento"
  $H config set telemetry.shared_metrics.enabled false >/dev/null
  $H config set telemetry.shared_metrics.send false >/dev/null
  $H config set updates.check false >/dev/null
  $H config set approvals.mode manual >/dev/null
  $H config set approvals.cron_mode deny >/dev/null
  $H config set discord.auto_thread false >/dev/null || true
  for p in discord telegram cron; do
    $H tools disable --platform "$p" web browser terminal code_execution vision image_gen tts delegation discord_admin computer_use connections >/dev/null 2>&1 || true
  done
  ok "telemetria off, updates off, aprovação manual, sem shell/web/browser nas plataformas de chat e no cron"

  if curl -s -o /dev/null -m 3 http://127.0.0.1:20128/v1/models && [ -f "$HOME/.config/opencode/opencode.json" ]; then
    local k; k="$(python3 -I -c "import json;print(json.load(open('$HOME/.config/opencode/opencode.json'))['provider']['9router']['options']['apiKey'])" 2>/dev/null || true)"
    if [ -n "$k" ]; then
      $H config set model.provider custom >/dev/null; $H config set model.base_url http://127.0.0.1:20128/v1 >/dev/null
      $H config set model.default free >/dev/null; $H config set model.api_key "$k" >/dev/null
      ok "modelo do Hermes = combo 'free' do 9Router (custo zero)"
    fi
  else todo "Modelo do Hermes: rode 'hermes model' (Custom endpoint http://127.0.0.1:20128/v1, modelo free) depois de configurar o 9Router"; fi

  local envf="$HOME/.hermes/.env"; touch "$envf"; chmod 600 "$envf"
  set_env() { python3 -I - "$envf" "$1" "$2" <<'PY'
import re, sys
p, k, v = sys.argv[1:]
s = open(p).read()
s = re.sub(rf"^{k}=.*$", f"{k}={v}", s, flags=re.M) if re.search(rf"^{k}=", s, re.M) else s + ("" if s.endswith("\n") or not s else "\n") + f"{k}={v}\n"
open(p, "w").write(s)
PY
  }
  case "${HERMES_PLATFORM:-discord}" in
    discord)
      read -r -p "  Seu ID de usuário do Discord (Configurações → Avançado → Modo desenvolvedor → Copiar ID): " uid
      [ -n "$uid" ] && set_env DISCORD_ALLOWED_USERS "$uid" && set_env DISCORD_REQUIRE_MENTION false
      grep -q '^DISCORD_BOT_TOKEN=.' "$envf" || { read -r -s -p "  Token do bot (não aparece na tela): " tok; echo; [ -n "$tok" ] && set_env DISCORD_BOT_TOKEN "$tok"; unset tok; }
      todo "Discord: no canal desejado, mande /sethome (fora de thread). Ver docs/06-hermes.md" ;;
    telegram)
      read -r -p "  Seu ID numérico do Telegram (fale com @userinfobot): " uid
      [ -n "$uid" ] && set_env TELEGRAM_ALLOWED_USERS "$uid"
      grep -q '^TELEGRAM_BOT_TOKEN=.' "$envf" || { read -r -s -p "  Token do bot (@BotFather, não aparece na tela): " tok; echo; [ -n "$tok" ] && set_env TELEGRAM_BOT_TOKEN "$tok"; unset tok; }
      todo "Telegram: mande /sethome no chat com o bot. Ver docs/06-hermes.md" ;;
    none) warn "sem plataforma de chat: rotinas entregam em 'local'" ;;
  esac

  step "hermes: coletor diário + rotinas"
  mkdir -p "$DATA_DIR/daily-digest" "$HOME/.hermes/workspace/daily"
  cp "$REPO/scripts/daily-digest/collect.py" "$DATA_DIR/daily-digest/collect.py"
  schedule com.agentic-dev-stack.daily-digest "$DIGEST_COLLECT_TIME" "$(command -v python3)" -I "$DATA_DIR/daily-digest/collect.py"
  local deliver="${HERMES_PLATFORM:-discord}"; [ "$deliver" = none ] && deliver=local
  local hh="${DIGEST_SEND_TIME%%:*}" mm="${DIGEST_SEND_TIME##*:}"
  if ! $H cron list 2>/dev/null | grep -q "resumo-diario"; then
    $H cron create "$((10#$mm)) $((10#$hh)) * * *" "$(sed "s|__HOME__|$HOME|g" "$REPO/templates/hermes-prompt-resumo.txt")" --name resumo-diario --deliver "$deliver" --timezone "$TIMEZONE" --catch-up on >/dev/null && ok "rotina resumo-diario ($DIGEST_SEND_TIME)"
  else ok "rotina resumo-diario já existe"; fi
  local cron_curator=""; for t in $CURATOR_TIMES; do cron_curator+="${cron_curator:+,}$((10#${t%%:*}))"; done
  local cm; cm=$(( (10#$(echo "$CURATOR_TIMES" | awk '{print $1}' | cut -d: -f2) + 5) % 60 ))
  if ! $H cron list 2>/dev/null | grep -q "aviso-combo"; then
    $H cron create "$cm $cron_curator * * *" "$(sed "s|__HOME__|$HOME|g" "$REPO/templates/hermes-prompt-combo.txt")" --name aviso-combo --deliver "$deliver" --timezone "$TIMEZONE" --catch-up off >/dev/null && ok "rotina aviso-combo (silenciosa se nada mudou)"
  else ok "rotina aviso-combo já existe"; fi
  $H gateway install >/dev/null 2>&1 || true
  $H gateway restart >/dev/null 2>&1 || $H gateway start >/dev/null 2>&1 || true
  ok "gateway como serviço (launchd/systemd)"
}

preflight
for p in "${PHASES[@]}"; do "phase_${p//-/_}"; done

step "Pronto"
[ -d "$BACKUP_DIR" ] && ok "backups das configs alteradas: $BACKUP_DIR"
if [ ${#TODOS[@]} -gt 0 ]; then
  printf '\n%sPassos manuais (logins/chaves que só você pode fazer):%s\n' "$c_yellow" "$c_off"
  i=1; for t in "${TODOS[@]}"; do printf '  %d. %s\n' "$i" "$t"; i=$((i+1)); done
fi
echo; echo "Documentação: $REPO/docs/"
