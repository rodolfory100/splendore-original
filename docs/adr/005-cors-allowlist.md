# ADR-005: CORS por allowlist exata (sem substring)

**Status:** Aceito
**Data:** 2026-06-17
**Contexto:** Auditoria CTO pós-Fase 0 — achado AL-2 (CORS permissivo)

## Problema

A configuração de CORS validava a origem com `origin.includes("splendore")`.
Substring matching aceita qualquer domínio que CONTENHA a string, abrindo
vetores cross-origin:
- `evil-splendore.com` (contém "splendore") → era aceito
- `splendore.evil.com` (contém "splendore") → era aceito
- `meusplendorefake.net` (contém "splendore") → era aceito

Um atacante registra um domínio com "splendore" no nome e o navegador da vítima
passa a aceitar respostas cross-origin da API.

## Decisão

**Validar Origin por igualdade exata contra uma allowlist explícita.**
Sem `includes`/`startsWith`/`endsWith` de domínio. Qualquer origem fora da
lista é rejeitada (retorna `null`, sem header `Access-Control-Allow-Origin`).

## Comportamento para Origin ausente

Quando NÃO há header `Origin` (`!origin`), a requisição é permitida. Decisão
intencional: navegadores SEMPRE enviam `Origin` em requisições cross-origin;
a ausência indica same-origin, curl, ou chamada server-to-server — nenhum dos
quais é vetor de ataque cross-site. O `Origin: null` literal (sandbox, alguns
redirects) NÃO está na allowlist e é bloqueado.

## Consequências

- ✅ Os 3 vetores de substring fechados (provado nos testes).
- ✅ `Origin: null` bloqueado.
- ✅ Preflight OPTIONS responde 204.
- ⚠️ Novo domínio (ex: domínio customizado da escola, homologação) exige
  adicionar a entrada na allowlist e fazer deploy. Trade-off aceito em favor
  da segurança.

## Evidências

Bateria de 7 cenários + 2 extras, todos passaram:
| Origin | Resultado |
|--------|-----------|
| hathor.rodolfory100.workers.dev | permitido ✅ |
| localhost:5173 / :4173 | permitido ✅ |
| evil-splendore.com | bloqueado ✅ |
| splendore.evil.com | bloqueado ✅ |
| meusplendorefake.net | bloqueado ✅ |
| http:// (não https) prod | bloqueado ✅ |
| Origin: null | bloqueado ✅ |
| Origin ausente | permitido por design ✅ |
| Preflight OPTIONS | HTTP 204 ✅ |

## Rollback

`git revert` do commit do AL-2. A versão anterior (substring) volta, mas NÃO é
recomendada por reabrir os vetores. Para adicionar origem legítima, editar
CORS_ALLOWLIST em vez de reverter.
