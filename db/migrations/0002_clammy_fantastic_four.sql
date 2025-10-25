CREATE TABLE IF NOT EXISTS "websites" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "websites_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "website_id" varchar(191);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
