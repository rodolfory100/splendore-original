# Inventário de Dados Pessoais — Hathor

**RASCUNHO — requer revisão jurídica**
Fonte: auditoria técnica (RIPD) realizada sobre o schema real do banco.
Apenas 4 tabelas contêm dados pessoais; as demais estão vazias ou são técnicas.

## Tabela: alunas (titular é MENOR — criticidade alta)

| Campo | Classificação | Base legal | Retenção | Ação na anonimização |
|-------|---------------|-----------|----------|----------------------|
| nome | Pessoal (menor) | Consentimento art.14 | Enquanto matriculada | "[ANONIMIZADO]" |
| nascimento | Pessoal (menor) | Consentimento art.14 | Enquanto matriculada | null |
| responsavel | Pessoal (adulto) | Contrato | Enquanto matriculada | "[ANONIMIZADO]" |
| cpf_responsavel | Identificador | Contrato | Enquanto matriculada | null |
| cpf_responsavel2 | Identificador | Contrato | Enquanto matriculada | null |
| email | Contato | Contrato | Enquanto matriculada | null |
| whatsapp | Contato | Contrato | Enquanto matriculada | null |
| observacao | Texto livre (sensível) | Consentimento | Enquanto matriculada | null |
| autoriza_imagem | Consentimento (registro) | Consentimento | Prova de consentimento | Mantido |
| modalidade, nivel, turma_id | Operacional | Contrato | Enquanto matriculada | Mantido |
| valor, valor_cheio, bolsista | Financeiro/operacional | Contrato | Mínimo 5 anos | Mantido |
| datas de contrato, vencimento | Contratual | Contrato | Mínimo 5 anos | Mantido |
| ativo, suspenso | Status | Contrato | Operacional | Mantido |
| id, escola_id | Chave técnica | — | Integridade | Mantido |
| anonimizado_em, motivo_anonimizacao | Auditoria LGPD | Cumprimento legal | Permanente | Preenchido |

## Tabela: pagamentos (retenção fiscal obrigatória)

| Campo | Classificação | Base legal | Retenção | Ação na anonimização |
|-------|---------------|-----------|----------|----------------------|
| aluna_id | Referência | Obrigação legal | Mínimo 5 anos | Mantido (vínculo anônimo) |
| valor, data, mes, forma | Financeiro | Obrigação legal | Mínimo 5 anos | Mantido |
| observacao | Texto livre | Obrigação legal | Mínimo 5 anos | Mantido (revisar caso a caso) |
| id, escola_id, parcela_id | Chave técnica | — | Integridade | Mantido |

## Tabela: escolas (titular é o cliente/adulto)

| Campo | Classificação | Base legal | Retenção | Ação na anonimização |
|-------|---------------|-----------|----------|----------------------|
| nome, email, whatsapp | Pessoal (adulto) | Contrato | Enquanto cliente | N/A (titular é a escola) |
| cidade, estado | Localização | Contrato | Enquanto cliente | N/A |
| id, slug, plano, ativo, datas | Operacional | Contrato | Enquanto cliente | N/A |

## Tabela: config (admin da escola + segredos)

| Campo | Classificação | Base legal | Retenção | Ação na anonimização |
|-------|---------------|-----------|----------|----------------------|
| email, nome_admin | Pessoal (adulto) | Contrato | Enquanto cliente | N/A |
| senha | Credencial (hash) | Segurança | Enquanto cliente | Nunca exportada (ADR-002) |
| efi_client_secret, efi_client_id | Segredo de pagamento | Segurança | Enquanto cliente | Nunca exportada (ADR-002) |

## Tabelas sem dados pessoais
turmas, despesas, parcelas, contratos, conciliacao, webhooks_recebidos,
logs_* — vazias ou contêm apenas dados técnicos/operacionais.
