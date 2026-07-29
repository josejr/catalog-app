import type { MediaType } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export type LookupResult = {
  mediaType: MediaType;
  title: string;
  subtitle?: string;
  creators?: string;
  year?: string;
  coverImageUrl?: string;
  metadataSource: string;
  rawMetadata: unknown;
};

function isIsbn(barcode: string): boolean {
  const digits = barcode.replace(/[^0-9Xx]/g, "");
  return (
    digits.length === 10 ||
    (digits.length === 13 && (digits.startsWith("978") || digits.startsWith("979")))
  );
}

function extractYear(dateStr: string | undefined): string | undefined {
  return dateStr?.match(/\d{4}/)?.[0];
}

type OpenLibraryAuthor = { name: string };
type OpenLibraryBook = {
  title: string;
  subtitle?: string;
  authors?: OpenLibraryAuthor[];
  publish_date?: string;
  cover?: { small?: string; medium?: string; large?: string };
};

async function lookupIsbn(isbn: string): Promise<LookupResult | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, OpenLibraryBook>;
  const book = data[`ISBN:${isbn}`];
  if (!book) return null;

  return {
    mediaType: "book",
    title: book.title,
    subtitle: book.subtitle,
    creators: book.authors?.map((author) => author.name).join(", "),
    year: extractYear(book.publish_date),
    coverImageUrl: book.cover?.medium ?? book.cover?.large ?? book.cover?.small,
    metadataSource: "openlibrary",
    rawMetadata: book,
  };
}

type OpenLibrarySearchDoc = {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

export async function lookupOpenLibraryByTitle(rawTitle: string): Promise<LookupResult | null> {
  const title = rawTitle.trim();
  if (!title) return null;

  const params = new URLSearchParams({ title, limit: "1" });
  const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { docs?: OpenLibrarySearchDoc[] };
  const doc = data.docs?.[0];
  if (!doc) return null;

  return {
    mediaType: "book",
    title: doc.title,
    creators: doc.author_name?.join(", "),
    year: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    coverImageUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
    metadataSource: "openlibrary",
    rawMetadata: doc,
  };
}

type UpcItem = {
  title: string;
  brand?: string;
  category?: string;
  images?: string[];
};

function mediaTypeFromCategory(category: string | undefined): MediaType {
  const lower = (category ?? "").toLowerCase();
  if (lower.includes("blu-ray") || lower.includes("bluray") || lower.includes("blu ray")) {
    return "bluray";
  }
  if (lower.includes("movie") || lower.includes("dvd") || lower.includes("video")) {
    return "dvd";
  }
  if (lower.includes("music") || lower.includes("cd")) {
    return "cd";
  }
  return "other";
}

// UPC product titles tend to carry disc-edition cruft ("The Matrix (1999)
// [Blu-ray]") that defeats OMDb's title match, so strip it before querying.
function cleanMovieTitle(title: string): string {
  return title
    .replace(/[[(].*?[\])]/g, "")
    .replace(/\b(DVD|Blu-?ray|4K|UHD|Widescreen|Full\s?Screen|Special Edition|Director'?s Cut|Region\s?\d)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

type OmdbMovie = {
  Title: string;
  Year?: string;
  Director?: string;
  Poster?: string;
  imdbID?: string;
  Response: "True" | "False";
  Error?: string;
};

export async function lookupOmdbByTitle(
  rawTitle: string,
  knownYear?: string,
  mediaType: "dvd" | "bluray" = "dvd"
): Promise<LookupResult | null> {
  const apiKey = (await getSetting("omdbApiKey")) || process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const year = knownYear || extractYear(rawTitle);
  const title = cleanMovieTitle(rawTitle);
  if (!title) return null;

  const params = new URLSearchParams({ t: title, apikey: apiKey });
  if (year) params.set("y", year);

  const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as OmdbMovie;
  if (data.Response !== "True") return null;

  return {
    mediaType,
    title: data.Title,
    creators: data.Director && data.Director !== "N/A" ? data.Director : undefined,
    year: data.Year,
    coverImageUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
    metadataSource: "omdb",
    rawMetadata: data,
  };
}

// MusicBrainz asks that clients identify themselves with a descriptive
// User-Agent; requests without one are more likely to be rate-limited.
const MUSICBRAINZ_USER_AGENT = "catalog-app/1.0 (self-hosted household media catalog)";

type MusicBrainzRelease = {
  id: string;
  title: string;
  date?: string;
  "artist-credit"?: { name: string }[];
};

async function lookupMusicBrainzCoverArt(mbid: string): Promise<string | undefined> {
  const res = await fetch(`https://coverartarchive.org/release/${mbid}`, {
    cache: "no-store",
    headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
  });
  if (!res.ok) return undefined;

  const data = (await res.json()) as {
    images?: { front?: boolean; thumbnails?: { small?: string; large?: string } }[];
  };
  const front = data.images?.find((image) => image.front) ?? data.images?.[0];
  return front?.thumbnails?.large ?? front?.thumbnails?.small;
}

export async function lookupMusicBrainzByTitle(rawTitle: string): Promise<LookupResult | null> {
  const title = rawTitle.trim();
  if (!title) return null;

  const params = new URLSearchParams({ query: `release:"${title}"`, fmt: "json", limit: "1" });
  const res = await fetch(`https://musicbrainz.org/ws/2/release/?${params.toString()}`, {
    cache: "no-store",
    headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { releases?: MusicBrainzRelease[] };
  const release = data.releases?.[0];
  if (!release) return null;

  const coverImageUrl = await lookupMusicBrainzCoverArt(release.id);

  return {
    mediaType: "cd",
    title: release.title,
    creators: release["artist-credit"]?.map((credit) => credit.name).join(", ") || undefined,
    year: extractYear(release.date),
    coverImageUrl,
    metadataSource: "musicbrainz",
    rawMetadata: release,
  };
}

async function lookupUpc(upc: string): Promise<LookupResult | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { items?: UpcItem[] };
  const item = data.items?.[0];
  if (!item) return null;

  const mediaType = mediaTypeFromCategory(item.category);
  if (mediaType === "dvd" || mediaType === "bluray") {
    const movie = await lookupOmdbByTitle(item.title, undefined, mediaType);
    if (movie) return movie;
  }
  if (mediaType === "cd") {
    const album = await lookupMusicBrainzByTitle(item.title);
    if (album) return album;
  }

  return {
    mediaType,
    title: item.title,
    creators: item.brand,
    metadataSource: "upcitemdb",
    rawMetadata: item,
  };
}

// Books are looked up by ISBN first since that's a more reliable, purpose-built
// catalog; other UPC barcodes (CDs, DVDs) fall back to a general product lookup,
// with DVDs further enriched from OMDb once upcitemdb's category hints at a movie.
export async function lookupBarcode(barcode: string): Promise<LookupResult | null> {
  if (isIsbn(barcode)) {
    const result = await lookupIsbn(barcode);
    if (result) return result;
  }
  return lookupUpc(barcode);
}
