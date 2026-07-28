import type { MediaType } from "@/lib/db/schema";

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

type UpcItem = {
  title: string;
  brand?: string;
  category?: string;
  images?: string[];
};

function mediaTypeFromCategory(category: string | undefined): MediaType {
  const lower = (category ?? "").toLowerCase();
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
  knownYear?: string
): Promise<LookupResult | null> {
  const apiKey = process.env.OMDB_API_KEY;
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
    mediaType: "dvd",
    title: data.Title,
    creators: data.Director && data.Director !== "N/A" ? data.Director : undefined,
    year: data.Year,
    coverImageUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
    metadataSource: "omdb",
    rawMetadata: data,
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
  if (mediaType === "dvd") {
    const movie = await lookupOmdbByTitle(item.title);
    if (movie) return movie;
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
