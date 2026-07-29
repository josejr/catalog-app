import { eq } from "drizzle-orm";
import { db } from "../db";
import { items, users } from "../db/schema";
import { getAllMoviesInSection, plexCoverUrl, PLEX_METADATA_SOURCE, type PlexMovie } from "../plex";

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

  const existingRows = await db.select().from(items).where(eq(items.mediaType, "digital"));
  const byRatingKey = new Map(
    existingRows.filter((row) => row.plexRatingKey).map((row) => [row.plexRatingKey as string, row])
  );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const movie of movies) {
    const fields = buildPlexFields(movie);
    const existing = byRatingKey.get(movie.ratingKey);

    if (!existing) {
      await db.insert(items).values({
        mediaType: "digital",
        plexRatingKey: movie.ratingKey,
        subtitle: null,
        barcode: null,
        notes: null,
        metadataSource: PLEX_METADATA_SOURCE,
        addedByUserId: adminUser.id,
        ...fields,
      });
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
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
