"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { categoryFormats } from "@/lib/categories";
import { db } from "@/lib/db";
import { categories, items, type Category } from "@/lib/db/schema";
import {
  getOmdbDetailById,
  getTmdbDetailById,
  searchHardcoverCandidates,
  searchItunesCandidates,
  searchMusicBrainzCandidates,
  searchOmdbByTitle,
  searchOpenLibraryCandidates,
  searchTmdbByTitle,
  type LookupCandidate,
  type LookupResult,
} from "@/lib/metadata-lookup";

export type UpdateItemState = {
  error?: string;
};

export type MetadataLookupState = {
  error?: string;
  result?: {
    title: string;
    year?: string;
    creators?: string;
    coverImageUrl?: string;
    isbn?: string;
  };
};

export type SearchState = {
  error?: string;
  candidates?: LookupCandidate[];
};

function toLookupState(match: LookupResult | null): MetadataLookupState {
  if (!match) return { error: "Couldn't load details for that match." };
  return {
    result: {
      title: match.title,
      year: match.year,
      creators: match.creators,
      coverImageUrl: match.coverImageUrl,
      isbn: match.isbn,
    },
  };
}

export async function searchOpenLibraryAction(title: string): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const candidates = await searchOpenLibraryCandidates(trimmedTitle);
  if (!candidates.length) return { error: "No matches found on Open Library." };
  return { candidates };
}

export async function searchMusicBrainzAction(title: string): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const candidates = await searchMusicBrainzCandidates(trimmedTitle);
  if (!candidates.length) return { error: "No matches found on MusicBrainz." };
  return { candidates };
}

export async function searchHardcoverAction(title: string, isbn: string): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle && !isbn.trim()) return { error: "Enter a title first." };

  const candidates = await searchHardcoverCandidates(trimmedTitle, isbn.trim() || undefined);
  if (!candidates.length) {
    return { error: "No matches found on Hardcover. Is the API key configured on Settings?" };
  }
  return { candidates };
}

export async function searchItunesAction(
  title: string,
  category: "movie" | "music" | "book"
): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const candidates = await searchItunesCandidates(trimmedTitle, category);
  if (!candidates.length) return { error: "No matches found on iTunes." };
  return { candidates };
}

export async function searchOmdbAction(title: string, year: string): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const candidates = await searchOmdbByTitle(trimmedTitle, year.trim() || undefined);
  if (!candidates.length) {
    return { error: "No matches found on OMDb. Is the API key configured on Settings?" };
  }
  return { candidates };
}

export async function selectOmdbAction(
  imdbId: string,
  format: "dvd" | "bluray" = "dvd"
): Promise<MetadataLookupState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  return toLookupState(await getOmdbDetailById(imdbId, format));
}

export async function searchTmdbAction(title: string, year: string): Promise<SearchState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const candidates = await searchTmdbByTitle(trimmedTitle, year.trim() || undefined);
  if (!candidates.length) {
    return { error: "No matches found on TMDB. Is the API key configured on Settings?" };
  }
  return { candidates };
}

export async function selectTmdbAction(
  tmdbId: string,
  format: "dvd" | "bluray" = "dvd"
): Promise<MetadataLookupState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  return toLookupState(await getTmdbDetailById(tmdbId, format));
}

export async function updateItemAction(
  itemId: string,
  _prevState: UpdateItemState | undefined,
  formData: FormData
): Promise<UpdateItemState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const category = formData.get("category");
  if (typeof category !== "string" || !categories.includes(category as Category)) {
    return { error: "Invalid category." };
  }
  const validFormats = categoryFormats[category as Category];
  const formats = formData
    .getAll("formats")
    .filter((f): f is string => typeof f === "string" && validFormats.includes(f));

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const creators = String(formData.get("creators") ?? "").trim() || null;
  const year = String(formData.get("year") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const isbn = String(formData.get("isbn") ?? "").trim() || null;
  const from = String(formData.get("from") ?? "").trim();
  const redirectTo = from.startsWith("/") && !from.startsWith("//") ? from : "/";

  await db
    .update(items)
    .set({
      category,
      formats,
      barcode,
      isbn,
      title,
      subtitle,
      creators,
      year,
      coverImageUrl,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));

  revalidatePath("/");
  redirect(redirectTo);
}
