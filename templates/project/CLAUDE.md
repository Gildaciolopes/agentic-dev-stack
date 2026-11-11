<!-- Starter CLAUDE.md. Fill the <PLACEHOLDERS>, delete sections you don't need, delete these comments.
     Keep it under ~150 lines: write only what the model cannot infer from the code. -->
# <PROJECT NAME>

<!-- 1-3 lines: what it is and who it is for. -->
<One-line description>. Used by <audience>.

## Stack
<!-- Only non-obvious choices and versions. Delete what the manifest already says. -->
- Language/runtime: <e.g. TypeScript 5 / Node 22>
- Framework: <...>
- Data/infra: <...>

## Repo map
<!-- Where things live. Prefer 5-10 lines; graphify covers the rest. -->
- `<src/...>`: <purpose>
- `<tests/...>`: <purpose>
- `<docs/...>`: specs, roadmap, ADRs

## Commands
```bash
<dev command>        # run locally
<test command>       # all tests
<lint command>
<typecheck command>
<build command>
```

## Non-negotiable rules
<!-- Short, testable, project-specific. Examples below: replace. -->
- Never read, print or commit secrets (`.env*`, keys, credentials JSON).
- <e.g. all DB access goes through `src/db/`; no raw SQL elsewhere>
- <e.g. no new dependency without asking>
- Never claim "done" without running the checks below.

## Workflow: Spec-Driven Development (GitHub Spec Kit)
<!-- Delete this section if you do not use Spec Kit (https://github.com/github/spec-kit). -->
For any non-trivial feature, in order:
1. `/speckit.specify <what and why>`: write the spec (user-facing behavior, no tech choices).
2. `/speckit.clarify`: resolve ambiguities before planning.
3. `/speckit.plan <tech choices>`: technical plan.
4. `/speckit.tasks`: ordered, parallelizable tasks.
5. `/speckit.analyze`: cross-check spec, plan and tasks for gaps.
6. `/speckit.implement`: execute the tasks.

> Command names vary by Spec Kit version/agent integration: `/speckit.specify` (current) or `/speckit-specify` (skills-based installs). Use whichever your project exposes.

Who does what: the lead (main session, strongest model) owns specify, clarify, plan, tasks and analyze, and every decision. Builders only run implement-level units that are already planned. Open questions go to the user, never guessed.
Small fixes (≤ 3 files, clear intent) skip the cycle.

## Token economy
- **graphify first**: with `graphify-out/` present, query the code graph before grep or broad reads: `graphify query "<question>" --budget 1500`.
- **RTK** compresses shell output automatically. Need raw output? `rtk proxy <cmd>`. Check savings: `rtk gain`.
- **caveman**: terse style applies to replies to the user only. Code, commits, specs and worker briefs stay in normal prose.
- Read files with offset/limit; do not re-read a file you just edited (the edit would have failed).
- `/compact` to continue the same task with less context; new chat when the task changes.

## Delegation
- `scout` (cheap, read-only): sweeping many files, "where does X live", summaries.
- `builder`: a planned unit with exact files, acceptance criteria and test command. Parallel builders use `isolation: "worktree"`.
- `reviewer`: independent diff check; give it the diff and the task, not your conclusion.
- Do it yourself: small, coupled or ambiguous work.
- Multi-unit or multi-provider work: use alethe orchestration. `npx agentic-dev-stack add-project .` appends the full alethe block to this file automatically (existing content untouched).
- Workers never commit or push; the lead integrates.

## Definition of done
- [ ] test, lint, typecheck and build commands above pass
- [ ] verification evidence shown (command output or a manual run), not assumed
- [ ] docs / roadmap / changelog updated when behavior changed
- [ ] spec/plan/tasks match what was built (if SDD was used)

## Git
- Branches: `<type>/<short-slug>` (e.g. `feat/login`, `fix/null-user`).
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Never commit or push unless the user asks. Never force-push or rewrite shared history.

## Gotchas
<!-- Things that bit you before. Add one line each; start empty. -->
-
