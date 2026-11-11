# 07. Segurança: sandbox, segredos, auditoria

## Modelo de ameaça

Um setup multi-agente amplia três riscos:
1. **Vazamento de segredo:** um worker (principalmente com modelo grátis) lê `.env`/chaves e os manda para um provedor externo.
2. **Execução indevida:** prompt injection (num arquivo, log, issue ou página) faz um agente rodar comando.
3. **Código de terceiro:** skills, plugins e instaladores `curl | bash` rodam com o seu usuário.

## Camadas de defesa

| Camada | Protege contra | Onde |
|---|---|---|
| Worktree isolada | o worker não enxerga `.env` (o git não copia ignorados) | alethe `isolate: true`; sem `seedPaths` de segredo |
| `sandbox-exec` (kernel) | leitura de `.env*`, chaves, credentials, `~/.ssh`, `~/.aws`, Keychain, **qualquer que seja o comando** | `bin/opencode-safe` + `sandbox/deny-secrets.sb.template` |
| `--standalone` | o serviço de fundo do OpenCode rodando fora do sandbox | `bin/opencode-safe` |
| Permissões do OpenCode | 2ª camada (bypassável, ex.: `grep -r KEY .`) | `templates/opencode-permissions.json` |
| Filtro de env do alethe | vars `*_TOKEN/_KEY/_SECRET/_PASSWORD` removidas dos workers | nativo do alethe |
| Flags inseguras recusadas | `--yolo`, `--dangerously-skip-permissions`, `--auto`... | alethe (`trust.allowUnsafe` off) |
| Hermes sem shell | injection não executa nada | `hermes tools disable ...` |
| Allowlist de chat | só o seu ID fala com o bot | `*_ALLOWED_USERS` |
| Mascaramento | o coletor mascara padrões de segredo antes do LLM ver | `scripts/daily-digest/collect.py` (`SECRET`) |

## Testes de vazamento (feitos de verdade, reproduza)

Monte um repo de teste com um segredo falso:
```bash
mkdir /tmp/leak && cd /tmp/leak && git init -q && echo 'def soma(a,b): return a+b' > calc.py && git add -A && git commit -qm init
echo "API_KEY=FAKE-SECRET-123" > .env
git worktree add -q ../leak-wt && cd ../leak-wt
```

| Tentativa | `opencode` puro | `opencode-safe` |
|---|---|---|
| ferramenta read em `.env` | negado (permissão) | negado |
| `cat .env` | negado (padrão de bash) | negado |
| `grep -r API_KEY /tmp/leak` (caminho absoluto) | **VAZOU** | `Operation not permitted` |
| `python3 -c "print(open('/tmp/leak/.env').read())"` | negado (external_directory) | `Operation not permitted` |
| `cat .env.example` | ok | ok (template liberado) |
| editar `calc.py` e rodar teste | ok | ok |

Lição: **filtro por padrão de comando é decorativo**. Só o kernel (ou um container) segura de verdade. E sem `--standalone`, o sandbox não pega nada, porque quem executa é o serviço de fundo (`opencode serve --service`).

```bash
# o sandbox funciona?
/usr/bin/sandbox-exec -f ~/.config/agentic-dev-stack/deny-secrets.sb cat /tmp/leak/.env   # → Operation not permitted
```

## Linux: equivalente com bubblewrap

```bash
#!/bin/sh
# ~/.local/bin/opencode-safe (Linux): monta o repo atual, esconde segredos com tmpfs/bind vazio
exec bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp \
  --bind "$PWD" "$PWD" --bind "$HOME/.local/share/opencode" "$HOME/.local/share/opencode" \
  --tmpfs "$HOME/.ssh" --tmpfs "$HOME/.aws" --tmpfs "$HOME/.config/gcloud" \
  $(find "$PWD" -name '.env*' ! -name '*.example' -printf '--ro-bind /dev/null %p ') \
  opencode --standalone "$@"
```
Ou rode o worker num container sem montar segredos.

## Auditoria de terceiros (o que foi verificado)

### alethe (commit `ab81104`)
- **Hooks:** `UserPromptSubmit` e `PostToolUse`. Ficam silenciosos sem modo ativo; no modo passivo leem o transcript local para estimar gasto e escrevem estado em `~/.config/alethe/`.
- **Rede:** nenhum código de rede (sem urllib/requests/socket). Nada sai da máquina além do que os CLIs worker enviam aos próprios provedores.
- **Subprocess:** sempre com array de argumentos, `shell=False`, sem `eval`/`exec`.
- **Workers:** Claude em `acceptEdits` com `--permission-prompts none`; Codex em sandbox; flags inseguras exigem dupla confirmação (no plano e na policy do usuário).
- **Ressalva:** o worker Claude edita e roda shell sem perguntar, então use worktree isolada.

### Hermes Agent (v0.23.x)
- **Instalador:** downloads com sha256 (uv, python, node, ripgrep, deps via `uv.lock`), sem sudo no macOS, release estável (tag resolvida na hora). Escreve em `~/.hermes`, `~/.local/bin` e uma linha de PATH no rc do shell.
- **Telemetria:** `shared_metrics` desligado por padrão, com consentimento separado para envio. O PostHog do cua-driver fica desligado.
- **Autorização no Discord:** com `DISCORD_ALLOWED_USERS` definido, nega todo o resto (DM e slash). Os bypasses são todos opt-in.
- **Risco:** com `terminal.backend: local` (o padrão), um usuário autorizado (ou uma injection) pode rodar shell, e `approvals.mode: smart` auto-aprova via LLM. Por isso o stack desliga o terminal e põe as aprovações em manual.

### Headroom
Proxy local por onde passa todo o tráfego da API. Telemetria e beacon desligados via `HEADROOM_TELEMETRY=off` e `HEADROOM_BEACON=off`.

### 9Router
O `postinstall` só pré-aquece dependências (SQLite, wreq-js); é seguro pular. A WebUI tem senha padrão (troque). O modo remoto/túnel expõe a API, então não ligue sem trocar a chave.

## Checklist ao adicionar uma ferramenta nova

1. Leia o instalador antes do `curl | bash`.
2. `grep` por rede (`requests|urllib|fetch|axios|posthog|sentry|telemetry`), `shell=True`, `eval`, flags de bypass.
3. Que hooks ela registra, e quando disparam?
4. Que arquivos lê e escreve fora da pasta dela?
5. Tem telemetria? Como desligar?
6. Fixe a versão auditada (commit/tag) e só atualize depois de auditar o diff.

## Segredos já commitados

Se um scan encontrar chave privada no histórico do git (ex.: um `*service-account*.json` commitado):
1. **Revogue/rotacione a chave primeiro**, no console do provedor.
2. `git rm --cached <arquivo>` e adicione ao `.gitignore`.
3. Avise o dono do repo. Limpar o histórico (`git filter-repo`) vem só depois de revogar a chave, porque ela já está em clones e forks.
