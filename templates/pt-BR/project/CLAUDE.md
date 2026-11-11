<!-- CLAUDE.md inicial. Preencha os <PLACEHOLDERS>, apague seções desnecessárias e estes comentários.
     Mantenha abaixo de ~150 linhas: escreva só o que o modelo não infere do código. -->
# <NOME DO PROJETO>

<!-- 1-3 linhas: o que é e para quem. -->
<Descrição em uma linha>. Usado por <público>.

## Stack
<!-- Só escolhas e versões não óbvias. Apague o que o manifesto já diz. -->
- Linguagem/runtime: <ex.: TypeScript 5 / Node 22>
- Framework: <...>
- Dados/infra: <...>

## Mapa do repo
<!-- Onde cada coisa vive. 5-10 linhas; o graphify cobre o resto. -->
- `<src/...>`: <função>
- `<tests/...>`: <função>
- `<docs/...>`: specs, roadmap, ADRs

## Comandos
```bash
<comando dev>        # rodar localmente
<comando test>       # todos os testes
<comando lint>
<comando typecheck>
<comando build>
```

## Regras inegociáveis
<!-- Curtas, testáveis, específicas do projeto. Os exemplos abaixo: substitua. -->
- Nunca ler, imprimir ou commitar segredos (`.env*`, chaves, JSON de credenciais).
- <ex.: todo acesso ao banco passa por `src/db/`; sem SQL cru fora dela>
- <ex.: nenhuma dependência nova sem perguntar>
- Nunca dizer "pronto" sem rodar as checagens abaixo.

## Fluxo: Spec-Driven Development (GitHub Spec Kit)
<!-- Apague esta seção se não usa o Spec Kit (https://github.com/github/spec-kit). -->
Para qualquer feature não trivial, nesta ordem:
1. `/speckit.specify <o quê e por quê>`: escreve a spec (comportamento visível, sem escolhas técnicas).
2. `/speckit.clarify`: resolve ambiguidades antes de planejar.
3. `/speckit.plan <escolhas técnicas>`: plano técnico.
4. `/speckit.tasks`: tarefas ordenadas e paralelizáveis.
5. `/speckit.analyze`: confere spec, plano e tarefas atrás de lacunas.
6. `/speckit.implement`: executa as tarefas.

> O nome dos comandos varia com a versão do Spec Kit e a integração do agente: `/speckit.specify` (atual) ou `/speckit-specify` (instalações via skills). Use o que o seu projeto expõe.

Quem faz o quê: o lead (sessão principal, modelo mais forte) cuida de specify, clarify, plan, tasks e analyze, e de toda decisão. Builders só executam unidades de nível implement já planejadas. Dúvidas abertas vão para o usuário, nunca chutadas.
Correções pequenas (≤ 3 arquivos, intenção clara) pulam o ciclo.

## Economia de tokens
- **graphify primeiro**: com `graphify-out/` presente, consulte o grafo do código antes de grep ou leituras amplas: `graphify query "<pergunta>" --budget 1500`.
- **RTK** comprime a saída do shell automaticamente. Precisa da saída crua? `rtk proxy <cmd>`. Ver economia: `rtk gain`.
- **caveman**: o estilo telegráfico vale só para respostas ao usuário. Código, commits, specs e briefs de workers ficam em prosa normal.
- Leia arquivos com offset/limit; não releia um arquivo que acabou de editar (a edição teria falhado).
- `/compact` para continuar a mesma tarefa com menos contexto; chat novo quando a tarefa muda.

## Delegação
- `scout` (barato, só leitura): varrer muitos arquivos, "onde vive X", resumos.
- `builder`: unidade planejada com arquivos exatos, critérios de aceite e comando de teste. Builders em paralelo usam `isolation: "worktree"`.
- `reviewer`: checagem independente de diff; dê a ele o diff e a tarefa, não a sua conclusão.
- Faça você mesmo: trabalho pequeno, acoplado ou ambíguo.
- Trabalho com várias unidades ou provedores: use a orquestração alethe. `npx agentic-dev-stack add-project .` acrescenta o bloco alethe completo a este arquivo automaticamente (conteúdo existente intacto).
- Workers nunca fazem commit nem push; o lead integra.

## Definição de pronto
- [ ] comandos de test, lint, typecheck e build acima passam
- [ ] evidência de verificação mostrada (saída de comando ou execução manual), não presumida
- [ ] docs / roadmap / changelog atualizados quando o comportamento mudou
- [ ] spec/plano/tarefas batem com o que foi construído (se usou SDD)

## Git
- Branches: `<tipo>/<slug-curto>` (ex.: `feat/login`, `fix/usuario-nulo`).
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Nunca commitar nem dar push sem o usuário pedir. Nunca force-push nem reescrever histórico compartilhado.

## Gotchas
<!-- Coisas que já te morderam. Uma linha cada; comece vazio. -->
-
