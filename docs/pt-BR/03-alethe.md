# 03. alethe: orquestração, playbooks e receita de comandos

## Conceitos

| Termo | O que é |
|---|---|
| **Lead** | Sua sessão (Claude Opus). Planeja, integra, valida. |
| **Worker** | Um CLI rodando uma unidade de trabalho isolada (claude, agy, codex, kimi ou custom como o opencode). |
| **Playbook** | Sequência de fases e papéis (ex.: `review-gate` = triagem → revisão de convenções → caça a bugs → validação → fix). |
| **Strategy** | Como **uma** onda roda: `economy`, `balanced`, `quality`, `research`, `parallel`, `rescue`. |
| **Tier** | `cheap`, `standard` ou `strong`, resolvido para modelo + effort por provedor. |
| **Perfil** | Conjunto de tiers e limites de cota: `base`, `savings`, `aggressive`. |
| **Goal** | Quão ansioso por delegar: `passive` (padrão), `save`, `balanced`, `max`, `freestyle`. |

Arquivos (globais, valem para todos os projetos):
- `~/.config/alethe/alethe-playbooks.yaml`: playbooks, tiers, perfis, adapters (gerado pelo `configure-alethe.py`)
- `~/.config/alethe/orchestrate.json`: política (ordem de provedores, troca automática, `trust.cwdRoots`)
- `~/.config/alethe/alethe-prices.json`: billing por provedor (`subscription` ou `api`)
- `~/.config/alethe/orchestrations/`: cada orquestração (planos, resultados, diffs, relatório)

## O perfil `base` do stack

| Papel | Modelo |
|---|---|
| planner / validator | lead (Opus) |
| scout (cheap) | agy Gemini Flash `effort high` · fallback Claude Haiku |
| builder (standard) | Claude Sonnet; regras do playbook sobem para Opus em `deep`, e `light` fica em Sonnet low |
| bug-hunter / reviewer | agy Claude Opus (provedor independente) · senão Codex high · senão Claude Opus |
| attempt barato do `cascade` | opencode-safe `9router/free` em worktree isolada; `risky` vai direto para Claude Sonnet |

Trocar de perfil: diga ao Claude "use savings", "go aggressive" ou "use base".

## Modo passivo (como você usa no dia a dia)

Você não precisa digitar comando nenhum. Com o modo passivo ligado (padrão):
- o lead delega sozinho unidades baratas e bem delimitadas (scouting, edição mecânica com check, testes, revisão de diff) e avisa em uma linha;
- antes de mais de 2 workers em paralelo, ou de algo caro, mostra o `dry-run` e espera seu ok;
- tarefa pequena, ambígua ou acoplada fica com o lead.

Atalhos, se quiser: `/alethe <tarefa>` · `/alethe status` · `/alethe report html` · `/alethe usage` · `/alethe editor` (abre os playbooks num HTML visual) · `/alethe off`.

## Receita de comandos exatos

Para o lead (e para você, se quiser rodar à mão):

```bash
A=.claude/skills/alethe/scripts/orchestrate.py
python3 $A usage --refresh-claude --refresh-agy   # cota real (senão aparece "unknown")
python3 $A playbook --pick                         # qual playbook serve
python3 $A new "<título>" --playbook <id> --why "<1 linha>" --lead claude:opus
python3 $A scaffold <strategy> --workers N         # esqueleto do plano JSON (salve FORA do repo)
python3 $A validate plan.json && python3 $A dry-run plan.json
python3 $A run plan.json --in current --detach && python3 $A wait --timeout 540
python3 $A report            # ou: report --format html
```

### Exemplo de plano (2 workers: scout agy + writer grátis isolado)

```json
{
  "version": 1,
  "title": "Renomear UserDTO e mapear usos",
  "playbook": "cascade",
  "phase": "try-cheap",
  "why": "rename mecânico com typecheck como gate",
  "strategy": "balanced",
  "workers": [
    {"id": "scout", "why": "mapear usos na cota Google", "provider": "agy", "tier": "cheap", "mode": "read-only",
     "cwd": "/abs/path/do/repo",
     "task": "Goal: liste todos os usos de UserDTO com arquivo:linha. Done: lista completa. Use só ferramentas de leitura de arquivo, nunca shell. NÃO crie plano nem peça aprovação; execute direto e termine com STATUS/SUMMARY."},
    {"id": "rename", "why": "edição mecânica grátis", "provider": "opencode", "tier": "cheap", "mode": "write", "isolate": true,
     "cwd": "/abs/path/do/repo",
     "task": "Goal: renomeie UserDTO para UserView em src/. Owned paths: src/**. Check: pnpm typecheck passa. Não toque em .env nem em segredos."}
  ]
}
```

## Pegadinhas (todas vistas em uso real)

| Sintoma | Causa | Como fazer |
|---|---|---|
| `status` responde `error: no runs found` | ainda não há orquestração | normal; rode `new` primeiro |
| cota "5h unknown, week unknown" | nenhuma leitura ainda | `usage --refresh-claude --refresh-agy` (o coletor diário faz isso todo dia) |
| `mode must be read-only or write` | escreveu `"read"` | só `"read-only"` ou `"write"` |
| `scaffold` não aceita `review-gate` | scaffold recebe **strategy**, não playbook | `plan-execute`→`economy` · `parallel-worktrees`→`parallel` · `review-gate`→`research` (revisores) e `economy` (fix) · `cascade`→`economy` |
| `cwd ... is outside the lead checkout` | worktree fora do repo | o `configure-alethe.py` libera `/tmp` e `PROJECTS_DIR` em `trust.cwdRoots` |
| agy termina com "Please review and approve" | modo plano do agy pede aprovação | o brief termina com "NÃO crie plano nem peça aprovação" (princípio já no perfil) |
| agy `permission denied: RunCommand` | o modo leitura do agy não roda shell | o brief diz "use só ferramentas de leitura de arquivo"; para unidade com shell, use claude |
| `--model X conflicts with --effort` | modelos Claude do agy não aceitam effort; Gemini usa id base + effort | já resolvido nos tiers (`gemini-x-flash` + `effort: high`) |
| revisor aponta "arquivo faltando" que existe | recebeu diff filtrado à mão | sempre o diff completo: `git diff <base>...HEAD > .alethe/review.diff` |
| agy/opencode sem custo no report | esses CLIs não reportam dólar | compare por tokens; só o Claude reporta custo |

## Por que subagente nativo E alethe?

| | Subagente nativo (`scout`/`builder`/`reviewer`) | alethe |
|---|---|---|
| Contexto da conversa | herda o pedido do lead | só o brief (arquivos apontados) |
| Provedores | só Claude | Claude, agy, Codex, Kimi, qualquer CLI |
| Cota | não vê | lê e troca de provedor antes de estourar |
| Paralelo isolado | `isolation: "worktree"` | `isolate: true` por writer |
| Relatório de custo | não | `report html` |
| Quando usar | unidade rápida que precisa do contexto | várias unidades, outro provedor, economia de cota |

O `agent-model-guard` garante que o nativo nunca caia no Opus por acidente.

## Atualizar o alethe com segurança

1. `git clone` do repo e `git log ab81104..HEAD` para ver o que mudou.
2. Audite: hooks, chamadas de rede, flags de bypass, `shell=True` (ver [07-seguranca.md](07-seguranca.md)).
3. Mude `ALETHE_COMMIT` no `config/stack.env` e rode `./install.sh --workers`.
4. Se o `configure-alethe.py` acusar "anchor not found", o formato dos playbooks mudou upstream: ajuste o script.
