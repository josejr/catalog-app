CREATE TABLE "plex_watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"plex_history_key" varchar(32) NOT NULL,
	"viewed_at" timestamp with time zone NOT NULL,
	"watched_by" varchar(255),
	CONSTRAINT "plex_watch_events_plex_history_key_unique" UNIQUE("plex_history_key")
);
--> statement-breakpoint
ALTER TABLE "plex_watch_events" ADD CONSTRAINT "plex_watch_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;