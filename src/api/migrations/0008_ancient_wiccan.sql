ALTER TABLE `config` ADD `sicoob_client_id` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_client_secret` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_certificado` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_chave_pix` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_conta_corrente` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_agencia` text;--> statement-breakpoint
ALTER TABLE `config` ADD `sicoob_sandbox` integer DEFAULT true;