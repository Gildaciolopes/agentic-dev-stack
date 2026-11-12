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
| `sandbox-exec` (macOS) / `bubblewrap` (Linux) | leitura de `.env*`, chaves, credentials, `~/.ssh`, `~/.aws`, Keychain, **qualquer que seja o comando** | `bin/opencode-safe` + `sandbox/deny-secrets.sb.template` (macOS), `bin/opencode-safe-linux` (Linux) |
| `--standalone` | o serviço de fundo do OpenCode rodando fora do sandbox | `bin/opencode-safe` |
| Permissões do OpenCode | 2ª camada (bypassável, ex.: `grep -r KEY .`) | `templates/opencode-permissions.json` |
| Filtro de env do alethe | vars `*_TOKEN/_KEY/_SECRET/_PASSWORD` removidas dos workers | nativo do alethe |
| Flags inseguras recusadas | `--yolo`, `--dangerously-skip-permissions`, `--auto`... | alethe (`trust.allowUnsafe` off) |
| Hermes sem shell | injection não executa nada | `hermes tools disable ...` |
| Allowlist de chat | só o seu ID fala com o bot | `*_ALLOWED_USERS` |
| Mascaramento | o coletor mascara padrões de segredo e dados pessoais (e-mails, CPF/CNPJ, telefones) e descarta texto colado nos prompts antes do LLM ver qualquer coisa | `scripts/daily-digest/collect.py` (`SECRET`, `PERSONAL`, `prompt_text`) |

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

## Linux: bubblewrap

O repo traz `bin/opencode-safe-linux`, que o instalador copia para `~/.local/bin/opencode-safe` quando o `bwrap` existe (`apt install bubblewrap`). Ele:
- mascara todo `.env*`, `*.pem`, `*.key`, `*credentials*.json` e `*service-account*.json` do repo atual com `--ro-bind /dev/null`;
- esconde `~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.gemini` e `~/.codex` com `tmpfs` vazio;
- passa `--standalone` ao OpenCode (mesma razão do macOS).

Sem `bwrap`, a fase `--workers` desliga o worker grátis e avisa. Teste igual ao do macOS: `cat /tmp/leak/.env` dentro do wrapper deve mostrar o arquivo vazio.

## Windows: sem sandbox de kernel

O Windows não tem um equivalente de `sandbox-exec`/`bwrap` acessível a um usuário comum (AppContainer e Job Objects não bloqueiam leitura de arquivo por caminho de forma prática para uma CLI qualquer). Por isso:
- **Padrão:** o worker grátis (`opencode-safe`) fica **desligado** no Windows.
- **Recomendado:** rode o stack no **WSL2** e use o caminho Linux acima.
- **`ALLOW_UNSANDBOXED_FREE_WORKER=1`** em `stack.env` instala um `opencode-safe.cmd` **sem sandbox**: só worktree isolada (o `.env` não é copiado) e as permissões do OpenCode protegem você. Como o teste de vazamento mostrou, permissão por padrão de comando é contornável (`grep -r` com caminho absoluto). Aceite o risco apenas em máquinas sem segredos fora do repo.

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

## Versões fixas (cadeia de suprimentos)

Toda ferramenta de terceiros que o stack instala a partir do código-fonte tem versão fixa no [config/versions.json](../../config/versions.json): Spec Kit (`git+…spec-kit.git@<tag>`), RTK (`cargo install --tag`, quando não vem do Homebrew), caveman (marketplace `JuliusBrussee/caveman#<tag>`), graphify (`graphifyy==<versão>`) e 9Router (`9router@<versão>`); o alethe é fixado por commit (`ALETHE_COMMIT`). Assim, um branch `main` comprometido lá fora nunca chega a uma máquina que roda o wizard. O `.github/workflows/pins.yml` propõe atualizações toda semana, só para releases com pelo menos 3 dias, depois de rodar os testes; as GitHub Actions são atualizadas pelo Dependabot. Sem versão fixa de propósito: fórmulas do Homebrew e os CLIs oficiais dos fornecedores (OpenCode, Codex, agy, Claude Code), que se atualizam sozinhos.

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
