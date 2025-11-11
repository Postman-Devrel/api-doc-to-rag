ALTER TABLE "resources" ADD COLUMN "tags" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "curl_command" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "parameters" jsonb;