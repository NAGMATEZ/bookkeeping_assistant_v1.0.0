CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`date` integer NOT NULL,
	`total_minor` integer NOT NULL,
	`currency_code` text NOT NULL,
	`project` text NOT NULL,
	`status` text NOT NULL,
	`source_image` text,
	`line_items` text NOT NULL,
	`raw_llm_response` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency_code` text NOT NULL,
	`category` text NOT NULL,
	`project` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`source_invoice_id` text,
	`created_at` integer,
	FOREIGN KEY (`source_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
