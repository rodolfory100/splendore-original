#!/usr/bin/env node
/**
 * Script para gerar mensalidades para todas as alunas importadas
 * 
 * Uso: node scripts/gen-mensalidades.js
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/2cdae3b2c66a39666a6027d8a1bae19226e6e6cae3722b83ed2dc6971bba5d07.sqlite');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function gerarMensalidades() {
  console.log('\n💳 Gerando mensalidades para alunas importadas...\n');
  
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Banco de dados não encontrado.');
    process.exit(1);
  }
  
  const db = new Database(DB_PATH);
  
  try {
    // Buscar todas as alunas ativas
    const alunas = db.prepare('SELECT id, nome, valor, vencimento FROM alunas WHERE ativo = 1').all();
    
    console.log(`📊 Alunas ativas encontradas: ${alunas.length}\n`);
    
    if (alunas.length === 0) {
      console.warn('⚠️  Nenhuma aluna ativa para gerar mensalidades.');
      process.exit(0);
    }
    
    // Gerar 12 meses de mensalidades (mai/2025 até abr/2026)
    const meses = [];
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth(); // 0-11
    
    // Começar do mês atual
    for (let i = 0; i < 12; i++) {
      let mes = mesAtual + i;
      let ano = anoAtual;
      
      if (mes >= 12) {
        mes -= 12;
        ano += 1;
      }
      
      const mesStr = String(mes + 1).padStart(2, '0');
      meses.push(`${ano}-${mesStr}`);
    }
    
    console.log(`📅 Meses a gerar: ${meses.join(', ')}\n`);
    
    const stmtInsert = db.prepare(`
      INSERT INTO pagamentos (
        id, aluna_id, mes, data, data_vencimento, valor, status, forma, observacao, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const stmtCheck = db.prepare(`
      SELECT COUNT(*) as count FROM pagamentos WHERE aluna_id = ? AND mes = ?
    `);
    
    let totalInseridos = 0;
    let totalPulados = 0;
    
    for (const aluna of alunas) {
      for (const mes of meses) {
        // Verificar se já existe
        const existe = stmtCheck.get(aluna.id, mes);
        if (existe && existe.count > 0) {
          totalPulados++;
          continue;
        }
        
        const [anoStr, mesStr] = mes.split('-');
        const ano = parseInt(anoStr);
        const mesNum = parseInt(mesStr);
        
        // Data de vencimento: dia especificado no vencimento da aluna
        const dia = Math.min(aluna.vencimento, 28); // Evitar 29, 30, 31 para meses com menos dias
        const dataVenc = new Date(ano, mesNum - 1, dia);
        const dataVencStr = dataVenc.toISOString().split('T')[0];
        
        try {
          stmtInsert.run(
            genId(),
            aluna.id,
            mes,
            new Date().toISOString(),
            dataVencStr,
            aluna.valor,
            'pendente',
            'Pix',
            `Mensalidade de ${mes}`,
            new Date().toISOString()
          );
          totalInseridos++;
        } catch (e) {
          console.error(`  ⚠️  Erro ao inserir mensalidade para ${aluna.nome} (${mes}): ${e.message}`);
        }
      }
    }
    
    console.log(`✅ Geração de mensalidades concluída!`);
    console.log(`   ✓ ${totalInseridos} novos registros inseridos`);
    console.log(`   ⊘ ${totalPulados} registros já existentes\n`);
    
    db.close();
  } catch (e) {
    console.error(`\n❌ Erro: ${e.message}`);
    db.close();
    process.exit(1);
  }
}

gerarMensalidades();
