# agentic-dev-stack

> Um setup de desenvolvimento com IA para **parar de usar um agente por vez**: o modelo caro planeja, os baratos (ou grátis) executam, um revisor independente confere, e tudo gasta o mínimo de tokens possível. Com um assistente sempre ligado (Hermes) que te avisa no Discord/Telegram.

Funciona em cima do **Claude Code** e encaixa **Antigravity (agy)**, **OpenCode**, **Codex** e qualquer CLI de agente. Instalação em um comando, idempotente, pensada para replicar em outro PC ou entregar para outra pessoa.

---

## O problema que isso resolve

| Sem o stack | Com o stack |
|---|---|
| Um agente por vez, você vira o gargalo | Lead planeja e dispara vários workers em paralelo, cada um em worktree isolada |
| Subagentes herdam o modelo mais caro (Opus) sem você perceber | Hook bloqueia subagente em Opus; padrão vira Sonnet; leitura vai pro Haiku/Gemini |
| Cota do Claude acaba no meio do dia | Leitura pesada vai pra cota do Google (agy) e tarefas mecânicas pra modelos grátis (NVIDIA via 9Router) |
| "Modelo grátis" quebra toda semana (descontinuado, 404, timeout) | Curador testa os modelos 3x/dia e reescreve o combo sozinho |
| Saída de terminal e contexto inflando tokens | RTK comprime comandos, caveman corta resposta, Headroom (opcional) comprime contexto |
| Regras só no CLAUDE.md, que o modelo esquece | Regras viram enforcement: hook, sandbox de kernel, política do alethe |
| Você só sabe o estado das coisas abrindo o PC | Hermes manda resumo diário + plano do dia no Discord/Telegram |

---

## Arquitetura em uma imagem

```
                         ┌──────────────────────────────────────────────┐
  você ──────────────▶   │  LEAD: Claude Code (Opus)                    │
                         │  planeja · decide · integra · valida         │
                         │  Spec Kit + graphify + RTK + caveman         │
                         └───────┬───────────────┬───────────────┬──────┘
                 subagentes nativos       alethe (orquestrador)   │
                 (Agent tool, guardado)   playbooks + cota        │
                         │                       │                │
        ┌────────────────┼──────────┐   ┌────────┼─────────────┐  │
        ▼                ▼          ▼   ▼        ▼             ▼  │
     scout           builder    reviewer  agy           opencode  codex*
     (Haiku)         (Sonnet)   (Sonnet)  Gemini/Opus   9router/free (plugável)
     leitura         implementa revisa    scout+review  mecânico, em sandbox
                                                │
                                    9Router ◀───┘  combo "free" (NVIDIA NIM…)
                                       ▲
                          curador 3x/dia testa e reescreve o combo
                                       │
   Hermes (sempre ligado, sem shell) ──┴── resumo 08:00 · avisos · perguntas pelo celular
```

\* Codex não vem instalado, mas é provedor nativo do alethe. Ver [docs/04-codex-e-outros-clis.md](docs/04-codex-e-outros-clis.md).

---

## Quem faz o quê

| Peça | Papel | Por que essa escolha |
|---|---|---|
| **Claude Code (Opus)** | Lead: planeja, decide design, integra, valida o final | Melhor raciocínio; gasto concentrado onde importa |
| **Sonnet** (subagent `builder` / worker alethe) | Implementa unidades já planejadas; Opus só em unidade `deep`/`risky` | Custo médio, qualidade alta para código guiado por plano |
| **Haiku** (subagent `scout`) | Leitura e busca que precisa de shell | Barato e rápido para varrer código |
| **agy Gemini Flash** | Scout de leitura pesada (só ferramentas de arquivo) | Gasta cota do Google, não a do Claude |
| **agy Claude Opus 4.x** | Revisão independente (caça a bugs) | Outro provedor = segunda opinião real |
| **OpenCode + 9Router `free`** | Edições mecânicas com check automático (rename, boilerplate, i18n, testes) | Custo zero; roda em worktree isolada e sandbox de kernel |
| **Codex** (opcional) | Worker/revisor alternativo, fallback quando o Claude está baixo | Cota da assinatura ChatGPT que expira se não usar |
| **alethe** | Orquestrador: escolhe playbook, modelo por tarefa, vigia cota, troca de provedor | Transforma "use vários agentes" em plano reproduzível com relatório de custo |
| **Spec Kit** | Fluxo spec → plan → tasks → implement | `tasks.md` vira as unidades que o alethe distribui |
| **graphify** | Grafo de conhecimento do código | Scouts consultam o grafo antes de grep: menos leitura |
| **RTK** | Comprime saída de comandos do terminal | Hook transparente, ~15–30% menos tokens de entrada |
| **caveman** | Corta enrolação nas respostas | Menos tokens de saída e de contexto relido |
| **Headroom** (opcional) | Proxy que comprime o contexto inteiro | Para sessões de leitura pesada; troca um pouco de fidelidade por token |
| **9Router** | Roteador de modelos com fallback | Um endpoint OpenAI-compatível para vários modelos grátis |
| **Curador** | Testa modelos grátis 3x/dia (responde + tool call + latência) e reescreve o combo | Modelo grátis morre sem aviso; script determinístico resolve |
| **Hermes Agent** | Assistente sempre ligado no Discord/Telegram, sem shell | Resumo diário, avisos, perguntas pelo celular |
| **agent-model-guard** | Hook que nega subagente em Opus | Regra em texto não funciona; enforcement funciona |
| **opencode-safe** | `sandbox-exec` que bloqueia leitura de `.env`/chaves no kernel | Modelo grátis + acesso a arquivo = risco de vazamento; o kernel não negocia |

Detalhes em [docs/01-arquitetura.md](docs/01-arquitetura.md).

---

## Instalação rápida

Pré-requisitos: macOS (Apple Silicon ou Intel) com [Homebrew](https://brew.sh), Claude Code logado, Node ≥ 20, Python ≥ 3.10, git. Linux funciona com ressalvas (sem `sandbox-exec`; ver docs).

```bash
git clone <este-repo> ~/agentic-dev-stack
cd ~/agentic-dev-stack
cp config/stack.env.example config/stack.env   # ajuste horários, pasta de projetos, canal do Hermes
./install.sh --all            # ou escolha fases: --core --workers --free-models --hermes
```

Depois, em cada projeto:

```bash
./scripts/add-project.py ~/projects/meu-projeto   # instala alethe, hook passivo, blocos no CLAUDE.md/AGENTS.md
```

Passos manuais inevitáveis (logins e chaves): ver [docs/02-instalacao.md](docs/02-instalacao.md).

---

## Fases do instalador

| Fase | O que instala |
|---|---|
| `--core` | RTK (hook global), agentes `scout/builder/reviewer`, `agent-model-guard`, modelo padrão de subagente, bloco no `~/.claude/CLAUDE.md` |
| `--workers` | OpenCode, Antigravity CLI (`agy`), claude-squad + tmux, sandbox `opencode-safe`, permissões do OpenCode, alethe (commit auditado) + perfil |
| `--free-models` | 9Router (+ autostart), curador de modelos (3x/dia) |
| `--extras` | Headroom (isolado via `uv`, telemetria off), yt-dlp |
| `--hermes` | Hermes Agent endurecido + coletor diário + rotinas |
| `--all` | Tudo acima |

Cada fase é idempotente: rodar de novo não duplica nada.

---

## Documentação

1. [Arquitetura e papel de cada peça](docs/01-arquitetura.md)
2. [Instalação passo a passo (inclui logins)](docs/02-instalacao.md)
3. [alethe: orquestração, playbooks e receita de comandos](docs/03-alethe.md)
4. [Codex, Gemini, Kiro, Copilot: onde encaixar outros CLIs](docs/04-codex-e-outros-clis.md)
5. [Modelos grátis: 9Router, NVIDIA NIM e o curador](docs/05-modelos-gratis.md)
6. [Hermes: o que é, Discord/Telegram e 10 usos produtivos](docs/06-hermes.md)
7. [Segurança: sandbox, segredos, auditoria](docs/07-seguranca.md)
8. [Troubleshooting: tudo que quebrou e como resolver](docs/08-troubleshooting.md)
9. [Manutenção e atualização](docs/09-manutencao.md)

---

## Princípios

1. **Plan big, execute small** ([Anthropic cookbook](https://github.com/anthropics/claude-cookbooks)): modelo forte nas decisões, barato no volume.
2. **Delegar só quando paga**: tarefa pequena (≤ 3 arquivos) ou acoplada fica com o lead.
3. **Enforcement > instrução**: o que importa vira hook, sandbox ou política, não frase no CLAUDE.md.
4. **Segredo nunca sai da máquina**: `.env*`, chaves e credentials não entram em brief nem em worktree.
5. **Determinístico onde dá**: escolher modelo, coletar dados e trocar combo é script; LLM só resume e decide.
6. **Auditar antes de instalar**: tudo de terceiro foi lido antes (alethe fixado num commit auditado).

## Licença

MIT. Ferramentas de terceiros mantêm suas próprias licenças.
