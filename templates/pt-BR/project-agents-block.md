<!-- BEGIN ALETHE ORCHESTRATION -->
## Agentes e orquestração (alethe)
- O lead é a sessão do Claude Code (Opus). Outros CLIs (agy, opencode) normalmente rodam aqui como **workers** do alethe.
- Se `ALETHE_ORCHESTRATE_WORKER=1`, ou se você recebeu um brief de worker:
  - faça só a unidade do brief, só nos paths que ele cita;
  - não delegue nem abra outro agente;
  - não faça commit nem push;
  - rode o check indicado;
  - termine com `STATUS: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT` e `SUMMARY:`.
- As regras do projeto (seções não negociáveis do `CLAUDE.md` e deste arquivo) valem para qualquer agente.
- Com `graphify-out/` presente, consulte `graphify query "<pergunta>" --budget 1500` antes de grep amplo. O RTK reescreve os comandos automaticamente.
- Nunca ler nem expor `.env`/segredos. Operação destrutiva ou em produção só com ok humano.
<!-- END ALETHE ORCHESTRATION -->
