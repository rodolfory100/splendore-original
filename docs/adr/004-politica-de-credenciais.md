# ADR-004: Política de Credenciais — somente PBKDF2

**Status:** Aceito
**Data:** 2026-06-17
**Contexto:** Auditoria CTO pós-Fase 0 — achado CR-1 (senha em texto plano)

## Problema

A auditoria identificou que a senha do admin do Ballet (registro legado
`config 'main'`) estava armazenada em TEXTO PLANO no banco, não em hash.
Causas:
1. A função `verificarSenha` tinha um fallback que comparava texto plano
   (`return senha === armazenado`) quando o valor não tinha prefixo `pbkdf2$`.
2. Os endpoints `/config` (PUT e POST) gravavam `...body` direto, permitindo
   que uma senha em texto plano fosse (re)gravada sem hash.

Senha em texto plano é comprometimento direto: legível por quem acessa o banco,
vaza em dumps/backups, viola LGPD art. 46 e boas práticas básicas.

## Decisão

**Toda senha no Hathor é armazenada exclusivamente como hash PBKDF2-SHA256
(100.000 iterações, salt aleatório de 16 bytes, formato `pbkdf2$salt$hash`).**

Três mudanças aplicadas:
1. **Migração do registro legado:** a senha do Ballet foi convertida para hash
   PBKDF2 (gerada com a mesma lógica de `hashSenha`), via UPDATE pontual.
2. **Blindagem dos endpoints `/config`:** `sanitizarConfigBody()` aplica hash
   se vier senha; remove o campo se vazio/ausente (não sobrescreve a existente).
3. **Remoção do fallback de texto plano:** `verificarSenha` agora retorna
   `false` para qualquer valor sem prefixo `pbkdf2$`. Nunca mais compara texto
   plano.

## Justificativa

A infraestrutura PBKDF2 já existia e estava correta (funções `hashSenha`/
`verificarSenha`, cadastro SaaS). O problema era pontual: 1 registro legado +
2 portas de re-contaminação. A correção fecha as três frentes de uma vez.

## Consequências

- ✅ Zero senhas em texto plano no banco (provado: 0 registros legados).
- ✅ Login funciona apenas com PBKDF2 (provado: login Ballet HTTP 200 após a
  remoção do fallback; validação offline confirmando que a senha bate).
- ✅ `/config` nunca mais grava senha sem hash.
- ⚠️ Qualquer senha que por algum motivo seja gravada fora do padrão PBKDF2
  resultará em falha de login (comportamento seguro, intencional).
- 📋 Novas escolas (cadastro SaaS) já nasciam com hash — sem impacto.

## Evidências

- Migração: registro `main` passou de texto plano (len=14) para `pbkdf2$...`
  (len=73).
- Blindagem: senha enviada via `/config` gravada como `pbkdf2$...`.
- Regressão: login do Ballet com a senha correta retorna HTTP 200.
- Restrições respeitadas: senha nunca impressa, hash nunca exposto por inteiro,
  credencial nunca commitada, backup feito antes da alteração.

## Rollback

Reversível via restauração do valor anterior (conhecido) no registro `config`.
Backup pré-migração disponível em backups/20260617_233148.
