import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"), // "admin" | "member"
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mediaTypes = ["book", "cd", "dvd", "bluray", "digital", "other"] as const;
export type MediaType = (typeof mediaTypes)[number];

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaType: varchar("media_type", { length: 20 }).notNull(),
  barcode: varchar("barcode", { length: 32 }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  creators: text("creators"), // authors / artists / directors, free text
  year: varchar("year", { length: 4 }),
  coverImageUrl: text("cover_image_url"),
  notes: text("notes"),
  metadataSource: varchar("metadata_source", { length: 50 }),
  rawMetadata: jsonb("raw_metadata"),
  plexRatingKey: varchar("plex_rating_key", { length: 32 }).unique(),
  plexWatchCount: integer("plex_watch_count"),
  addedByUserId: uuid("added_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const itemsRelations = relations(items, ({ one }) => ({
  addedBy: one(users, {
    fields: [items.addedByUserId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
}));

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
