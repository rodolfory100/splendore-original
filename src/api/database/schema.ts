import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── CONFIG da escola
export const config = sqliteTable("config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  escola: text("escola").default("Splendore Escola de Dança"),
  nomeAdmin: text("nome_admin").default("Diretora"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  endereco: text("endereco"),
  cidade: text("cidade").default("Cuiabá - MT"),
  instagram: text("instagram"),
  cnpj: text("cnpj"),
  pix: text("pix"),
  msgCobranca: text("msg_cobranca"),
  senhaHash: text("senha_hash").default("splendore2026"),
  // Efí Bank
  efiClientId: text("efi_client_id"),
  efiClientSecret: text("efi_client_secret"),
  efiChavePix: text("efi_chave_pix"),
  efiSandbox: integer("efi_sandbox", { mode: "boolean" }).default(true),
  // Sicoob / Sicredi
  sicoobClientId: text("sicoob_client_id"),
  sicoobClientSecret: text("sicoob_client_secret"),
  sicoobCertificado: text("sicoob_certificado"),   // certificado em base64 ou path
  sicoobChavePix: text("sicoob_chave_pix"),
  sicoobContaCorrente: text("sicoob_conta_corrente"),
  sicoobAgencia: text("sicoob_agencia"),
  sicoobSandbox: integer("sicoob_sandbox", { mode: "boolean" }).default(true),
  // Telegram Bot
  telegramToken: text("telegram_token"),       // token do bot @BotFather
  telegramChatId: text("telegram_chat_id"),    // seu chat_id pessoal (segurança)
  telegramAtivo: integer("telegram_ativo", { mode: "boolean" }).default(false),
  // IA
  openrouterKey: text("openrouter_key"),       // API key OpenRouter
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ── TURMAS
export const turmas = sqliteTable("turmas", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  modalidade: text("modalidade").notNull(),
  nivel: text("nivel"),
  dias: text("dias"),
  horario: text("horario"),
  professor: text("professor"),
  vagas: integer("vagas"),
  faixaEtaria: text("faixa_etaria"),
  observacao: text("observacao"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── ALUNAS
export const alunas = sqliteTable("alunas", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  responsavel: text("responsavel").notNull(),
  whatsapp: text("whatsapp"),
  email: text("email"),
  cpfResponsavel: text("cpf_responsavel"),
  cpfResponsavel2: text("cpf_responsavel2"),
  modalidade: text("modalidade").notNull().default("Ballet"),
  nivel: text("nivel"),
  valor: real("valor").notNull().default(160),
  vencimento: text("vencimento").default("10"),
  // ── PLANO
  planoTotal: real("plano_total"),          // valor total do plano (ex: 1920)
  planoParcelas: integer("plano_parcelas"), // qtd de parcelas (12, 6, 3)
  planoTipo: text("plano_tipo"),            // mensal | semestral | trimestral | personalizado
  //
  nascimento: text("nascimento"),
  turmaId: text("turma_id"),
  observacao: text("observacao"),
  ativo: integer("ativo", { mode: "boolean" }).default(true),
  suspenso: integer("suspenso", { mode: "boolean" }).default(false),
  bolsista: integer("bolsista", { mode: "boolean" }).default(false),
  bolsaDesconto: real("bolsa_desconto").default(0), // percentual 0-100 (100 = gratuito)
  valorOriginal: real("valor_original"),            // valor antes da bolsa
  contratoNum: text("contrato_num"),
  autorizaImagem: integer("autoriza_imagem", { mode: "boolean" }).default(true),
  fotoUrl: text("foto_url"),
  planoSaude: text("plano_saude"),
  contatoEmergencia: text("contato_emergencia"),
  tamanhoRoupa: text("tamanho_roupa"),
  obsPedagogicas: text("obs_pedagogicas"),
  contratoDe: text("contrato_de"),
  contratoAte: text("contrato_ate"),
  cadastro: text("cadastro").default(sql`(date('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ── PAGAMENTOS
export const pagamentos = sqliteTable("pagamentos", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  mes: text("mes").notNull(), // formato YYYY-MM
  data: text("data").notNull(),
  dataVencimento: text("data_vencimento"), // data real de vencimento YYYY-MM-DD
  valor: real("valor").notNull(),
  status: text("status").default("pago"), // pago | pendente | atrasado
  forma: text("forma").default("Pix"),
  observacao: text("observacao"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── PRESENÇA
export const presencas = sqliteTable("presencas", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  turmaId: text("turma_id"),
  data: text("data").notNull(),
  presente: integer("presente", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── AVISOS
export const avisos = sqliteTable("avisos", {
  id: text("id").primaryKey(),
  mensagem: text("mensagem").notNull(),
  tipo: text("tipo").default("geral"), // geral, urgente, evento
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── ARQUIVO MORTO
export const arquivoMorto = sqliteTable("arquivo_morto", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  nome: text("nome").notNull(),
  responsavel: text("responsavel"),
  whatsapp: text("whatsapp"),
  modalidade: text("modalidade"),
  valor: real("valor"),
  dados: text("dados"), // JSON com todos os dados
  arquivadaEm: text("arquivada_em").default(sql`(date('now'))`),
  motivo: text("motivo"),
});

// ── COBRANÇAS / BOLETOS (Efí Bank)
export const cobrancas = sqliteTable("cobrancas", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  tipo: text("tipo").default("boleto"), // boleto | pix
  mes: text("mes").notNull(),
  valor: real("valor").notNull(),
  status: text("status").default("pendente"), // pendente | pago | cancelado | expirado
  txid: text("txid"),           // ID da cobrança na Efí
  chargeId: integer("charge_id"), // ID numérico da Efí
  nossoNumero: text("nosso_numero"),
  linkBoleto: text("link_boleto"),
  linkPix: text("link_pix"),
  pixCopiaECola: text("pix_copia_e_cola"),
  qrCodeBase64: text("qr_code_base64"),
  vencimento: text("vencimento"),
  dataEmissao: text("data_emissao").default(sql`(date('now'))`),
  dataPagamento: text("data_pagamento"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── CONTRATOS (M3)
export const contratos = sqliteTable("contratos", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  conteudoHtml: text("conteudo_html").notNull(),
  status: text("status").default("pendente"), // pendente | assinado | cancelado
  tokenAssinatura: text("token_assinatura"),
  codigoConfirmacao: text("codigo_confirmacao"),
  assinadoPor: text("assinado_por"),
  assinadoEm: text("assinado_em"),
  ipAssinatura: text("ip_assinatura"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── RESPONSÁVEIS (M4)
export const responsaveis = sqliteTable("responsaveis", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  nome: text("nome").notNull(),
  parentesco: text("parentesco"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  cpf: text("cpf"),
  principal: integer("principal", { mode: "boolean" }).default(false),
  fotoUrl: text("foto_url"),
  consentimentoLgpd: integer("consentimento_lgpd", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── CÂMERAS (M4)
export const cameras = sqliteTable("cameras", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  url: text("url").notNull(),
  snapshotUrl: text("snapshot_url"),
  local: text("local"),
  ativa: integer("ativa", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── ALERTAS DO SISTEMA (M4)
export const sistemAlertas = sqliteTable("sistem_alertas", {
  id: text("id").primaryKey(),
  tipo: text("tipo").notNull(), // pagamento | presenca | contrato | geral
  mensagem: text("mensagem").notNull(),
  alunaId: text("aluna_id"),
  resolvido: integer("resolvido", { mode: "boolean" }).default(false),
  resolvidoEm: text("resolvido_em"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── AVALIAÇÕES PEDAGÓGICAS (M5)
export const avaliacoes = sqliteTable("avaliacoes", {
  id: text("id").primaryKey(),
  alunaId: text("aluna_id").notNull(),
  turmaId: text("turma_id"),
  periodo: text("periodo").notNull(), // ex: 2026-1
  tecnica: integer("tecnica"),        // 1-10
  ritmo: integer("ritmo"),
  expressao: integer("expressao"),
  disciplina: integer("disciplina"),
  evolucao: integer("evolucao"),
  mediaGeral: real("media_geral"),
  observacoes: text("observacoes"),
  professor: text("professor"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── DESPESAS (M6)
export const despesas = sqliteTable("despesas", {
  id: text("id").primaryKey(),
  descricao: text("descricao").notNull(),
  valor: real("valor").notNull(),
  data: text("data").notNull(),
  mes: text("mes").notNull(), // YYYY-MM
  categoria: text("categoria").default("Geral"), // Aluguel | Salários | Material | Manutenção | Geral
  formaPagamento: text("forma_pagamento"),
  comprovante: text("comprovante"),
  observacao: text("observacao"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── ITENS DE ESTOQUE / FANTASIAS (M8)
export const itensEstoque = sqliteTable("itens_estoque", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  categoria: text("categoria").default("Fantasia"), // Fantasia | Acessório | Uniforme | Material
  tamanho: text("tamanho"),
  quantidade: integer("quantidade").default(1),
  quantidadeDisponivel: integer("quantidade_disponivel").default(1),
  descricao: text("descricao"),
  fotoUrl: text("foto_url"),
  valor: real("valor"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── EMPRÉSTIMOS (M8)
export const emprestimos = sqliteTable("emprestimos", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  alunaId: text("aluna_id").notNull(),
  dataEmprestimo: text("data_emprestimo").notNull(),
  dataDevolucaoPrevista: text("data_devolucao_prevista"),
  dataDevolucaoReal: text("data_devolucao_real"),
  devolvido: integer("devolvido", { mode: "boolean" }).default(false),
  observacao: text("observacao"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
