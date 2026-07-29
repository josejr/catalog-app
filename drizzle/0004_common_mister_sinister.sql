ALTER TABLE "items" ADD COLUMN "category" varchar(20);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "formats" text[] DEFAULT '{}' NOT NULL;