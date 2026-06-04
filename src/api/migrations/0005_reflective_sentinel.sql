ALTER TABLE `config` ADD `telegram_token` text;--> statement-breakpoint
ALTER TABLE `config` ADD `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `config` ADD `telegram_ativo` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `config` ADD `openrouter_key` text;