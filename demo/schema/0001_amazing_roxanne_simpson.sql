CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`focus` text DEFAULT '' NOT NULL,
	`review` text DEFAULT '' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` text,
	`phase` text DEFAULT 'found' NOT NULL,
	`assigned_to` text DEFAULT 'Busca' NOT NULL,
	`signal` text DEFAULT '' NOT NULL,
	`signal_url` text DEFAULT '' NOT NULL,
	`observed_on` text DEFAULT '' NOT NULL,
	`hypothesis` text DEFAULT '' NOT NULL,
	`research_notes` text DEFAULT '' NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`channel_state` text DEFAULT 'pending' NOT NULL,
	`channel_basis` text DEFAULT '' NOT NULL,
	`draft_subject` text DEFAULT '' NOT NULL,
	`draft_body` text DEFAULT '' NOT NULL,
	`last_contact_on` text DEFAULT '' NOT NULL,
	`last_contact_ref` text DEFAULT '' NOT NULL,
	`reply_on` text DEFAULT '' NOT NULL,
	`reply_summary` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`follow_up_on` text DEFAULT '' NOT NULL,
	`decision_reason` text DEFAULT '' NOT NULL,
	`opportunity_id` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_prospect_per_contact` ON `prospects` (`contact_id`) WHERE "prospects"."archived"=0;--> statement-breakpoint
CREATE INDEX `prospects_batch` ON `prospects` (`batch_id`);--> statement-breakpoint
ALTER TABLE `contacts` ADD `do_not_contact` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `do_not_contact_reason` text DEFAULT '' NOT NULL;