ALTER TABLE "items" ADD COLUMN "plex_rating_key" varchar(32);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "plex_watch_count" integer;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_plex_rating_key_unique" UNIQUE("plex_rating_key");