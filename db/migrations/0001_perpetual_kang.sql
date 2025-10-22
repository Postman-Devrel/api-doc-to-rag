ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_resource_id_fkey";
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
