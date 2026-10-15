ALTER TABLE `activities` ADD `email_subject` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `email_body` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contact_person` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `business_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `detected_need` text DEFAULT '' NOT NULL;