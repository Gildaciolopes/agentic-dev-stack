# 04. Codex, Gemini, Kiro, Copilot: onde encaixar outros CLIs

O stack é agnóstico ao provedor. O Claude é o lead padrão, mas cada peça aceita outros CLIs.

## Codex (OpenAI): encaixe nativo

O Codex é um **provedor nativo do alethe** (read-only via sandbox, write via `workspace-write`, resume, leitura de cota pelos próprios arquivos de sessão). Vale muito a pena se você tem ChatGPT Plus/Pro, porque a cota da assinatura que sobra no reset é perdida.

### Instalar
```bash
# em config/stack.env: WITH_CODEX=1
./install.sh --workers          # brew install codex + rtk init -g --codex
codex login                     # conta ChatGPT
./scripts/configure-alethe.py --force   # reconstrói o perfil já com Codex
```

### O que muda no perfil
- `providers` ganha `codex` e os tiers ganham `codex: { effort: low|medium|high }`.
- `passive.prefer` vira `[codex, agy, claude]`: no modo passivo, unidades delegáveis vão primeiro para o Codex **enquanto as janelas 5h/semana dele estiverem frescas e abaixo do limite**.
- Revisor: se não houver agy com Opus, o bug-hunter vira `codex high`. Codex revisando código do Claude é exatamente o "segundo par de olhos de outro provedor".
- Escalonamento (`fixer` quando o Claude está baixo): `codex xhigh`.

### Codex como lead (em vez do Claude)
O alethe funciona igual com o Codex como lead: a skill é universal e o Codex lê `AGENTS.md`. Instale a skill para o Codex:
```bash
npx skills add Kc1t/alethe-orchestrate-skill    # escolha Codex; ou: codex plugin marketplace add Kc1t/alethe-orchestrate-skill
```
O bloco `AGENTS.md` que o `add-project.py` gera já traz as regras de worker. No `new`, use `--lead codex:<modelo>`.

### Economia de tokens no Codex
- `rtk init -g --codex` (feito pelo instalador)
- `headroom wrap codex` para sessões de leitura pesada
- caveman: a skill funciona em qualquer agente que leia skills

## Gemini CLI

O login com conta pessoal foi descontinuado. Opções:
1. **agy (recomendado):** mesma cota Google, com Gemini e modelos Claude. Já é provedor nativo do alethe.
2. **Chave grátis do AI Studio** (aistudio.google.com/apikey): coloque como provider no 9Router, e o Gemini vira mais um modelo do combo `free`.
3. **Gemini CLI com API key**, como worker **custom** do alethe (abaixo).

## Qualquer outro CLI (Kiro, Copilot CLI, Aider, Cline, Kimi...)

O alethe aceita workers `provider: "custom"`. Para adicionar um ao perfil, edite `~/.config/alethe/alethe-playbooks.yaml`:

```yaml
providers: [claude, agy, opencode, kiro]

adapters:
  kiro:
    command: kiro-cli
    args: [chat, --no-interactive, --trust-tools=fs_read,fs_write]   # a permissão mais estreita que ainda escreve
    promptTransport: argument      # ou stdin
    outputFormat: text             # text | json | jsonl
    modelFlag: "--model"
    checked: "kiro-cli chat --help, 2026-11-01"

tiers:
  cheap:
    kiro: { model: <modelo-barato> }
```

Regras do alethe para custom:
- **nunca read-only** (não dá para garantir que não escreve): sempre `mode: write` + `isolate: true`;
- flags que aprovam tudo (`--yolo`, `--trust-all-tools`, `--allow-all-tools`, `--auto`, `-y`) são **recusadas**, a menos que a policy tenha `trust.allowUnsafe: true`, coisa que só você deve ligar;
- se o CLI tiver acesso a arquivo, embrulhe num sandbox como o `opencode-safe` (troque o binário no wrapper).

Rode `./scripts/configure-alethe.py` só para Claude/agy/Codex/OpenCode. Customs entram à mão, uma vez.

## Kimi Code

Provedor nativo do alethe, mas o modo prompt do Kimi **sempre aprova tudo** (auto). Por isso o alethe recusa Kimi read-only. Use só como writer isolado.

## Modelos grátis em qualquer CLI

O 9Router expõe o combo `free` em `http://127.0.0.1:20128/v1` (OpenAI-compatível). Qualquer CLI que aceite base URL customizada pode usar: OpenCode (aplicado pelo 9Router), Aider (`--openai-api-base`), Cline, o próprio Hermes. A tela **CLI Tools** do 9Router aplica a configuração em vários deles automaticamente.

## Matriz rápida

| CLI | Papel sugerido | Read-only? | Custo |
|---|---|---|---|
| claude (Sonnet/Haiku) | builder, scout com shell | sim (`plan`) | assinatura Claude |
| agy Gemini Flash | scout de leitura | sim (sem shell) | cota Google grátis |
| agy Claude Opus | revisor independente | sim | cota Google (3p) |
| codex | builder, revisor, fallback | sim (sandbox) | assinatura ChatGPT |
| opencode-safe + 9router | mecânico | não (writer isolado) | grátis |
| kimi | writer isolado | não | assinatura Kimi |
| custom (kiro, copilot...) | writer isolado | não | depende |
