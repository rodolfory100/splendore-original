# ADR-002: Backup nunca exporta credenciais

**Status:** Aceito
**Data:** 2026-06-17
**Contexto:** Fase 0 / A7 (LGPD) — pré-requisito de segurança

## Problema

A auditoria LGPD (A7) revelou que o backup lógico (C5) capturava a tabela
`config` integralmente, incluindo credenciais em texto:

- `senha` — senha do admin em TEXTO PLANO (ex: era recuperável do JSON)
- `efi_client_secret` — segredo da integração de pagamento Efí
- `efi_client_id` — identificador de cliente Efí

Backup de dados é cópia que circula (download, disco, eventualmente nuvem).
Credencial em backup = superfície de vazamento fora do ambiente controlado.

## Decisão

Implementar **allowlist negativa explícita** por tabela no `scripts/backup.py`:

```python
CAMPOS_PROIBIDOS = {
    "config": ["senha", "efi_client_secret", "efi_client_id"],
}
```

A função `sanitizar()` remove esses campos de cada registro ANTES de gravar
o JSON. Qualquer credencial futura é adicionada a esta lista.

## Justificativa

1. **Restore não precisa de credenciais.** Senha pode ser redefinida via UI;
   secrets do Efí reconfigurados no painel. O backup serve para recuperar
   DADOS (alunas, pagamentos), não segredos.
2. **Defesa em profundidade.** Soma-se ao `.gitignore` (que impede backup no
   git) e à leitura da chave via env var (ADR implícito do C5).
3. **Allowlist negativa explícita** é auditável: fica claro no código quais
   campos são proibidos, e a remoção é registrada no output do backup.

## Consequências

- ✅ config.json não contém mais senha nem secrets (provado por evidência).
- ✅ Restore operacional preservado (campos id/escola/email/etc mantidos).
- ⚠️ Restore de credenciais NÃO é automático — precisa redefinir senha e
  reconfigurar Efí manualmente. Isto é intencional e documentado.
- 📋 Ao adicionar nova credencial em qualquer tabela, incluí-la em
  CAMPOS_PROIBIDOS. (Checklist de revisão de schema.)

## Pendência relacionada

A senha do admin estava em TEXTO PLANO na tabela config (não hash). Isto é um
achado separado a ser corrigido: senhas devem ser sempre hash PBKDF2 (como já
é feito no cadastro SaaS). Registrado para correção futura.
