# 08. Troubleshooting: tudo que quebrou e como resolver

Cada item abaixo aconteceu de verdade durante a montagem do stack.

## Agentes e orquestração

**O Claude ignorou o alethe e lançou 26 subagentes, 18 em Opus.**
Regra no CLAUDE.md não é enforcement: os tipos genéricos herdam o modelo da sessão. → O `agent-model-guard` nega e `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` vira o padrão. Teste: peça um subagente Explore, e ele deve ser negado.

**`CLAUDE_CODE_SUBAGENT_MODEL` não afetou o Explore.**
Os agentes built-in Explore/Plan só respeitam esse env com `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, que por sua vez ignora o frontmatter dos seus agentes. → Mantenha sem `_FORCE` e deixe o hook cuidar.

**alethe: `no runs found`, cota `unknown`, `mode` inválido, scaffold rejeitando playbook, `cwd outside the lead checkout`, agy pedindo aprovação.**
Tudo explicado na tabela de pegadinhas de [03-alethe.md](03-alethe.md#pegadinhas-todas-vistas-em-uso-real).

**Worker agy termina com `permission_denied: RunCommand`.**
O modo leitura do agy não roda shell, e o modelo tentou `ls`/`cat`. → O brief precisa dizer "use só ferramentas de leitura de arquivo, nunca shell".

**agy: `--model gemini-x-flash-high conflicts with --effort=medium`.**
O runner herda o effort do tier. Gemini usa o id base (`gemini-x-flash`) + `--effort`; modelos Claude do agy **não aceitam** `--effort`. → O `configure-alethe.py` já escreve os tiers certos.

## Modelos grátis / 9Router

**`410 Gone: model has reached its end of life`** e **o fallback não pulou para o próximo.**
O 9Router só faz fallback em limite e erro de servidor. → O curador remove os mortos 3x/dia.

**`404 Function ... Not found for account`.**
O modelo aparece em `/v1/models`, mas a sua conta não tem acesso. → O curador testa de verdade, não confia na lista.

**OpenCode Free: `Cannot find module 'wreq-js'`.**
O 9Router subiu antes de a dependência de runtime ser instalada (o npm bloqueou o `postinstall`) e guardou a falha em cache. → Reinicie o 9Router.

**A interface do 9Router não deixa adicionar modelo por ID.**
→ O curador grava direto na tabela `combos` (com backup). À mão:
```bash
sqlite3 ~/.9router/db/data.sqlite "UPDATE combos SET models='[\"nvidia/<id1>\",\"nvidia/<id2>\"]' WHERE name='free';"
```

**O autostart do 9Router não sobe (launchd `last exit code = 78: EX_CONFIG`).**
O plist aponta para um Node que não existe mais (outra versão/caminho). → `./install.sh --free-models` regrava com o `node` atual. Cuidado ao editar à mão: `plutil -replace ProgramArguments.0` **insere** em vez de substituir; reescreva o array inteiro.

## Sandbox / OpenCode

**Mesmo com `opencode-safe`, um `grep -r` leu o `.env`.**
Faltava `--standalone`: o `opencode run` delega as ferramentas ao serviço de fundo `opencode serve --service`, que roda fora do sandbox. → O wrapper do repo já passa `--standalone`.

**A permissão `external_directory: deny` não bloqueou caminho absoluto no shell.**
Ela vale para as ferramentas de arquivo, não para comandos de bash. → É o kernel que segura (`sandbox-exec`).

## Hermes

**Gemini CLI: "This client is no longer supported for Gemini Code Assist for individuals".**
O login pessoal foi descontinuado. → Use o agy, ou uma chave do AI Studio.

**Gateway rodando, mas "service is not active" e "No messaging platforms enabled".**
Um `hermes -z` iniciou um gateway avulso **antes** de existir o token; ele segura a vaga e o launchd não sobe. → `hermes gateway restart`.

**Discord: "Hermes could not create a Discord thread... Too many requests".**
Ele cria uma thread por mensagem e leva rate limit. → `hermes config set discord.auto_thread false` e reinicie. Rode o `/sethome` **de novo, fora de thread** (senão o home vira a thread).

**macOS pedindo permissão de Música, Fotos, iCloud.**
Vem das skills Apple que vêm junto e de buscas amplas. → Clique **Não permitir** (a resposta fica salva) e desative as skills que não usa. Evite dar Acesso Total ao Disco (ver [06-hermes.md](06-hermes.md)).

**O plano do dia sugere projeto parado, ou interpreta errado.**
→ Crie `~/.hermes/workspace/projetos.md` com o status de cada projeto; o prompt lê esse arquivo.

## Coleta de dados

**Transcrição do YouTube: `HTTP Error 429: Too Many Requests`.**
→ `--sleep-requests 3 --sleep-subtitles 5` e peça só `pt-orig`/`en-orig`:
```bash
yt-dlp --write-auto-subs --sub-langs "pt-orig,pt" --sub-format vtt --skip-download --sleep-requests 3 --sleep-subtitles 5 -o "%(id)s.%(ext)s" <url>
```

**Python 3.15 (ou muito novo) quebra a instalação de ferramentas Python.**
→ Instale isolado com `uv tool install --python 3.12 <pacote>`.

## Diagnóstico rápido

```bash
launchctl list | grep agentic-dev-stack                              # agendamentos
tail -n 50 ~/.local/share/agentic-dev-stack/logs/*.err               # erros dos scripts
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py doctor
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:20128/v1/models   # 9Router
~/.local/bin/hermes gateway status; tail -n 30 ~/.hermes/logs/gateway.log
```
