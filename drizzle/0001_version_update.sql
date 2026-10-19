ALTER TABLE `invoices` ADD `net_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `vat_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `gross_minor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `source_image_mime` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `net_minor` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `gross_minor` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
UPDATE `invoices` SET `content_hash` = REPLACE(`source_image`, 'sha256:', '') WHERE `source_image` LIKE 'sha256:%';--> statement-breakpoint
UPDATE `invoices` SET `source_image` = NULL WHERE `content_hash` IS NOT NULL;--> statement-breakpoint
UPDATE `invoices` SET `net_minor` = `total_minor`, `vat_minor` = 0, `gross_minor` = `total_minor` WHERE `gross_minor` = 0 AND `total_minor` <> 0;