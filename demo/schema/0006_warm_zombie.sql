CREATE INDEX `audit_contact_before_email` ON `audit` (json_extract("before_json",'$.email')) WHERE "entity"='contacts';--> statement-breakpoint
CREATE INDEX `audit_contact_after_email` ON `audit` (json_extract("after_json",'$.email')) WHERE "entity"='contacts';
