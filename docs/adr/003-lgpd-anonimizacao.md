# ADR-003: Direito ao esquecimento via anonimização (LGPD)

**Status:** Aceito
**Data:** 2026-06-17
**Contexto:** Fase 0 / A7 — Hathor trata dados de menores

## Problema

A LGPD (art. 18) garante ao titular o direito à eliminação de dados pessoais.
Hathor trata dados de **menores de idade** (alunas de ballet), que recebem
proteção reforçada (art. 14). Porém, deletar uma aluna:
- Quebraria integridade referencial (pagamentos referenciam aluna_id)
- Violaria a retenção fiscal obrigatória de registros financeiros
  (5 anos — Código Civil art. 206, legislação tributária)

## Decisão

Implementar o direito ao esquecimento como **ANONIMIZAÇÃO**, não deleção.
Endpoint `POST /api/lgpd/anonimizar/:alunaId` (autenticado, isolado por escola).

**Anonimiza** (dados pessoais → null ou "[ANONIMIZADO]"):
nome, responsavel, cpf_responsavel, cpf_responsavel2, email, whatsapp,
nascimento, observacao

**Mantém** (operacional + retenção legal):
id, escola_id, valores, datas, status, autoriza_imagem (prova de consentimento),
e TODOS os registros em `pagamentos` (desvinculados da identidade, pois aluna_id
passa a apontar para registro anônimo)

**Audita:** anonimizado_em (timestamp), motivo_anonimizacao (texto), e log
em logs_seguranca (tipo lgpd_anonimizacao).

## Justificativa (base legal)

LGPD art. 16, I permite a retenção de dados para cumprimento de obrigação
legal — exatamente o caso dos registros financeiros. A anonimização
(art. 12) descaracteriza o dado pessoal, satisfazendo o direito ao
esquecimento, enquanto preserva o histórico financeiro exigido por lei.

## Proteções implementadas

- **Isolamento:** filtro escola_id impede anonimizar aluna de outra escola
- **Idempotência:** se já anonimizada, retorna sem reprocessar
- **Validação:** motivo obrigatório (Zod) para rastreabilidade
- **Auditoria:** registro de quem/quando/por quê

## Consequências

- ✅ Direito ao esquecimento atendido sem violar retenção fiscal
- ✅ Integridade referencial preservada (pagamentos continuam válidos)
- ⚠️ Anonimização é IRREVERSÍVEL — dados pessoais não voltam (intencional)
- ⚠️ O CPF do responsável também é anonimizado (não é dado do menor, mas
  está vinculado ao tratamento do menor)
- 📋 Pendência: UI para o admin acionar a anonimização (hoje só via API)

## Provado por teste E2E (2026-06-17)

Aluna de teste + pagamento → anonimização → PII zerada, pagamento retido,
idempotência confirmada. Ver plano de testes em docs/lgpd/.
