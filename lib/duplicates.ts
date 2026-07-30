import { db } from "@/lib/db";
import type { Category } from "@/lib/db/schema";

export type DuplicateGroupItem = {
  id: string;
  formats: string[];
  year: string | null;
  coverImageUrl: string | null;
  addedByUserId: string;
  addedByName: string | null;
};

export type DuplicateGroup = {
  title: string;
  category: Category;
  items: DuplicateGroupItem[];
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Groups items that share a category and an (near-)identical title — the
// common signature of the same movie/book/album cataloged twice, once per
// format (e.g. a DVD scanned by hand plus the same title auto-synced from
// Plex as a separate digital row). Deliberately a plain exact-normalized-
// title match rather than fuzzy string matching: titles here mostly come
// from metadata APIs (OMDb/TMDB/Plex/etc.), so they're already canonical,
// and exact matching keeps false positives near zero.
export async function findPossibleDuplicates(): Promise<DuplicateGroup[]> {
  const rows = await db.query.items.findMany({
    with: { addedBy: { columns: { name: true } } },
  });

  const groups = new Map<string, DuplicateGroup>();

  for (const row of rows) {
    const key = `${row.category}::${normalizeTitle(row.title)}`;
    const item: DuplicateGroupItem = {
      id: row.id,
      formats: row.formats,
      year: row.year,
      coverImageUrl: row.coverImageUrl,
      addedByUserId: row.addedByUserId,
      addedByName: row.addedBy?.name ?? null,
    };

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { title: row.title, category: row.category as Category, items: [item] });
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.items.length > 1)
    .sort((a, b) => a.title.localeCompare(b.title));
}
