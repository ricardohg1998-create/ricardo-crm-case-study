CREATE TABLE `campaign_members` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`stage` text NOT NULL,
	`assigned_to` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_member_status" CHECK("campaign_members"."status" IN ('active','replied','won','lost','paused','opted_out'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_contact` ON `campaign_members` (`campaign_id`,`contact_id`);--> statement-breakpoint
CREATE INDEX `campaign_member_contact` ON `campaign_members` (`contact_id`);--> statement-breakpoint
CREATE INDEX `campaign_member_cursor` ON `campaign_members` (`campaign_id`,`id`);--> statement-breakpoint
CREATE INDEX `campaign_member_assigned` ON `campaign_members` (`assigned_to`);--> statement-breakpoint
CREATE TABLE `campaign_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`input_hash` text NOT NULL,
	`operation` text NOT NULL,
	`actor` text NOT NULL,
	`recorded_at` text NOT NULL,
	`result_json` text NOT NULL,
	`valid` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "campaign_request_atomic_guard" CHECK("campaign_requests"."valid"=1)
);
--> statement-breakpoint
CREATE TABLE `campaign_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`position` integer NOT NULL,
	`delay_days` integer DEFAULT 0 NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_step_max" CHECK("campaign_steps"."position" BETWEEN 0 AND 2),
	CONSTRAINT "campaign_step_delay" CHECK("campaign_steps"."delay_days" BETWEEN 0 AND 365)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_step_position` ON `campaign_steps` (`campaign_id`,`position`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`project_id` text NOT NULL,
	`objective` text DEFAULT 'clients' NOT NULL,
	`sector_id` text,
	`offer` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`funnel_stages` text DEFAULT '["Pendiente","Contactado","En conversación","Ganado"]' NOT NULL,
	`sending_enabled` integer DEFAULT 0 NOT NULL,
	`mailbox_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_objective" CHECK("campaigns"."objective" IN ('clients','partners','growth')),
	CONSTRAINT "campaign_status" CHECK("campaigns"."status" IN ('draft','active','paused','closed'))
);
--> statement-breakpoint
CREATE INDEX `campaigns_project` ON `campaigns` (`project_id`);--> statement-breakpoint
CREATE INDEX `campaigns_sector` ON `campaigns` (`sector_id`);--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text,
	`contact_id` text NOT NULL,
	`member_id` text,
	`mailbox_id` text NOT NULL,
	`direction` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`to_email` text NOT NULL,
	`from_email` text NOT NULL,
	`message_id` text NOT NULL,
	`in_reply_to` text DEFAULT '' NOT NULL,
	`references` text DEFAULT '' NOT NULL,
	`step_id` text,
	`sequence_position` integer DEFAULT 0 NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`sent_at` text DEFAULT '' NOT NULL,
	`received_at` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`activity_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `campaign_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `campaign_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "email_direction" CHECK("email_messages"."direction" IN ('inbound','outbound')),
	CONSTRAINT "email_status" CHECK("email_messages"."status" IN ('draft','queued','sending','sent','uncertain','cancelled','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_message_id` ON `email_messages` (`message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_member_step` ON `email_messages` (`member_id`,`step_id`) WHERE "email_messages"."step_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `email_due` ON `email_messages` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `email_contact` ON `email_messages` (`contact_id`);--> statement-breakpoint
CREATE TABLE `mail_cursors` (
	`id` text PRIMARY KEY NOT NULL,
	`uid_validity` text DEFAULT '' NOT NULL,
	`last_uid` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`details` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sectors_name` ON `sectors` (lower(trim("name")));--> statement-breakpoint
ALTER TABLE `batches` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sector_id` text REFERENCES sectors(id);