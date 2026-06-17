# Política de Retenção de Dados — Hathor

**RASCUNHO — requer revisão jurídica**

## Princípio
Dados pessoais são mantidos apenas pelo tempo necessário às finalidades que
justificaram sua coleta, ou pelo prazo exigido por lei.

## Tabela de retenção

| Categoria | Dado | Prazo | Base legal |
|-----------|------|-------|-----------|
| Cadastral da aluna | nome, nascimento, contato | Enquanto matriculada + período legal | Execução de contrato |
| Responsável | nome, CPF, contato | Idem cadastral | Execução de contrato |
| Financeiro | valores, datas, pagamentos | **Mínimo de 5 anos**, podendo ser superior* | Obrigação fiscal/contábil |
| Observações | texto livre | Anonimizado no esquecimento | Consentimento |
| Logs de segurança | eventos, IP | 12 meses (sugerido) | Legítimo interesse / segurança |
| Consentimento | termo assinado | Enquanto durar o tratamento + prova | Cumprimento LGPD |

\* **Retenção financeira:** mínimo de 5 anos, podendo ser mantida por prazo
superior quando necessária para cumprimento de obrigação legal, regulatória ou
defesa em processos administrativos e judiciais.

## Procedimento de descarte / anonimização
- Pedido de esquecimento → anonimização via endpoint LGPD (não deleção).
- Dados pessoais descaracterizados; registros financeiros retidos e
  desvinculados da identidade.
- Backups: rotação periódica; dados anonimizados não são re-hidratados.

## Backups
- Backups lógicos NÃO contêm credenciais (ver ADR-002).
- Backups com dados pessoais são protegidos e não versionados em repositório.
- Recomendação: criptografar backups em repouso e limitar acesso.
