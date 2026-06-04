-- M3: Contratos
CREATE TABLE IF NOT EXISTS `contratos` (
  `id` text PRIMARY KEY NOT NULL,
  `aluna_id` text NOT NULL,
  `conteudo_html` text NOT NULL,
  `status` text DEFAULT 'pendente',
  `token_assinatura` text,
  `codigo_confirmacao` text,
  `assinado_por` text,
  `assinado_em` text,
  `ip_assinatura` text,
  `created_at` text DEFAULT (datetime('now'))
);

-- M4: Responsáveis
CREATE TABLE IF NOT EXISTS `responsaveis` (
  `id` text PRIMARY KEY NOT NULL,
  `aluna_id` text NOT NULL,
  `nome` text NOT NULL,
  `parentesco` text,
  `whatsapp` text,
  `email` text,
  `cpf` text,
  `principal` integer DEFAULT false,
  `created_at` text DEFAULT (datetime('now'))
);

-- M4: Câmeras
CREATE TABLE IF NOT EXISTS `cameras` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `url` text NOT NULL,
  `local` text,
  `ativa` integer DEFAULT true,
  `created_at` text DEFAULT (datetime('now'))
);

-- M4: Alertas do sistema
CREATE TABLE IF NOT EXISTS `sistem_alertas` (
  `id` text PRIMARY KEY NOT NULL,
  `tipo` text NOT NULL,
  `mensagem` text NOT NULL,
  `aluna_id` text,
  `resolvido` integer DEFAULT false,
  `resolvido_em` text,
  `created_at` text DEFAULT (datetime('now'))
);

-- M5: Avaliações pedagógicas
CREATE TABLE IF NOT EXISTS `avaliacoes` (
  `id` text PRIMARY KEY NOT NULL,
  `aluna_id` text NOT NULL,
  `turma_id` text,
  `periodo` text NOT NULL,
  `tecnica` integer,
  `ritmo` integer,
  `expressao` integer,
  `disciplina` integer,
  `evolucao` integer,
  `media_geral` real,
  `observacoes` text,
  `professor` text,
  `created_at` text DEFAULT (datetime('now'))
);

-- M6: Despesas
CREATE TABLE IF NOT EXISTS `despesas` (
  `id` text PRIMARY KEY NOT NULL,
  `descricao` text NOT NULL,
  `valor` real NOT NULL,
  `data` text NOT NULL,
  `mes` text NOT NULL,
  `categoria` text DEFAULT 'Geral',
  `forma_pagamento` text,
  `comprovante` text,
  `observacao` text,
  `created_at` text DEFAULT (datetime('now'))
);

-- M8: Itens de estoque
CREATE TABLE IF NOT EXISTS `itens_estoque` (
  `id` text PRIMARY KEY NOT NULL,
  `nome` text NOT NULL,
  `categoria` text DEFAULT 'Fantasia',
  `tamanho` text,
  `quantidade` integer DEFAULT 1,
  `quantidade_disponivel` integer DEFAULT 1,
  `descricao` text,
  `foto_url` text,
  `valor` real,
  `created_at` text DEFAULT (datetime('now'))
);

-- M8: Empréstimos
CREATE TABLE IF NOT EXISTS `emprestimos` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `aluna_id` text NOT NULL,
  `data_emprestimo` text NOT NULL,
  `data_devolucao_prevista` text,
  `data_devolucao_real` text,
  `devolvido` integer DEFAULT false,
  `observacao` text,
  `created_at` text DEFAULT (datetime('now'))
);
