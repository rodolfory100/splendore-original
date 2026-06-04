ALTER TABLE `pagamentos` ADD `data_vencimento` text;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD `status` text DEFAULT 'pago';