import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
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

export const categories = ["movie", "music", "book", "other"] as const;
export type Category = (typeof categories)[number];

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: varchar("category", { length: 20 }).notNull(),
  formats: text("formats").array().notNull().default([]),
  barcode: varchar("barcode", { length: 32 }),
  isbn: varchar("isbn", { length: 20 }),
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

export const itemsRelations = relations(items, ({ one, many }) => ({
  addedBy: one(users, {
    fields: [items.addedByUserId],
    references: [users.id],
  }),
  watchEvents: many(plexWatchEvents),
  favorites: many(favorites),
  tags: many(itemTags),
}));

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  favorites: many(favorites),
  tags: many(itemTags),
}));

// Per-user favorite flag on an item — deliberately not shared across the
// household, so each person's favorites list is their own.
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.itemId, table.userId)]
);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  item: one(items, { fields: [favorites.itemId], references: [items.id] }),
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
}));

// Free-text tags a user attaches to an item, private to that user — the
// same item can carry different tags for different household members.
export const itemTags = pgTable(
  "item_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.itemId, table.userId, table.tag)]
);

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, { fields: [itemTags.itemId], references: [items.id] }),
  user: one(users, { fields: [itemTags.userId], references: [users.id] }),
}));

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per individual Plex watch event, imported from Plex's
// /status/sessions/history endpoint (distinct from items.plexWatchCount,
// which is just the aggregate count Plex reports on the item itself).
export const plexWatchEvents = pgTable("plex_watch_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  plexHistoryKey: varchar("plex_history_key", { length: 32 }).notNull().unique(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull(),
  watchedBy: varchar("watched_by", { length: 255 }),
});

export const plexWatchEventsRelations = relations(plexWatchEvents, ({ one }) => ({
  item: one(items, {
    fields: [plexWatchEvents.itemId],
    references: [items.id],
  }),
}));
