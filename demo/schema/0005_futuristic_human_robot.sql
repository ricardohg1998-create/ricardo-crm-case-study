CREATE TABLE `batch_members` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`entry_key` text NOT NULL,
	`contact_id` text,
	`identity_id` text,
	`email` text DEFAULT '' NOT NULL,
	`sector` text DEFAULT '' NOT NULL,
	`run_id` text NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`observed_on` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`reservation_token` text DEFAULT '' NOT NULL,
	`reservation_owner` text DEFAULT '' NOT NULL,
	`reserved_until` text DEFAULT '' NOT NULL,
	`exported_at` text DEFAULT '' NOT NULL,
	`sent_at` text DEFAULT '' NOT NULL,
	`sent_ref` text DEFAULT '' NOT NULL,
	`input_hash` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`identity_id`) REFERENCES `bulk_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batch_member_entry` ON `batch_members` (`batch_id`,`entry_key`);--> statement-breakpoint
CREATE INDEX `batch_member_contact` ON `batch_members` (`contact_id`);--> statement-breakpoint
CREATE INDEX `batch_member_email` ON `batch_members` (`email`);--> statement-breakpoint
CREATE INDEX `batch_member_cursor` ON `batch_members` (`batch_id`,`id`);--> statement-breakpoint
CREATE TABLE `bulk_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`reserved_until` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `batch_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bulk_claim_member` ON `bulk_claims` (`member_id`);--> statement-breakpoint
CREATE TABLE `bulk_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`source_system` text NOT NULL,
	`business_key` text NOT NULL,
	`contact_id` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bulk_identity_source_key` ON `bulk_identities` (`source_system`,`business_key`);--> statement-breakpoint
CREATE INDEX `bulk_identity_contact` ON `bulk_identities` (`contact_id`);--> statement-breakpoint
CREATE TABLE `bulk_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`input_hash` text NOT NULL,
	`operation` text NOT NULL,
	`actor` text NOT NULL,
	`recorded_at` text NOT NULL,
	`result_json` text NOT NULL,
	`valid` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bulk_request_atomic_guard" CHECK("bulk_requests"."valid"=1)
);
