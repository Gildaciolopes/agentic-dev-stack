<!-- BEGIN AGENTIC-DEV-STACK -->
# Orquestração: planejar grande, executar pequeno
- O lead (sessão principal) planeja e integra; delegue leitura pesada ao `scout` (haiku), implementação de tarefas planejadas ao `builder` (sonnet) e checagem de diffs ao `reviewer` (sonnet).
- Tarefas independentes → lance builders em paralelo com `isolation: "worktree"`.
- Tarefa pequena (poucas chamadas de ferramenta, ≤ 3 arquivos) → faça direto; delegar custa mais do que economiza.
- Imposto por código: o hook `~/.claude/hooks/agent-model-guard.mjs` nega chamadas Agent que rodariam em Opus (Explore/general-purpose/Plan sem `model: haiku|sonnet`, fork, opus explícito). Modelo padrão de subagente = sonnet (`CLAUDE_CODE_SUBAGENT_MODEL`). Exceção deliberada: inicie o claude com `ALLOW_OPUS_SUBAGENT=1`.
- Projetos com `.claude/skills/alethe` → siga a seção "Orquestração multi-agente (alethe)" daquele projeto. O alethe (modo passivo) roteia os workers: scouts agy Gemini (brief: só leitura de arquivos, sem shell, sem plano/aprovação), Sonnet/Opus implementam, agy Opus revisa (provedor independente), opencode `9router/free` via `~/.local/bin/opencode-safe` (sandbox) para edições mecânicas em worktrees isolados.
- Segredos (`.env*`, chaves, JSON de credenciais) nunca entram em briefs, planos ou `seedPaths`.
- Config: `~/.config/alethe/`; skill canônica: `~/.agents/skills/alethe` (commit auditado em `.audited-commit`).
<!-- END AGENTIC-DEV-STACK -->
