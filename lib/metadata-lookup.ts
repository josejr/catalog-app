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

async function lookupUpc(upc: string): Promise<LookupResult | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { items?: UpcItem[] };
  const item = data.items?.[0];
  if (!item) return null;

  return {
    mediaType: mediaTypeFromCategory(item.category),
    title: item.title,
    creators: item.brand,
    metadataSource: "upcitemdb",
    rawMetadata: item,
  };
}

// Books are looked up by ISBN first since that's a more reliable, purpose-built
// catalog; other UPC barcodes (CDs, DVDs) fall back to a general product lookup.
export async function lookupBarcode(barcode: string): Promise<LookupResult | null> {
  if (isIsbn(barcode)) {
    const result = await lookupIsbn(barcode);
    if (result) return result;
  }
  return lookupUpc(barcode);
}
