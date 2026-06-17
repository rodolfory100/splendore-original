# Registro de Operações de Tratamento (ROPA simplificado)

**RASCUNHO — requer revisão jurídica** · Conforme LGPD art. 37.

## Atividade 1: Gestão de matrículas
- **Finalidade:** administrar alunas, turmas, frequência.
- **Titulares:** menores (alunas) e responsáveis legais.
- **Dados:** nome, nascimento, contato, CPF do responsável.
- **Base legal:**
  - Consentimento do responsável legal (LGPD art. 14) para tratamento de
    dados de menor;
  - Execução do contrato educacional firmado entre a escola e o responsável.
- **Retenção:** enquanto matriculada + prazo legal.
- **Compartilhamento:** operador de hospedagem (Supabase/Cloudflare).

## Atividade 2: Cobrança e pagamentos
- **Finalidade:** emitir e controlar mensalidades.
- **Titulares:** responsáveis legais.
- **Dados:** valores, datas, forma de pagamento.
- **Base legal:** execução de contrato + obrigação legal (fiscal).
- **Retenção:** mínimo de 5 anos (fiscal).
- **Compartilhamento:** processador de pagamento (Efí), quando ativo.

## Atividade 3: Comunicação com responsáveis
- **Finalidade:** avisos, lembretes de pagamento e de aulas.
- **Dados:** nome, telefone/WhatsApp, e-mail.
- **Base legal:** legítimo interesse / execução de contrato.

## Medidas de segurança aplicadas
Autenticação por escola, isolamento multi-tenant, hash de senhas (PBKDF2),
rate limiting, validação de entrada, backup sem credenciais, log de operações
sensíveis (incl. anonimizações LGPD).

## Encarregado (DPO)
[NOME], [E-MAIL]. Responsável pelo atendimento aos titulares.
