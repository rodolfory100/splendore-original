CREATE TABLE `cobrancas` (
	`id` text PRIMARY KEY NOT NULL,
	`aluna_id` text NOT NULL,
	`tipo` text DEFAULT 'boleto',
	`mes` text NOT NULL,
	`valor` real NOT NULL,
	`status` text DEFAULT 'pendente',
	`txid` text,
	`charge_id` integer,
	`nosso_numero` text,
	`link_boleto` text,
	`link_pix` text,
	`pix_copia_e_cola` text,
	`qr_code_base64` text,
	`vencimento` text,
	`data_emissao` text DEFAULT (date('now')),
	`data_pagamento` text,
	`created_at` text DEFAULT (datetime('now'))
);
