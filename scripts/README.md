# Scripts de Backup & Restore — Hathor (C5)

## backup.py
Backup lógico completo de todas as tabelas para JSON, com PAGINAÇÃO
(captura >1000 linhas — o default da API REST do Supabase trunca em 1000).
Saída: `backups/<timestamp>/<tabela>.json` + `_manifesto.json`.

Uso: `python3 scripts/backup.py`

## teste_restore.py
Prova o ciclo backup→restore: insere, deleta (simula perda), restaura do
backup, verifica recuperação e limpa. NÃO toca em dados reais de produção.

Uso: `python3 scripts/teste_restore.py`

## Procedimento recomendado
- Rodar backup.py antes de migrações de schema ou deploys de risco.
- Backup também via painel Supabase (Database > Backups) para PITR no plano Pro.
- Testar restore periodicamente (trimestral) — backup não testado não vale nada.

## ATENÇÃO
- O backup via API REST captura DADOS, não SCHEMA. Para restore total
  (estrutura + dados), usar pg_dump ou o backup nativo do Supabase.
- Lição aprendida: a paginação de 1000 linhas escondia 1330 pagamentos
  no primeiro backup. SEMPRE verificar o manifesto contra contagens reais.
