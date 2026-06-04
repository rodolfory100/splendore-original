#!/usr/bin/env node
/**
 * Script de Importação: Access → Splendore (Alunas)
 * 
 * Uso: node scripts/import-alunos.js
 * 
 * Processa alunos.csv e insere 160 registros na tabela alunas (D1 SQLite)
 */

import fs from 'fs';
import readline from 'readline';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const CSV_PATH = join(__dirname, '../alunos.csv');
const DB_PATH = join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/2cdae3b2c66a39666a6027d8a1bae19226e6e6cae3722b83ed2dc6971bba5d07.sqlite');

const MODALIDADE_MAP = {
  'Personal': 'Ballet',
  'Musculação': 'Jazz',
  'Yoga': 'Danças Urbanas',
  'Pilates': 'Ballet',
  'Academia': 'Ballet',
  'GymPass': 'Ballet',
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove todos os caracteres não-numéricos
  const digits = phone.replace(/\D/g, '');
  // Se tiver 11 dígitos, assume Whatsapp (BR)
  if (digits.length >= 11) {
    return digits.slice(-11); // últimos 11 dígitos
  }
  return digits;
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Formato esperado: DD/MM/YYYY ou DD/MM/YY
  const cleaned = dateStr.split(' ')[0].trim(); // Remove timestamp se houver
  const parts = cleaned.split('/');
  
  if (parts.length !== 3) return null;
  
  let [day, month, year] = parts.map(p => parseInt(p, 10));
  
  // Validação básica
  if (!day || !month || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  // Converter ano de 2 dígitos para 4
  if (year < 100) {
    year = year < 25 ? 2000 + year : 1900 + year; // YY < 25 = 20YY, else 19YY
  }
  
  // Formatar como YYYY-MM-DD
  const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Validar data
  const date = new Date(formatted);
  if (isNaN(date.getTime())) return null;
  
  return formatted;
}

function parseVencimento(dateStr) {
  if (!dateStr) return 10;
  
  // Extrair o dia do mês (primeira parte antes da /)
  const parts = dateStr.split('/');
  const day = parseInt(parts[0], 10);
  
  if (isNaN(day) || day < 1 || day > 31) return 10;
  return day;
}

function parseModalidade(nomeAntigo) {
  if (!nomeAntigo) return 'Ballet';
  const mapped = MODALIDADE_MAP[nomeAntigo];
  return mapped || 'Ballet';
}

function normalizeCPF(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '';
  return digits;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── LEITURA DO CSV ──────────────────────────────────────────────────────────
async function importAlunos() {
  console.log('\n📋 Iniciando importação de alunas...');
  console.log(`📁 CSV: ${CSV_PATH}`);
  console.log(`🗄️  DB: ${DB_PATH}\n`);
  
  // Verificar se banco existe
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Banco de dados não encontrado.');
    process.exit(1);
  }
  
  // Abrir conexão
  const db = new Database(DB_PATH);
  
  const alunas = [];
  let headerParsed = false;
  let headerMap = {};
  
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(CSV_PATH),
      crlfDelay: Infinity,
    });
    
    rl.on('line', (line) => {
      if (!headerParsed) {
        // Primeira linha = headers
        const headers = line.split('|');
        headers.forEach((h, idx) => {
          headerMap[h.trim()] = idx;
        });
        headerParsed = true;
        return;
      }
      
      // Parse da linha
      const values = line.split('|').map(v => v.replace(/^"|"$/g, '').trim());
      
      const aluna = {
        id: genId(),
        nome: (values[headerMap['Nome']] || '').trim(),
        responsavel: (values[headerMap['RespAluno']] || '').trim(),
        whatsapp: normalizePhone(values[headerMap['Celular']] || values[headerMap['Telefone']] || ''),
        email: (values[headerMap['Mail']] || '').toLowerCase().trim(),
        cpfResponsavel: normalizeCPF(values[headerMap['CPF']] || ''),
        cpfResponsavel2: '',
        modalidade: parseModalidade(values[headerMap['NomePlano']] || ''),
        nivel: '',
        valor: parseFloat(values[headerMap['ValorPlano']] || 160) || 160,
        vencimento: parseVencimento(values[headerMap['VctoPlano']] || ''),
        nascimento: parseDate(values[headerMap['DataNasc']] || ''),
        turmaId: '',
        observacao: `Importado do sistema antigo em ${new Date().toLocaleDateString('pt-BR')}`,
        ativo: (values[headerMap['Ativo']] || '0') === '1' ? 1 : 0,
        suspenso: 0,
        bolsista: 0,
        bolsaDesconto: 0,
        valorOriginal: null,
        contratoNum: '',
        autorizaImagem: 1,
        fotoUrl: null,
        planoSaude: '',
        contatoEmergencia: '',
        tamanhoRoupa: '',
        obsPedagogicas: '',
        contratoDe: null,
        contratoAte: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Validar nome (obrigatório)
      if (aluna.nome && aluna.nome.length > 0) {
        alunas.push(aluna);
      }
    });
    
    rl.on('close', () => {
      console.log(`✅ CSV lido: ${alunas.length} alunas encontradas\n`);
      
      if (alunas.length === 0) {
        console.error('❌ Nenhuma aluna para importar. Verifique o CSV.');
        process.exit(1);
      }
      
      // ─── INSERIR NO BANCO ────────────────────────────────────────────────
      try {
        const stmt = db.prepare(`
          INSERT INTO alunas (
            id, nome, responsavel, whatsapp, email, cpf_responsavel, cpf_responsavel2,
            modalidade, nivel, valor, vencimento, nascimento, turma_id, observacao,
            ativo, suspenso, contrato_num, autoriza_imagem, foto_url, plano_saude,
            contato_emergencia, tamanho_roupa, obs_pedagogicas, contrato_de, contrato_ate,
            cadastro, updated_at, plano_total, plano_parcelas, plano_tipo,
            bolsista, bolsa_desconto, valor_original
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        console.log('🔄 Inserindo registros no banco...');
        
        let erros = 0;
        for (let i = 0; i < alunas.length; i++) {
          const a = alunas[i];
          try {
            stmt.run(
              a.id, a.nome, a.responsavel, a.whatsapp, a.email, a.cpfResponsavel,
              a.cpfResponsavel2, a.modalidade, a.nivel, a.valor, a.vencimento,
              a.nascimento, a.turmaId, a.observacao, a.ativo, a.suspenso,
              a.contratoNum, a.autorizaImagem, a.fotoUrl, a.planoSaude,
              a.contatoEmergencia, a.tamanhoRoupa, a.obsPedagogicas, a.contratoDe,
              a.contratoAte, new Date().toLocaleDateString('pt-BR'), a.updatedAt,
              null, null, null, // plano_total, plano_parcelas, plano_tipo
              a.bolsista, a.bolsaDesconto, a.valorOriginal
            );
            
            if ((i + 1) % 20 === 0) {
              process.stdout.write(`  ${i + 1}/${alunas.length}...\r`);
            }
          } catch (e) {
            console.error(`  ⚠️  Erro ao inserir "${a.nome}": ${e.message}`);
            erros++;
          }
        }
        
        console.log(`\n✅ Importação concluída!`);
        console.log(`   ✓ ${alunas.length - erros}/${alunas.length} alunas inseridas`);
        
        if (erros > 0) {
          console.log(`   ⚠️  ${erros} registros com erro\n`);
        } else {
          console.log('');
        }
        
        // Estatísticas
        const stats = {
          total: alunas.length,
          ativas: alunas.filter(a => a.ativo === 1).length,
          inativas: alunas.filter(a => a.ativo === 0).length,
          comEmail: alunas.filter(a => a.email).length,
          comWhatsapp: alunas.filter(a => a.whatsapp).length,
          comCPF: alunas.filter(a => a.cpfResponsavel).length,
        };
        
        console.log('📊 Estatísticas:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Ativas: ${stats.ativas}`);
        console.log(`   Inativas: ${stats.inativas}`);
        console.log(`   Com Email: ${stats.comEmail}`);
        console.log(`   Com Whatsapp: ${stats.comWhatsapp}`);
        console.log(`   Com CPF: ${stats.comCPF}\n`);
        
        // Amostra de dados
        console.log('📋 Amostra (primeiros 3 registros):');
        for (let i = 0; i < Math.min(3, alunas.length); i++) {
          const a = alunas[i];
          console.log(`   ${i + 1}. ${a.nome}`);
          console.log(`      Modalidade: ${a.modalidade} | Valor: R$ ${a.valor} | Vencimento: dia ${a.vencimento}`);
          console.log(`      Email: ${a.email || 'N/A'} | Whatsapp: ${a.whatsapp || 'N/A'}\n`);
        }
        
        db.close();
        resolve(true);
      } catch (e) {
        console.error(`\n❌ Erro na importação: ${e.message}`);
        db.close();
        reject(e);
      }
    });
    
    rl.on('error', (e) => {
      console.error(`❌ Erro ao ler CSV: ${e.message}`);
      reject(e);
    });
  });
}

// ─── EXECUTAR ────────────────────────────────────────────────────────────────
importAlunos()
  .then(() => {
    console.log('✅ Importação finalizada com sucesso!\n');
    console.log('📌 Próximos passos:');
    console.log('   1. Verificar dados no dashboard');
    console.log('   2. Chamar GET /mensalidades/gerar-todas para auto-gerar mensalidades\n');
    process.exit(0);
  })
  .catch((e) => {
    console.error(`\n❌ Falha na importação: ${e.message}\n`);
    process.exit(1);
  });
