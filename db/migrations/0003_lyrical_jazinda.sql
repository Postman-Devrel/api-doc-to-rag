ALTER TABLE "resources" ALTER COLUMN "website_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN IF EXISTS "url";