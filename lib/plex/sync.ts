import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { items, plexWatchEvents, users } from "../db/schema";
import {
  getAllMoviesInSection,
  getPlexAccountNames,
  getWatchHistoryForSection,
  historyEventId,
  plexCoverUrl,
  PLEX_METADATA_SOURCE,
  type PlexMovie,
} from "../plex";

type PlexFields = {
  title: string;
  creators: string | null;
  year: string | null;
  coverImageUrl: string | null;
  plexWatchCount: number;
  rawMetadata: PlexMovie;
};

function buildPlexFields(movie: PlexMovie): PlexFields {
  return {
    title: movie.title,
    creators: movie.Director?.length ? movie.Director.map((d) => d.tag).join(", ") : null,
    year: movie.year ? String(movie.year) : null,
    coverImageUrl: plexCoverUrl(movie.thumb) ?? null,
    plexWatchCount: movie.viewCount ?? 0,
    rawMetadata: movie,
  };
}

function hasChanged(
  existing: { title: string; creators: string | null; year: string | null; coverImageUrl: string | null; plexWatchCount: number | null; rawMetadata: unknown },
  desired: PlexFields
): boolean {
  return (
    existing.title !== desired.title ||
    existing.creators !== desired.creators ||
    existing.year !== desired.year ||
    existing.coverImageUrl !== desired.coverImageUrl ||
    existing.plexWatchCount !== desired.plexWatchCount ||
    JSON.stringify(existing.rawMetadata) !== JSON.stringify(desired.rawMetadata)
  );
}

async function syncWatchHistory(sectionKey: string, itemIdByRatingKey: Map<string, string>) {
  const [accountNames, history, existingRows] = await Promise.all([
    getPlexAccountNames(),
    getWatchHistoryForSection(sectionKey),
    db.select({ plexHistoryKey: plexWatchEvents.plexHistoryKey }).from(plexWatchEvents),
  ]);
  const existingEventIds = new Set(existingRows.map((row) => row.plexHistoryKey));

  let inserted = 0;
  let skippedNoItem = 0;

  for (const event of history) {
    const eventId = historyEventId(event.historyKey);
    if (existingEventIds.has(eventId)) continue;

    const itemId = itemIdByRatingKey.get(event.ratingKey);
    if (!itemId) {
      skippedNoItem++;
      continue;
    }

    await db.insert(plexWatchEvents).values({
      itemId,
      plexHistoryKey: eventId,
      viewedAt: new Date(event.viewedAt * 1000),
      watchedBy: accountNames.get(event.accountID) ?? null,
    });
    inserted++;
  }

  return { inserted, total: history.length, skippedNoItem };
}

async function main() {
  const serverUrl = process.env.PLEX_SERVER_URL;
  const token = process.env.PLEX_TOKEN;
  const sectionKey = process.env.PLEX_MOVIES_SECTION_KEY;

  if (!serverUrl || !token || !sectionKey) {
    console.error(
      "Set PLEX_SERVER_URL, PLEX_TOKEN, and PLEX_MOVIES_SECTION_KEY env vars before running the Plex sync."
    );
    process.exit(1);
  }

  const adminUser = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  if (!adminUser) {
    console.error("No admin user found; cannot set added_by_user_id for synced items.");
    process.exit(1);
  }

  const movies = await getAllMoviesInSection(sectionKey);

  const existingRows = await db
    .select()
    .from(items)
    .where(and(eq(items.category, "movie"), isNotNull(items.plexRatingKey)));
  const byRatingKey = new Map(
    existingRows.filter((row) => row.plexRatingKey).map((row) => [row.plexRatingKey as string, row])
  );
  const itemIdByRatingKey = new Map(
    existingRows.filter((row) => row.plexRatingKey).map((row) => [row.plexRatingKey as string, row.id])
  );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const movie of movies) {
    const fields = buildPlexFields(movie);
    const existing = byRatingKey.get(movie.ratingKey);

    if (!existing) {
      const [newItem] = await db
        .insert(items)
        .values({
          category: "movie",
          formats: ["digital"],
          plexRatingKey: movie.ratingKey,
          subtitle: null,
          barcode: null,
          notes: null,
          metadataSource: PLEX_METADATA_SOURCE,
          addedByUserId: adminUser.id,
          ...fields,
        })
        .returning({ id: items.id });
      itemIdByRatingKey.set(movie.ratingKey, newItem.id);
      inserted++;
    } else if (hasChanged(existing, fields)) {
      await db
        .update(items)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(items.id, existing.id));
      updated++;
    } else {
      unchanged++;
    }
  }

  // Movies removed from Plex (or a temporarily unreachable library) are left
  // untouched here on purpose — this sync never deletes or flags catalog rows,
  // since a stale-but-harmless entry is a safer default than silently hiding
  // something the user may still care about.

  console.log(
    `Plex sync: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged, ${movies.length} total.`
  );

  const historyResult = await syncWatchHistory(sectionKey, itemIdByRatingKey);
  console.log(
    `Watch history: ${historyResult.inserted} new events imported (${historyResult.total} total in Plex, ${historyResult.skippedNoItem} skipped for items not in catalog).`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
