# 🔄 Migração de Dados — Access → Splendore Sistema

## Análise do Banco Antigo

**Sistema Anterior:** GymPass/Academia (Access)
**Tabelas Principais:** 
- Alunos (160 registros)
- Matrículas
- Plano
- Turmas
- Aulas
- Professores
- Modalidade

## Mapeamento de Campos

### Tabela: Alunos (160 registros)

| Campo Antigo | Campo Novo | Tipo | Notas |
|---|---|---|---|
| Codigo | id | UUID/nanoid | Gerar novo ID |
| Nome | nome | text | ✅ Direto |
| Telefone | whatsapp | text | Normalizar formato |
| Mail | email | text | ✅ Direto |
| DataNasc | nascimento | date | Formato YYYY-MM-DD |
| CPF | cpfResponsavel | text | ✅ Direto |
| RG | - | - | Não mapeado (não usado) |
| Celular | whatsapp | text | Usar celular se telefone vazio |
| NomePlano | modalidade | text | Mapear: Personal→Ballet, etc |
| ValorPlano | valor | decimal | ✅ Direto |
| VctoPlano | vencimento | int | Extrair dia (ex: 10/01/25 → 10) |
| Ativo | ativo | boolean | ✅ Direto |
| RespAluno | responsavel | text | ✅ Direto (nome do responsável) |
| CPFRespContrato | cpfResponsavel | text | ✅ Se vazio, usar CPF principal |
| Apelido | - | - | Não mapeado |
| Alergico | - | - | Não mapeado (usar observacao) |
| Escola | - | - | Não mapeado |
| Foto | fotoUrl | text | Base64 ou URL de armazenamento |

### Tabela: Turmas

| Campo Antigo | Campo Novo |
|---|---|
| NomeTurma | nome |
| Professores | professor |
| Modalidade | modalidade |
| - | dias (seg/ter/qua/qui/sex) |
| - | horario |

### Tabela: Matrículas → Mensalidades

| Campo Antigo | Campo Novo |
|---|---|
| DataMatricula | contratoDe |
| VctoMatricula | contratoAte |
| ValorMatricula | valor |
| Aluno | alunaId |
| Plano | modalidade |

---

## 📊 Dados Amostra (primeiros 5 alunos)

```
Codigo | Nome | Whatsapp | Email | CPF | DataNasc | VctoPlano
1 | ANNA BEATRIZ ARRUDA NASCIMENTO | (vazio) | jca35futebol@gmail.com | 09500353199 | 08/11/18 | 12/19/24
2 | RODOLFO PAZ MARQUES | 65984743940 | RODOLFORY100@GMAIL.COM | 02700834135 | 10/27/85 | 12/27/24
3 | ISABELLE SOUZA BENEVIDES | 65993564566 | souzabenevidesi@gmail.com | 08138765160 | 01/01/08 | 01/06/25
...
```

---

## 🔧 Scripts de Migração Disponíveis

1. **alunos.csv** — Exportado do Access (160 registros)
2. **import_alunos.js** — Script Node.js para importação (abaixo)

---

## 📝 Script de Importação (Node.js)

```javascript
import { csv } from 'csv';
import Database from 'better-sqlite3';

const db = new Database('.wrangler/state/v3/d1/DB.sqlite3');

async function importAlunos() {
  const fs = require('fs');
  const { parse } = require('csv-parse');
  
  const alunas = [];
  
  fs.createReadStream('alunos.csv')
    .pipe(parse({ delimiter: '|', columns: true }))
    .on('data', (row) => {
      const aluna = {
        id: crypto.randomUUID(),
        nome: row.Nome,
        responsavel: row.RespAluno || '',
        whatsapp: row.Celular || row.Telefone || '',
        email: row.Mail || '',
        cpfResponsavel: row.CPF || '',
        cpfResponsavel2: '',
        modalidade: mapModalidade(row.NomePlano),
        nivel: '',
        valor: parseFloat(row.ValorPlano) || 160,
        vencimento: extrairDia(row.VctoPlano),
        nascimento: formatarData(row.DataNasc),
        turmaId: '',
        observacao: row.Obs || `Importado do sistema antigo em ${new Date().toLocaleDateString()}`,
        autorizaImagem: true,
        ativo: row.Ativo === 1 || row.Ativo === '1',
        bolsista: false,
        bolsaDesconto: 0,
        valorOriginal: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      alunas.push(aluna);
    })
    .on('end', async () => {
      // Inserir no banco D1
      const stmt = db.prepare(`
        INSERT INTO alunas (
          id, nome, responsavel, whatsapp, email, cpfResponsavel, cpfResponsavel2,
          modalidade, nivel, valor, vencimento, nascimento, turmaId, observacao,
          autorizaImagem, ativo, bolsista, bolsaDesconto, valorOriginal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const aluna of alunas) {
        stmt.run(
          aluna.id, aluna.nome, aluna.responsavel, aluna.whatsapp, aluna.email,
          aluna.cpfResponsavel, aluna.cpfResponsavel2, aluna.modalidade, aluna.nivel,
          aluna.valor, aluna.vencimento, aluna.nascimento, aluna.turmaId,
          aluna.observacao, aluna.autorizaImagem, aluna.ativo, aluna.bolsista,
          aluna.bolsaDesconto, aluna.valorOriginal
        );
      }
      
      console.log(`✅ ${alunas.length} alunas importadas com sucesso!`);
    });
}

function mapModalidade(nomeAntigo) {
  const map = {
    'Personal': 'Ballet',
    'Musculação': 'Jazz',
    'Yoga': 'Danças Urbanas',
    'Pilates': 'Ballet',
  };
  return map[nomeAntigo] || 'Ballet';
}

function extrairDia(dataStr) {
  if (!dataStr) return 10;
  const partes = dataStr.split('/');
  return parseInt(partes[0]) || 10;
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [mes, dia, ano] = dataStr.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

importAlunos();
```

---

## ✅ Checklist de Migração

- [ ] Extrair dados do Access (alunos.csv)
- [ ] Validar CPF e Whatsapp
- [ ] Revisar mapeamento de modalidades
- [ ] Verificar datas (formato DD/MM/YY → YYYY-MM-DD)
- [ ] Testar importação em ambiente de staging
- [ ] Fazer backup D1 antes de importar
- [ ] Executar script de importação
- [ ] Validar dados no banco novo
- [ ] Gerar mensalidades para os alunos importados
- [ ] Publicar no Runable

---

## 📞 Suporte na Migração

Se encontrar erros:
1. Validar CPF (deve ter 11 dígitos)
2. Verificar formato de telefone (DD + número)
3. Revisar datas (formato esperado: DD/MM/YYYY)
4. Checar modalidades (Ballet, Jazz, Danças Urbanas)

