# 02. Instalação passo a passo

Tempo estimado: 20–30 min, a maior parte criando contas e chaves.

## 0. Pré-requisitos

| Item | Como |
|---|---|
| macOS 13+ | Linux funciona sem o sandbox e com cron no lugar do launchd (ver fim do arquivo) |
| Homebrew | https://brew.sh |
| Claude Code logado | `brew install --cask claude-code` e depois `claude` (assinatura Pro/Max ou API) |
| Node ≥ 20, Python ≥ 3.10, git | `brew install node python git` |

## 1. Clonar e configurar

```bash
git clone <este-repo> ~/agentic-dev-stack && cd ~/agentic-dev-stack
cp config/stack.env.example config/stack.env
$EDITOR config/stack.env
```

Campos importantes:
- `PROJECTS_DIR`: onde ficam seus repos (o resumo diário descobre os projetos ali).
- `TIMEZONE`, `CURATOR_TIMES`, `DIGEST_COLLECT_TIME`, `DIGEST_SEND_TIME`.
- `HERMES_PLATFORM`: `discord`, `telegram` ou `none`.
- `WITH_AGY`, `WITH_OPENCODE`, `WITH_CODEX`, `WITH_HEADROOM`.
- `ALETHE_COMMIT`: o commit auditado do alethe. Só troque depois de auditar outro.

## 2. Rodar o instalador

```bash
./install.sh --all
```

Ou por fases, na ordem: `--core`, `--workers`, `--free-models`, `--extras`, `--hermes`. Cada fase:
- é idempotente (rodar de novo não duplica);
- faz backup de qualquer config que altera em `~/.local/share/agentic-dev-stack/backups/<data>/`;
- só **anexa** ao `~/.claude/CLAUDE.md`, nunca apaga.

No fim, ele imprime a lista de passos manuais. Eles estão detalhados abaixo.

## 3. Passos manuais (só você pode fazer)

### 3.1 caveman (dentro do Claude Code)
```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman
/caveman ultra
```
Para ficar sempre ligado, peça ao Claude para colocar no seu `~/.claude/CLAUDE.md` uma regra "invoque a skill caveman ultra no início de toda sessão".

### 3.2 Login no agy
Rode `agy` uma vez e faça login com a conta Google. Confira com `agy models`.

> **Gemini CLI:** o login com conta pessoal foi descontinuado ("This client is no longer supported for Gemini Code Assist for individuals"). Use o agy, ou uma chave grátis do AI Studio como provider no 9Router.

### 3.3 9Router + modelos grátis da NVIDIA
1. Crie uma chave grátis em **build.nvidia.com** (avatar → API Key → Generate). O limite é 40 requisições/min. Não precisa ter placa NVIDIA.
2. Abra `http://127.0.0.1:20128` (o instalador já deixa o 9Router subindo no login). A senha inicial é `123456`: **troque em Settings → Security**.
3. Em **Providers → NVIDIA NIM → Add connection**, cole a chave e valide.
4. Em **Combos → Create**, crie o combo `free` com estratégia **Fallback** e qualquer modelo que passe no **Test**.
5. Em **CLI Tools → OpenCode**, selecione o combo `free` e clique em **Apply**.
6. Rode o curador uma vez à mão. Ele substitui o combo pelos melhores modelos que estão funcionando:
   ```bash
   python3 -I ~/.local/share/agentic-dev-stack/model-curator/curate.py
   ```

### 3.4 Projetos
Para cada repo:
```bash
./scripts/add-project.py ~/projects/meu-app --dry-run   # veja o bloco que seria anexado
./scripts/add-project.py ~/projects/meu-app
```
Revise no fim do `CLAUDE.md` do projeto os **Gates** (comandos de check) e as **Unidades de paralelização**: elas são detectadas automaticamente a partir de Makefile, package.json e pyproject.

> **Repos versionados:** o bloco é anexado ao `CLAUDE.md`/`AGENTS.md`, que normalmente estão no git, então aparece no `git status`. Commite se o time usa o stack, ou não commite se é só seu. A skill, o hook e a pasta `.alethe/` já ficam fora do git via `.git/info/exclude`.

### 3.5 Hermes
Ver [06-hermes.md](06-hermes.md): criar o bot no Discord ou no Telegram e pegar o seu ID. O instalador pede o token com `read -s`, então ele não aparece na tela nem no histórico.

### 3.6 Codex (opcional)
Ver [04-codex-e-outros-clis.md](04-codex-e-outros-clis.md).

## 4. Verificar

```bash
rtk gain                                                         # RTK contando economia
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py doctor # alethe: playbooks/policy válidos
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py usage --refresh-claude --refresh-agy
opencode run -m 9router/free "Responda só: OK"                   # combo grátis respondendo
~/.local/bin/hermes gateway status                               # Hermes supervisionado
```

Teste do guard: dentro do claude, peça "lance um subagente Explore para listar arquivos". Ele deve ser **negado**, com uma mensagem indicando o `scout`.

## 5. Desinstalar

```bash
# agendamentos
for l in model-curator daily-digest 9router; do launchctl bootout gui/$(id -u)/com.agentic-dev-stack.$l 2>/dev/null; rm -f ~/Library/LaunchAgents/com.agentic-dev-stack.$l.plist; done
~/.local/bin/hermes gateway uninstall; ~/.local/bin/hermes uninstall
# Claude Code: remova o bloco AGENTIC-DEV-STACK de ~/.claude/CLAUDE.md, o hook e o env de ~/.claude/settings.json
rm -rf ~/.agents/skills/alethe ~/.config/alethe ~/.config/agentic-dev-stack ~/.local/bin/opencode-safe
# Projetos: remova o symlink .claude/skills/alethe e o bloco ALETHE ORCHESTRATION do CLAUDE.md/AGENTS.md
```
Os backups ficam em `~/.local/share/agentic-dev-stack/backups/`.

## Linux

- **Sem `sandbox-exec`:** use `bubblewrap` ou `firejail` no lugar do `opencode-safe` (exemplo em [07-seguranca.md](07-seguranca.md)), ou não use o worker grátis com acesso a repos que têm segredo.
- **Sem launchd:** o instalador imprime as linhas para o `crontab -e`. O Hermes usa systemd user service (`hermes gateway install`).
- **Antigravity:** verifique a disponibilidade para a sua distro. Sem ele, o revisor independente vira Codex ou o próprio Claude (o `configure-alethe.py` decide sozinho).
