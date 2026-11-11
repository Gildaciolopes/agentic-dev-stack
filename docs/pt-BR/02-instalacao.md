# 02. Instalação passo a passo

Tempo estimado: 20–30 min, a maior parte criando contas e chaves.

## 0. Pré-requisitos

| Item | Como |
|---|---|
| SO | macOS, Linux (Debian/Ubuntu) ou Windows (PowerShell; **WSL2 recomendado**). Ver "Notas por sistema" no fim |
| Node ≥ 18, git | macOS: `brew install node git` · Linux: `sudo apt install nodejs npm git` · Windows: `winget install OpenJS.NodeJS.LTS Git.Git` |
| Python ≥ 3.9 (alethe, curador, resumo) | macOS: `brew install python` · Linux: `sudo apt install python3` · Windows: `winget install Python.Python.3.12` |
| Claude Code logado | macOS: `brew install --cask claude-code`; depois `claude` (assinatura Pro/Max ou API) |

## 1. Escolher o método e configurar

O instalador é um CLI Node multiplataforma, sem dependências. Na primeira execução ele copia `config/stack.env.example` para `~/.config/agentic-dev-stack/stack.env`; edite essa cópia:

```bash
$EDITOR ~/.config/agentic-dev-stack/stack.env
```

Campos importantes:
- `PROJECTS_DIR`: onde ficam seus repos (o resumo diário descobre os projetos ali).
- `TIMEZONE`, `CURATOR_TIMES`, `DIGEST_COLLECT_TIME`, `DIGEST_SEND_TIME`.
- `HERMES_PLATFORM`: `discord`, `telegram` ou `none`.
- `SUMMARY_LANGUAGE`: idioma dos resumos do Hermes.
- `PROJECT_DOCS_LANG`: `en` ou `pt-BR`, idioma do bloco que o `add-project` anexa ao `CLAUDE.md`/`AGENTS.md`.
- `WITH_AGY`, `WITH_OPENCODE`, `WITH_CODEX`, `WITH_HEADROOM`.
- `ALLOW_UNSANDBOXED_FREE_WORKER`: só Windows (ver notas no fim).
- `ALETHE_COMMIT`: o commit auditado do alethe. Só troque depois de auditar outro.

## 2. Rodar o instalador

Três métodos equivalentes:

```bash
npx agentic-dev-stack install --all   # qualquer SO, sem clonar
./install.sh --all                                         # clone, macOS/Linux
```
```powershell
.\install.ps1 --all                                        # clone, Windows PowerShell
```
(Também vale `node bin/cli.mjs install --all` dentro do clone.)

Ou por fases, na ordem: `--core`, `--workers`, `--free-models`, `--extras`, `--hermes`. Use `--dry-run` para só mostrar o que seria feito. Ferramentas vêm via npm quando possível (`opencode-ai`, `@openai/codex`, `9router`); o agy é cask do Homebrew no macOS e download manual nos demais (https://antigravity.google/product/antigravity-cli); o RTK vem de brew/cargo, e no Windows é o zip das releases. Cada fase:
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
npx agentic-dev-stack add-project ~/projects/meu-app --dry-run   # veja o bloco que seria anexado
npx agentic-dev-stack add-project ~/projects/meu-app
```
No clone: `node bin/cli.mjs add-project ...`. Opções: `--dry-run`, `--no-docs`, `--lang en|pt-BR`, `--refresh`, `--remove`.
Revise no fim do `CLAUDE.md` do projeto os **Gates** (comandos de check) e as **Unidades de paralelização**: elas são detectadas automaticamente a partir de Makefile, package.json, pyproject, Cargo e go.mod.

**Nada da pasta é apagado.** Um `CLAUDE.md`/`AGENTS.md` que já existe só ganha um bloco no fim, entre os marcadores `BEGIN/END ALETHE ORCHESTRATION`; se não existe, é criado. O `.claude/settings.local.json` é mesclado. Rodar duas vezes não muda nada.

#### Projeto novo do zero
O bloco é gerado a partir do que a pasta tem *naquele momento*; numa pasta vazia, os gates saem genéricos. Dois jeitos de acertar:

```bash
mkdir loja && cd loja && git init      # git primeiro: os arquivos locais já entram no git exclude
# base do projeto: package.json/pyproject com scripts de test, lint, typecheck
specify init .                         # opcional: Spec Kit -> o bloco já sai no fluxo SDD
npx agentic-dev-stack add-project . --lang pt-BR
```

Ou ligue no primeiro dia e atualize depois da base pronta:

```bash
npx agentic-dev-stack add-project . --lang pt-BR            # dia 1, pasta vazia
# ...base do projeto, scripts, specify init...
npx agentic-dev-stack add-project . --lang pt-BR --refresh  # regera só o nosso bloco; o seu texto em volta fica
```

#### Desligar um projeto
```bash
npx agentic-dev-stack add-project ~/projects/meu-app --remove   # --dry-run para ver antes
```
Remove o nosso bloco, o link do alethe, os hooks do alethe no `settings.local.json` e as nossas linhas no `.git/info/exclude`. Um `CLAUDE.md`/`AGENTS.md` que só tinha o nosso bloco é apagado; o que você escreveu fica.

> **Repos versionados:** o bloco é anexado ao `CLAUDE.md`/`AGENTS.md`, que normalmente estão no git, então aparece no `git status`. Commite se o time usa o stack, ou não commite se é só seu. A skill, o hook e a pasta `.alethe/` já ficam fora do git via `.git/info/exclude`.

### 3.5 Hermes
Ver [06-hermes.md](06-hermes.md): criar o bot no Discord ou no Telegram e pegar o seu ID. O instalador pede o token com `read -s`, então ele não aparece na tela nem no histórico.

### 3.6 Codex (opcional)
Ver [04-codex-e-outros-clis.md](04-codex-e-outros-clis.md).

## 4. Verificar

```bash
npx agentic-dev-stack doctor                                     # ferramentas, hooks, config e agendamentos
rtk gain                                                         # RTK contando economia
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py doctor # alethe: playbooks/policy válidos
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py usage --refresh-claude --refresh-agy
opencode run -m 9router/free "Responda só: OK"                   # combo grátis respondendo
~/.local/bin/hermes gateway status                               # Hermes supervisionado
```

Teste do guard: dentro do claude, peça "lance um subagente Explore para listar arquivos". Ele deve ser **negado**, com uma mensagem indicando o `scout`.

## 5. Desinstalar

```bash
npx agentic-dev-stack uninstall --dry-run   # veja o que seria removido
npx agentic-dev-stack uninstall             # --purge remove também a skill do alethe e o seu stack.env
```

Remove só o que o instalador criou ou anexou:
- o bloco `AGENTIC-DEV-STACK` do `~/.claude/CLAUDE.md` (o seu texto fica);
- o hook do guard e o `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` do `~/.claude/settings.json` (as outras chaves ficam; um modelo diferente que você escolheu fica);
- o script do guard e os subagentes `scout`/`builder`/`reviewer`, **a menos que você tenha editado**;
- os agendamentos do curador, do resumo e do 9Router (launchd, crontab/systemd ou Agendador de Tarefas);
- o `opencode-safe`, o perfil do sandbox e os scripts agendados.

Todo arquivo editado ganha backup antes, em `~/.local/share/agentic-dev-stack/backups/<data>/`, mantendo o caminho original. As ferramentas de terceiros continuam instaladas; o comando mostra como remover cada uma (hook do RTK: `rtk init -g --uninstall`; rotinas do Hermes: `hermes cron list`). Projetos ligados são desligados um a um com `add-project <pasta> --remove`.

## Notas por sistema

### macOS
Suporte completo, incluindo o sandbox de kernel (`sandbox-exec`), launchd para agendamentos e autostart do 9Router, e agy via cask do Homebrew.

### Linux (Debian/Ubuntu)
- **Sandbox:** instale `sudo apt install bubblewrap`; o `bin/opencode-safe-linux` vira `~/.local/bin/opencode-safe`. Detalhes em [07-seguranca.md](07-seguranca.md).
- **Agendamentos:** `crontab` do usuário. Autostart do 9Router: unit `systemd --user` `agentic-dev-stack-9router`. O Hermes também usa serviço systemd de usuário (`hermes gateway install`).
- **Antigravity:** baixe manualmente (link acima). Sem ele, o revisor independente vira Codex ou o próprio Claude (o `configure-alethe` decide sozinho).

### Windows
- Agendamentos no Agendador de Tarefas; autostart do 9Router por tarefa `schtasks` `ONLOGON` (`agentic-dev-stack-9router`).
- **Sem sandbox de kernel:** o worker grátis fica **desligado por padrão**. `ALLOW_UNSANDBOXED_FREE_WORKER=1` cria um `opencode-safe.cmd` **sem sandbox** (só worktree isolada + permissões do OpenCode); use apenas em repos sem segredos.
- RTK: baixe o zip nas releases e coloque no `PATH`. agy: download manual.
- **Recomendado:** WSL2 (`wsl --install -d Ubuntu`) e siga as instruções de Linux dentro dele.
