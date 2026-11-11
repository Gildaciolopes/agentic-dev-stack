# 05. Modelos grátis: 9Router, NVIDIA NIM e o curador

## Por que modelos grátis

Edição mecânica (rename, boilerplate, strings de i18n, scaffolding de teste, docs) não precisa de Sonnet. Com um check automático (typecheck/teste) decidindo se passou, um modelo grátis resolve na maioria das vezes. Quando falha, o playbook `cascade` escala para Sonnet **começando do erro**, não do transcript do modelo barato.

## Peças

| Peça | Papel |
|---|---|
| **NVIDIA NIM** (build.nvidia.com) | Dezenas de modelos abertos grátis via API: Nemotron, Kimi, GLM, DeepSeek, MiniMax, Mistral, Qwen... Limite de 40 req/min por chave. Não exige placa NVIDIA. |
| **9Router** (`npm i -g 9router`) | Roteador local OpenAI-compatível em `:20128`. Junta provedores em **combos**: `fallback` (tenta em ordem), `round robin` (distribui) e `fusion` (todos em paralelo, escolhe a melhor resposta). |
| **Combo `free`** | O nome que OpenCode, Hermes e o curador usam. |
| **Curador** | Script que testa e reescreve o combo 3x/dia. |

## O problema que o curador resolve

Em um único dia de testes reais:
- GLM 5.2 → `410 Gone: reached its end of life`
- DeepSeek V4 Pro → `410 Gone`
- Kimi K2.6 → `404 Function not found for account` (aparece na lista, mas a conta não tem acesso)
- MiMo Auto → `Unsupported model`
- GLM 5.3 Flash, DeepSeek V4.1 Flash → mais de 200s sem resposta
- Modelos "OpenCode Free" → `Model is unavailable` / `ModelProtocolUnsupported`

Pior: o 9Router **não pula para o próximo modelo em erro 410/404**, só em limite e erro de servidor. Um modelo morto no topo do combo derruba todas as chamadas. E a interface do 9Router não deixa adicionar modelo por ID.

## Como o curador decide

`scripts/model-curator/curate.py` (instalado em `~/.local/share/agentic-dev-stack/model-curator/`):

1. Busca `https://integrate.api.nvidia.com/v1/models` (público).
2. Filtra os candidatos: descarta embed, rerank, safety, vision, nano, modelos pequenos; aceita famílias conhecidas e boas (Nemotron Ultra, Kimi K2, GLM 5, DeepSeek V4, Qwen 3.x grande, MiniMax M3, Mistral Large, GPT-OSS 120B, Llama 4).
3. Testa até 14 (dois pedidos cada, respeitando o limite de 40 req/min):
   - `"Reply with exactly: OK"`: responde?
   - um pedido com tool `get_time`: **chama a ferramenta?** (sem isso o OpenCode não funciona)
   - latência máxima ≤ 30s
4. Ordena por família (qualidade) e latência; grava os **4 melhores** no combo direto no SQLite do 9Router (`~/.9router/db/data.sqlite`, tabela `combos`), depois de um backup (guarda os 20 últimos).
5. Se nenhum passar: **não mexe** e registra o alerta.
6. Escreve `status.json` (resultado de cada modelo) e `history.jsonl` (trocas). O Hermes avisa no chat quando muda.

Variáveis de ambiente: `NINEROUTER_API_KEY` (senão lê do `~/.config/opencode/opencode.json`), `CURATOR_COMBO` (padrão `free`), `CURATOR_STATE_DIR`.

```bash
python3 -I ~/.local/share/agentic-dev-stack/model-curator/curate.py     # rodada manual (Windows: py -3 -I ou python -I)
cat ~/.local/share/agentic-dev-stack/model-curator/status.json | python3 -m json.tool | less
```

O agendamento é criado pelo `npx github:Gildaciolopes/agentic-dev-stack install --free-models` (launchd no macOS, crontab no Linux, Agendador de Tarefas no Windows), nos horários de `CURATOR_TIMES` em `~/.config/agentic-dev-stack/stack.env`. Os logs ficam em `~/.local/share/agentic-dev-stack/logs/`.

## Adicionar outros provedores grátis ao combo

O curador só escreve modelos `nvidia/...`. Se quiser fallback de **outro provedor** (para quando a NVIDIA inteira cair):
- **Gemini via chave do AI Studio:** adicione o provider na WebUI do 9Router.
- **OpenRouter free:** idem.

Depois, edite `FAMILIES` e `candidates()` no `curate.py` para incluir esses IDs, ou mantenha um modelo fixo no fim do combo e ajuste `write_combo` para preservá-lo.

## Usar o combo

- **OpenCode:** `opencode run -m 9router/free "..."`. Como worker do alethe, sempre via `opencode-safe`.
- **Hermes:** `model.base_url http://127.0.0.1:20128/v1`, `model.default free`.
- **Qualquer cliente OpenAI:** `base_url=http://127.0.0.1:20128/v1`, `model="free"`, `api_key=<chave local do 9Router>`.

## Token Saver do 9Router

O 9Router tem compressão própria (RTK embutido, compressão de saída, "lazy senior dev"). **Deixe desligado:** você já tem RTK e caveman, e empilhar compressores degrada a qualidade.

## Cuidados

- **Privacidade:** modelos grátis podem usar seus dados. Segredos nunca entram no prompt, e o `opencode-safe` garante isso no kernel. Modelos com "Contributor" no nome deixam explícito que usam os dados.
- **Senha da WebUI:** troque a padrão `123456`. Não ligue o modo remoto/túnel com a chave padrão.
- **Autostart:** o autostart do próprio 9Router grava o caminho absoluto do Node; se você trocar a versão do Node, ele quebra em silêncio (`EX_CONFIG`). O instalador registra o 9Router com o `node` atual: launchd no macOS, `systemd --user` no Linux e `schtasks` (`ONLOGON`) no Windows. Reinstale a fase `--free-models` (`npx github:Gildaciolopes/agentic-dev-stack install --free-models`) depois de trocar o Node.
- **Sandbox do worker grátis:** macOS usa `sandbox-exec`, Linux usa `bubblewrap` (`bin/opencode-safe-linux`). No Windows não há sandbox de kernel e o worker grátis fica desligado por padrão; veja [07-seguranca.md](07-seguranca.md).
