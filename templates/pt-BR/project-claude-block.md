<!-- BEGIN ALETHE ORCHESTRATION -->
## Orquestração multi-agente (alethe): padrão de trabalho

Este projeto usa a skill `alethe` (`.claude/skills/alethe`), com o **modo passivo ligado**. A sessão principal (Opus) é o **lead**: planeja, decide, integra e valida. Aplique as regras abaixo por conta própria, sem esperar comando do usuário, e avise em 1 linha sempre que delegar.

### Quem faz o quê (perfil `base`: mais tokens, zero perda de qualidade)
| Trabalho | Quem |
|---|---|
| Planejar, decisões de design, integrar, validação final | lead (Opus) |
| Ler/varrer muito código, mapear, pesquisar (somente leitura) | agy Gemini Flash (gasta a cota Google). O brief precisa dizer "use só ferramentas de leitura de arquivo, nunca shell", porque o modo leitura do agy bloqueia shell. Se a unidade precisar de shell: subagent `scout` (haiku) |
| Implementar uma unidade já planejada | Sonnet (padrão). Opus quando a unidade é `deep` ou `risky` (as rules do playbook decidem) |
| Revisão independente de diff (caça a bugs) | agy Claude Opus. A validação final é do lead |
| Edição mecânica com check automático (rename, boilerplate, i18n, docs, scaffolding de teste) | opencode `9router/free` (grátis, via `opencode-safe`), sempre em worktree isolada. Se o check falhar, escala para Sonnet |
| Tarefa pequena (até 3 arquivos), acoplada ou ambígua | o lead faz direto, porque delegar custaria mais |

Segredos **nunca** saem da máquina: `.env*`, chaves (`*.pem`, `*.key`), JSONs de credentials/service account. Nunca ponha esses arquivos em `seedPaths`, nem os cite ou copie em brief.
O worker grátis roda no sandbox do kernel (`~/.local/bin/opencode-safe`), que bloqueia a leitura desses arquivos mesmo que o modelo tente.
Unidades `risky` (auth, pagamentos, migrations, máquina de estados) não vão para o worker grátis por **qualidade**, não por sigilo: vão para Sonnet/Opus com `review-gate`.

{{WORKFLOW_SECTION}}
- Briefs de worker apontam para arquivos (spec/plan/tasks, este CLAUDE.md) em vez de copiar conteúdo. Todo brief inclui as regras não negociáveis deste arquivo e o comando de check.
- Consulte o graphify antes de grep ou leitura ampla, e mande os scouts fazerem o mesmo. O RTK é automático. Caveman vale só para as respostas ao usuário: briefs, código e commits ficam em texto normal.

### Gates (checks que aceitam o trabalho de um worker)
{{GATES}}

### Unidades naturais de paralelização
{{UNITS}}

### Comandos (o usuário não precisa lembrar; você roda)
- Antes de trabalho grande e depois de compactação: `python3 .claude/skills/alethe/scripts/orchestrate.py status` e `... usage`.
- Mais de 2 workers em paralelo, ou unidade cara: mostre o `dry-run` (playbook, workers, modelos, estimativa, cota) e espere o ok.
- Ao fechar uma orquestração: rode `report` e mostre a saída.
- Atalhos que o usuário pode digitar: `/alethe <tarefa>` · `/alethe status` · `/alethe report html` · `/alethe usage` · `/alethe editor` · `/alethe off`.

### Receita alethe (comandos exatos, sem adivinhar)
```bash
A=.claude/skills/alethe/scripts/orchestrate.py
python3 $A usage --refresh-claude --refresh-agy   # cota real antes da 1ª onda (senão aparece "unknown")
python3 $A playbook --pick                         # escolhe o playbook
python3 $A new "<título>" --playbook <id> --why "<1 linha>" --lead claude:opus
python3 $A scaffold <strategy> --workers N         # imprime o plano JSON; salve fora do repo
python3 $A validate <plan.json> && python3 $A dry-run <plan.json>
python3 $A run <plan.json> --in current --detach && python3 $A wait --timeout 540
python3 $A report
```
- O `scaffold` aceita **strategy** (`economy|balanced|quality|research|parallel|rescue`), não nome de playbook. Correspondência: `plan-execute`→`economy` · `parallel-worktrees`→`parallel` · `review-gate`→`research` (revisores) e `economy` (fix) · `cascade`→`economy`.
- O campo `mode` do worker só aceita `"read-only"` ou `"write"`.
- `status` antes da primeira onda responde `no runs found`. É normal: ainda não há orquestração.
- Revisão: gere o diff completo com `git diff <base>...HEAD > .alethe/review.diff` (a pasta é excluída do git) e mande o revisor ler esse arquivo. Nunca use diff filtrado à mão: ele gera falso "arquivo faltando".
- Todo brief de agy termina com: "Use só ferramentas de leitura de arquivo, nunca shell. NÃO crie plano nem peça aprovação; execute direto e termine com STATUS/SUMMARY."
- Subagent nativo (Agent tool): só `scout`, `builder` ou `reviewer`, ou um tipo genérico com `model: "haiku"`/`"sonnet"`. O hook `agent-model-guard` bloqueia o resto (Explore/general-purpose sem modelo, fork, opus).
- Worktrees na pasta temporária da sessão são permitidas (`trust.cwdRoots`).

### Regras
- Workers nunca fazem commit nem push; quem integra é o lead. Commit/push só quando o usuário pedir.
- Se `ALETHE_ORCHESTRATE_WORKER=1`, você é worker: não delegue, faça só o brief e termine com as linhas `STATUS:` e `SUMMARY:`.
- `.claude/skills/alethe`, `.claude/settings.local.json` e `.alethe/` são locais (git exclude) e nunca entram no git.
- Política e playbooks ficam globais em `~/.config/alethe/`. Para trocar de perfil o usuário diz "use savings", "go aggressive" ou "use base".
<!-- END ALETHE ORCHESTRATION -->
