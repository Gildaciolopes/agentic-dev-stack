# 09. Manutenção e atualização

## O que se mantém sozinho

| Item | Como |
|---|---|
| Combo de modelos grátis | curador 3x/dia |
| Cota (leituras do alethe) | coletor diário faz `usage --refresh-*` |
| Aviso de update de tudo | seção "Updates" do resumo diário (não atualiza nada sozinho) |
| Aviso de release relevante | seção "Radar de IA" |
| Serviços (9Router, Hermes) | launchd com KeepAlive em caso de crash |

## O que é manual (de propósito)

| Item | Comando | Cuidado |
|---|---|---|
| CLIs do brew | `brew upgrade opencode rtk claude-squad tmux yt-dlp uv` e `brew upgrade --cask antigravity-cli` | o RTK pode mudar de versão maior: teste o hook (`echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' \| rtk hook claude`) |
| Claude Code | `claude update` (ou brew) | |
| 9Router | `npm update -g 9router` e reinicie | o curador continua funcionando; confira o combo |
| Headroom | `uv tool upgrade headroom-ai` | |
| Hermes | `hermes update` | leia o changelog: mudanças no gateway podem exigir `hermes gateway install` de novo |
| alethe | auditar → mudar `ALETHE_COMMIT` → `./install.sh --workers` | ver [03-alethe.md](03-alethe.md#atualizar-o-alethe-com-segurança) |

## Levar para outro PC

```bash
git clone <este-repo> ~/agentic-dev-stack && cd ~/agentic-dev-stack
cp <backup>/stack.env config/stack.env        # ou recrie a partir do example
./install.sh --all
for p in ~/projects/*/; do ./scripts/add-project.py "$p"; done
```
Depois refaça os logins (agy, Codex), a chave da NVIDIA e o combo no 9Router, o token do bot (ou reaproveite o mesmo), e copie `~/.hermes/workspace/projetos.md` e `~/.hermes/memories/` se quiser manter a memória.

## Passar para outra pessoa

Ela clona o repo e segue [02-instalacao.md](02-instalacao.md). Nada aqui é pessoal: caminhos via `$HOME`, projetos descobertos em `PROJECTS_DIR`, IDs e tokens perguntados na instalação.

## Medir se está valendo a pena

Depois de 1–2 semanas de uso:
```bash
rtk gain --daily                                           # economia do RTK
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py report   # da última orquestração
```
Olhe também o **Usage** do 9Router (o que foi para o grátis) e as cotas no resumo diário.
- Claude no limite com frequência: perfil `savings` ou mais trabalho para o agy/Codex.
- Sobra cota: `aggressive` para mais qualidade.
- Muito retrabalho do worker grátis: tire o `cascade` dele (edite `try-cheap`).
