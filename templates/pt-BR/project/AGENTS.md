<!-- AGENTS.md inicial para Codex, OpenCode, Antigravity, Cursor e outros agentes. Preencha os placeholders e apague estes comentários. -->
# <NOME DO PROJETO>: instruções para agentes

As regras completas estão em `CLAUDE.md`. Este arquivo é o espelho curto para qualquer agente.

## Projeto
<Descrição em uma linha>. Stack: <...>. Estrutura: <src/..., tests/...>.

## Comandos
```bash
<comando test>
<comando lint>
<comando typecheck>
<comando build>
```

## Regras (todos os agentes)
- Nunca ler, imprimir ou commitar segredos (`.env*`, chaves, JSON de credenciais). Operações destrutivas ou de produção só com ok humano.
- <regra inegociável específica do projeto>
- Nunca commitar nem dar push sem o usuário pedir.
- Conventional commits (`feat:`, `fix:`, `docs:` ...).
- Não diga "pronto" antes de rodar as checagens acima e mostrar a evidência.
- Com `graphify-out/` presente, rode `graphify query "<pergunta>" --budget 1500` antes de grep amplo.
- A saída do shell pode ser comprimida pelo RTK; use `rtk proxy <cmd>` para a saída crua.
- O estilo telegráfico vale só para respostas ao usuário; código, commits e briefs ficam em prosa normal.
- Features seguem a ordem do Spec Kit: specify, clarify, plan, tasks, analyze, implement. Decisões ficam com o lead.

## Contrato do worker (alethe)
Se `ALETHE_ORCHESTRATE_WORKER=1`, ou você recebeu um brief de worker:
- faça só a unidade do brief, só nos caminhos que ele lista;
- não delegue nem inicie outro agente;
- não faça commit nem push;
- rode a checagem que o brief nomeia;
- termine com `STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT` e `SUMMARY:`.
