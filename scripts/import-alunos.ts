#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

// === Configuration ===
const CSV_PATH = path.join(process.cwd(), 'alunos.csv');
const DB_PATH = path.join(process.cwd(), '.wrangler/state/v3/d1/DB.sqlite3');

// === Simple CSV Parser (for pipe-delimited data) ===
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = lines[0].split('|').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse rows
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('|');
    const record: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      let value = values[j] || '';
      // Remove quotes if present
      value = value.trim().replace(/^"|"$/g, '');
      record[headers[j]] = value;
    }
    
    records.push(record);
  }
  
  return records;
}

// === Helper Functions ===

function mapModalidade(nomeAntigo: string): string {
  if (!nomeAntigo || !nomeAntigo.trim()) return 'Ballet';
  
  const map: Record<string, string> = {
    'PLANO GRAND JETE': 'Ballet',
    'PERSONAL': 'Ballet',
    'MUSCULAÇÃO': 'Jazz',
    'YOGA': 'Danças Urbanas',
    'PILATES': 'Ballet',
  };
  
  const upper = nomeAntigo.toUpperCase().trim();
  return map[upper] || 'Ballet';
}

function extrairDia(dataStr: string): number {
  if (!dataStr || !dataStr.trim()) return 10;
  try {
    const partes = dataStr.trim().split('/');
    const dia = parseInt(partes[0]);
    return isNaN(dia) || dia < 1 || dia > 31 ? 10 : dia;
  } catch (e) {
    return 10;
  }
}

function formatarData(dataStr: string): string | null {
  if (!dataStr || !dataStr.trim()) return null;
  
  try {
    let dateOnly = dataStr.trim().split(' ')[0];
    const [mes, dia, ano] = dateOnly.split('/');
    
    const m = parseInt(mes);
    const d = parseInt(dia);
    const y = parseInt(ano);
    
    if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
    
    const fullYear = y < 100 ? 2000 + y : y;
    
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    
    return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } catch (e) {
    return null;
  }
}

function normalizarWhatsapp(telefone: string): string {
  if (!telefone || !telefone.trim()) return '';
  
  let digits = telefone.trim().replace(/\D/g, '');
  
  if (digits.length < 10) return '';
  if (digits.length > 11) digits = digits.slice(-11);
  
  return digits;
}

function normalizarCPF(cpf: string): string {
  if (!cpf || !cpf.trim()) return '';
  
  let digits = cpf.trim().replace(/\D/g, '');
  
  if (digits.length === 11) return digits;
  if (digits.length < 11) return digits;
  
  return digits.slice(-11);
}

// === Main Import ===

async function importAlunos() {
  console.log('🔄 Iniciando importação de alunos...\n');
  
  // 1. Read CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV não encontrado: ${CSV_PATH}`);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parseCSV(csvContent);
  
  console.log(`📋 Total de registros no CSV: ${records.length}\n`);
  
  // 2. Connect to DB
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Banco de dados não encontrado: ${DB_PATH}`);
    process.exit(1);
  }
  
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // 3. Prepare INSERT statement
  const insertStmt = db.prepare(`
    INSERT INTO alunas (
      id, nome, responsavel, whatsapp, email, cpfResponsavel, cpfResponsavel2,
      modalidade, nivel, valor, vencimento, nascimento, turmaId, observacao,
      autorizaImagem, ativo, bolsista, bolsaDesconto, valorOriginal,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // 4. Process records
  let imported = 0;
  let skipped = 0;
  const errors: any[] = [];
  
  const now = new Date().toISOString();
  const importDate = new Date().toLocaleDateString('pt-BR');
  
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const nome = row.Nome?.trim();
    
    if (!nome) {
      skipped++;
      continue;
    }
    
    try {
      const id = nanoid();
      const responsavel = row.RespAluno?.trim() || '';
      const whatsapp = normalizarWhatsapp(row.Celular || row.Telefone || '');
      const email = row.Mail?.trim() || '';
      const cpfResponsavel = normalizarCPF(row.CPF || '');
      const cpfResponsavel2 = normalizarCPF(row.CPFRespContrato || '');
      const modalidade = mapModalidade(row.NomePlano);
      const nivel = '';
      const valor = parseFloat(row.ValorPlano) || 160;
      const vencimento = extrairDia(row.VctoPlano || '');
      const nascimento = formatarData(row.DataNasc);
      const turmaId = '';
      const observacao = row.Obs?.trim() || `Importado do sistema antigo em ${importDate}`;
      const autorizaImagem = 1;
      const ativo = row.Ativo === '1' || row.Ativo === 1 ? 1 : 0;
      const bolsista = 0;
      const bolsaDesconto = 0;
      const valorOriginal = null;
      
      insertStmt.run(
        id, nome, responsavel, whatsapp, email, cpfResponsavel, cpfResponsavel2,
        modalidade, nivel, valor, vencimento, nascimento, turmaId, observacao,
        autorizaImagem, ativo, bolsista, bolsaDesconto, valorOriginal,
        now, now
      );
      
      imported++;
      
      if ((i + 1) % 20 === 0) {
        console.log(`  ✓ ${i + 1}/${records.length} registros processados...`);
      }
    } catch (err: any) {
      skipped++;
      errors.push({
        linha: i + 2,
        nome: nome,
        erro: err.message,
      });
    }
  }
  
  // 5. Summary
  console.log(`\n✅ Importação concluída!\n`);
  console.log(`📊 Estatísticas:`);
  console.log(`   ✓ Importadas: ${imported}`);
  console.log(`   ⊗ Puladas: ${skipped}`);
  console.log(`   Total: ${imported + skipped}\n`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log(`⚠️  Erros encontrados (primeiros 10):`);
    errors.slice(0, 10).forEach(err => {
      console.log(`   Linha ${err.linha}: ${err.nome} - ${err.erro}`);
    });
    console.log();
  }
  
  // 6. Verify
  const result = db.prepare('SELECT COUNT(*) as count FROM alunas').get() as any;
  console.log(`📈 Total de alunas no banco após importação: ${result.count}\n`);
  
  db.close();
  console.log('✨ Processo finalizado com sucesso!');
}

importAlunos().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
