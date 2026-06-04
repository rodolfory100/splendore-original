CREATE TABLE `alunas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`responsavel` text NOT NULL,
	`whatsapp` text,
	`email` text,
	`cpf_responsavel` text,
	`cpf_responsavel2` text,
	`modalidade` text DEFAULT 'Ballet' NOT NULL,
	`nivel` text,
	`valor` real DEFAULT 160 NOT NULL,
	`vencimento` text DEFAULT '10',
	`nascimento` text,
	`turma_id` text,
	`observacao` text,
	`ativo` integer DEFAULT true,
	`suspenso` integer DEFAULT false,
	`contrato_num` text,
	`autoriza_imagem` integer DEFAULT true,
	`foto_url` text,
	`plano_saude` text,
	`contato_emergencia` text,
	`tamanho_roupa` text,
	`obs_pedagogicas` text,
	`contrato_de` text,
	`contrato_ate` text,
	`cadastro` text DEFAULT (date('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `arquivo_morto` (
	`id` text PRIMARY KEY NOT NULL,
	`aluna_id` text NOT NULL,
	`nome` text NOT NULL,
	`responsavel` text,
	`whatsapp` text,
	`modalidade` text,
	`valor` real,
	`dados` text,
	`arquivada_em` text DEFAULT (date('now')),
	`motivo` text
);
--> statement-breakpoint
CREATE TABLE `avisos` (
	`id` text PRIMARY KEY NOT NULL,
	`mensagem` text NOT NULL,
	`tipo` text DEFAULT 'geral',
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`escola` text DEFAULT 'Splendore Escola de Dança',
	`nome_admin` text DEFAULT 'Diretora',
	`whatsapp` text,
	`email` text,
	`endereco` text,
	`cidade` text DEFAULT 'Cuiabá - MT',
	`instagram` text,
	`cnpj` text,
	`pix` text,
	`msg_cobranca` text,
	`senha_hash` text DEFAULT 'splendore2026',
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `pagamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`aluna_id` text NOT NULL,
	`mes` text NOT NULL,
	`data` text NOT NULL,
	`valor` real NOT NULL,
	`forma` text DEFAULT 'Pix',
	`observacao` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `presencas` (
	`id` text PRIMARY KEY NOT NULL,
	`aluna_id` text NOT NULL,
	`turma_id` text,
	`data` text NOT NULL,
	`presente` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `turmas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`modalidade` text NOT NULL,
	`nivel` text,
	`dias` text,
	`horario` text,
	`professor` text,
	`vagas` integer,
	`faixa_etaria` text,
	`observacao` text,
	`created_at` text DEFAULT (datetime('now'))
);
