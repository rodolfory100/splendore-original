#!/usr/bin/env python3

import sqlite3
import csv
import uuid
from datetime import datetime
from pathlib import Path

# Configuration
CSV_PATH = Path('alunos.csv')
# Find the actual database file
db_files = list(Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/').glob('*.sqlite'))
DB_PATH = db_files[0] if db_files else Path('.wrangler/state/v3/d1/DB.sqlite3')

def map_modalidade(nome_antigo: str) -> str:
    if not nome_antigo or not nome_antigo.strip():
        return 'Ballet'
    
    mapping = {
        'PLANO GRAND JETE': 'Ballet',
        'PERSONAL': 'Ballet',
        'MUSCULAÇÃO': 'Jazz',
        'YOGA': 'Danças Urbanas',
        'PILATES': 'Ballet',
    }
    
    upper = nome_antigo.upper().strip()
    return mapping.get(upper, 'Ballet')

def extrair_dia(data_str: str) -> int:
    if not data_str or not data_str.strip():
        return 10
    try:
        partes = data_str.strip().split('/')
        dia = int(partes[0])
        if 1 <= dia <= 31:
            return dia
        return 10
    except:
        return 10

def formatar_data(data_str: str) -> str | None:
    if not data_str or not data_str.strip():
        return None
    
    try:
        date_only = data_str.strip().split(' ')[0]
        mes, dia, ano = date_only.split('/')
        
        m = int(mes)
        d = int(dia)
        y = int(ano)
        
        if not (1 <= m <= 12) or not (1 <= d <= 31):
            return None
        
        # Convert YY to YYYY
        if y < 100:
            y = 2000 + y
        
        return f"{y:04d}-{m:02d}-{d:02d}"
    except Exception as e:
        return None

def normalizar_whatsapp(telefone: str) -> str:
    if not telefone or not telefone.strip():
        return ''
    
    digits = ''.join(c for c in telefone if c.isdigit())
    
    if len(digits) < 10:
        return ''
    if len(digits) > 11:
        digits = digits[-11:]
    
    return digits

def normalizar_cpf(cpf: str) -> str:
    if not cpf or not cpf.strip():
        return ''
    
    digits = ''.join(c for c in cpf if c.isdigit())
    
    if len(digits) <= 11:
        return digits
    
    return digits[-11:]

def import_alunos():
    print('🔄 Iniciando importação de alunos...\n')
    
    # 1. Check files
    if not CSV_PATH.exists():
        print(f'❌ CSV não encontrado: {CSV_PATH}')
        return 1
    
    if not DB_PATH.exists():
        print(f'❌ Banco de dados não encontrado: {DB_PATH}')
        return 1
    
    # 2. Read CSV
    records = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='|')
        records = list(reader)
    
    print(f'📋 Total de registros no CSV: {len(records)}\n')
    
    # 3. Connect to DB
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute('PRAGMA foreign_keys = ON')
    
    # 4. Prepare INSERT
    insert_sql = '''
    INSERT INTO alunas (
        id, nome, responsavel, whatsapp, email, cpf_responsavel, cpf_responsavel2,
        modalidade, nivel, valor, vencimento, nascimento, turma_id, observacao,
        autoriza_imagem, ativo, bolsista, bolsa_desconto, valor_original,
        updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    # 5. Process records
    imported = 0
    skipped = 0
    errors = []
    
    now = datetime.now().isoformat()
    import_date = datetime.now().strftime('%d/%m/%Y')
    
    for i, row in enumerate(records):
        nome = row.get('Nome', '').strip() if row.get('Nome') else ''
        
        if not nome:
            skipped += 1
            continue
        
        try:
            id_val = str(uuid.uuid4())
            responsavel = (row.get('RespAluno', '') or '').strip()
            whatsapp = normalizar_whatsapp(row.get('Celular') or row.get('Telefone') or '')
            email = (row.get('Mail', '') or '').strip()
            cpf_responsavel = normalizar_cpf(row.get('CPF') or '')
            cpf_responsavel2 = normalizar_cpf(row.get('CPFRespContrato') or '')
            modalidade = map_modalidade(row.get('NomePlano', ''))
            nivel = ''
            valor = float(row.get('ValorPlano') or 160)
            vencimento = str(extrair_dia(row.get('VctoPlano', '')))
            nascimento = formatar_data(row.get('DataNasc', ''))
            turma_id = ''
            observacao = (row.get('Obs', '') or '').strip() or f'Importado do sistema antigo em {import_date}'
            autoriza_imagem = 1
            ativo = 1 if (row.get('Ativo') in ('1', 1)) else 0
            bolsista = 0
            bolsa_desconto = 0
            valor_original = None
            
            cursor.execute(insert_sql, (
                id_val, nome, responsavel, whatsapp, email, cpf_responsavel, cpf_responsavel2,
                modalidade, nivel, valor, vencimento, nascimento, turma_id, observacao,
                autoriza_imagem, ativo, bolsista, bolsa_desconto, valor_original,
                now
            ))
            
            imported += 1
            
            if (i + 1) % 20 == 0:
                print(f'  ✓ {i + 1}/{len(records)} registros processados...')
        
        except Exception as e:
            skipped += 1
            errors.append({
                'linha': i + 2,
                'nome': nome,
                'erro': str(e)
            })
    
    # 6. Commit
    conn.commit()
    
    # 7. Summary
    print(f'\n✅ Importação concluída!\n')
    print(f'📊 Estatísticas:')
    print(f'   ✓ Importadas: {imported}')
    print(f'   ⊗ Puladas: {skipped}')
    print(f'   Total: {imported + skipped}\n')
    
    if errors and len(errors) <= 10:
        print(f'⚠️  Erros encontrados (primeiros 10):')
        for err in errors[:10]:
            print(f'   Linha {err["linha"]}: {err["nome"]} - {err["erro"]}')
        print()
    
    # 8. Verify
    cursor.execute('SELECT COUNT(*) as count FROM alunas')
    result = cursor.fetchone()
    total = result['count'] if result else 0
    print(f'📈 Total de alunas no banco após importação: {total}\n')
    
    conn.close()
    print('✨ Processo finalizado com sucesso!')
    
    return 0

if __name__ == '__main__':
    exit(import_alunos())
