import type { Category } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export type LookupResult = {
  category: Category;
  formats: string[];
  title: string;
  subtitle?: string;
  creators?: string;
  year?: string;
  coverImageUrl?: string;
  isbn?: string;
  metadataSource: string;
  rawMetadata: unknown;
};

// A row in a search-results picker. Sources whose search response already
// carries everything we need (Open Library, MusicBrainz) set `result`
// directly; sources whose search is lightweight (OMDb, TMDB) leave it
// unset and a follow-up detail fetch (keyed by `id`) resolves it once the
// user actually picks that candidate — avoiding a detail call per row.
export type LookupCandidate = {
  id: string;
  title: string;
  year?: string;
  thumbnailUrl?: string;
  result?: LookupResult;
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
    category: "book",
    formats: [],
    title: book.title,
    subtitle: book.subtitle,
    creators: book.authors?.map((author) => author.name).join(", "),
    year: extractYear(book.publish_date),
    coverImageUrl: book.cover?.medium ?? book.cover?.large ?? book.cover?.small,
    isbn,
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

export async function searchOpenLibraryCandidates(rawTitle: string): Promise<LookupCandidate[]> {
  const title = rawTitle.trim();
  if (!title) return [];

  const params = new URLSearchParams({ title, limit: "5" });
  const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: OpenLibrarySearchDoc[] };
  return (data.docs ?? []).map((doc, index) => {
    const coverImageUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined;
    const year = doc.first_publish_year ? String(doc.first_publish_year) : undefined;
    return {
      id: `openlibrary-${index}`,
      title: doc.title,
      year,
      thumbnailUrl: coverImageUrl,
      result: {
        category: "book",
        formats: [],
        title: doc.title,
        creators: doc.author_name?.join(", "),
        year,
        coverImageUrl,
        metadataSource: "openlibrary",
        rawMetadata: doc,
      },
    };
  });
}

// Hardcover's API key is a personal access token from the user's own
// hardcover.app account (Settings > API), not an app-registration key —
// their docs show it pasted straight into the Authorization header, so
// accept it with or without a "Bearer " prefix already on it.
async function hardcoverAuthHeader(): Promise<string | undefined> {
  const apiKey = (await getSetting("hardcoverApiKey")) || process.env.HARDCOVER_API_KEY;
  if (!apiKey) return undefined;
  const trimmed = apiKey.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`;
}

type HardcoverBook = {
  title: string;
  release_date?: string;
  isbn_10?: string;
  isbn_13?: string;
  contributions?: { author?: { name: string } }[];
};

async function queryHardcover(
  query: string,
  variables: Record<string, unknown>
): Promise<HardcoverBook[]> {
  const authHeader = await hardcoverAuthHeader();
  if (!authHeader) return [];

  const res = await fetch("https://api.hardcover.app/v1/graphql", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { data?: { books?: HardcoverBook[] }; errors?: unknown };
  if (data.errors || !data.data) return [];
  return data.data.books ?? [];
}

const HARDCOVER_BOOKS_QUERY = `
  query SearchBooks($pattern: String!) {
    books(where: { title: { _ilike: $pattern } }, limit: 5, order_by: { users_count: desc }) {
      title
      release_date
      isbn_10
      isbn_13
      contributions {
        author {
          name
        }
      }
    }
  }
`;

const HARDCOVER_BY_ISBN_QUERY = `
  query BookByIsbn($isbn: String!) {
    books(
      where: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] }
      limit: 5
    ) {
      title
      release_date
      isbn_10
      isbn_13
      contributions {
        author {
          name
        }
      }
    }
  }
`;

function hardcoverBookToCandidate(book: HardcoverBook, index: number): LookupCandidate {
  const year = extractYear(book.release_date);
  const isbn = book.isbn_13 || book.isbn_10;
  const creators = book.contributions
    ?.map((c) => c.author?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");
  return {
    id: isbn || `hardcover-${index}`,
    title: book.title,
    year,
    result: {
      category: "book",
      formats: [],
      title: book.title,
      creators: creators || undefined,
      year,
      isbn,
      metadataSource: "hardcover",
      rawMetadata: book,
    },
  };
}

// Hardcover's own cover art coverage is inconsistent, so this deliberately
// doesn't request an image field — iTunes covers that gap instead (see
// searchItunesCandidates below).
export async function searchHardcoverCandidates(
  rawTitle: string,
  isbn?: string
): Promise<LookupCandidate[]> {
  const trimmedIsbn = isbn?.trim();
  if (trimmedIsbn) {
    const books = await queryHardcover(HARDCOVER_BY_ISBN_QUERY, { isbn: trimmedIsbn });
    if (books.length) return books.map(hardcoverBookToCandidate);
  }

  const title = rawTitle.trim();
  if (!title) return [];
  const books = await queryHardcover(HARDCOVER_BOOKS_QUERY, { pattern: `%${title}%` });
  return books.map(hardcoverBookToCandidate);
}

const ITUNES_ENTITY: Record<"movie" | "music" | "book", string> = {
  movie: "movie",
  music: "album",
  book: "ebook",
};

type ItunesResult = {
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
};

// iTunes' cover art is deliberately the only thing pulled from these
// results — see the `coverOnly` flag on MetadataSource in item-form.tsx —
// since Apple's title/artist matching is much less reliable than the
// category-specific sources.
export async function searchItunesCandidates(
  rawTitle: string,
  category: "movie" | "music" | "book"
): Promise<LookupCandidate[]> {
  const title = rawTitle.trim();
  if (!title) return [];

  const params = new URLSearchParams({
    term: title,
    entity: ITUNES_ENTITY[category],
    limit: "5",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: ItunesResult[] };
  return (data.results ?? []).map((entry) => {
    const name = entry.collectionName || entry.trackName || title;
    // Apple's default artwork is a tiny 100x100 thumbnail; the URL scheme
    // lets you swap in a larger size by replacing that segment.
    const artworkUrl = entry.artworkUrl100?.replace("100x100bb", "600x600bb");
    return {
      id: String(entry.trackId ?? entry.collectionId ?? name),
      title: name,
      year: extractYear(entry.releaseDate),
      thumbnailUrl: artworkUrl,
      result: {
        category,
        formats: [],
        title: name,
        coverImageUrl: artworkUrl,
        metadataSource: "itunes",
        rawMetadata: entry,
      },
    };
  });
}

type UpcItem = {
  title: string;
  brand?: string;
  category?: string;
  images?: string[];
};

function categorizeUpc(upcCategory: string | undefined): { category: Category; format?: string } {
  const lower = (upcCategory ?? "").toLowerCase();
  if (lower.includes("blu-ray") || lower.includes("bluray") || lower.includes("blu ray")) {
    return { category: "movie", format: "bluray" };
  }
  if (lower.includes("movie") || lower.includes("dvd") || lower.includes("video")) {
    return { category: "movie", format: "dvd" };
  }
  if (lower.includes("music") || lower.includes("cd")) {
    return { category: "music", format: "cd" };
  }
  return { category: "other" };
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
  format: "dvd" | "bluray" = "dvd"
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
    category: "movie",
    formats: [format],
    title: data.Title,
    creators: data.Director && data.Director !== "N/A" ? data.Director : undefined,
    year: data.Year,
    coverImageUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
    metadataSource: "omdb",
    rawMetadata: data,
  };
}

type OmdbSearchEntry = {
  Title: string;
  Year?: string;
  imdbID: string;
  Poster?: string;
};

// OMDb's search endpoint (`s=`) is lightweight — no director — so results
// stay candidates until getOmdbDetailById resolves the one the user picks.
export async function searchOmdbByTitle(
  rawTitle: string,
  knownYear?: string
): Promise<LookupCandidate[]> {
  const apiKey = (await getSetting("omdbApiKey")) || process.env.OMDB_API_KEY;
  if (!apiKey) return [];

  const title = cleanMovieTitle(rawTitle);
  if (!title) return [];

  const params = new URLSearchParams({ s: title, type: "movie", apikey: apiKey });
  const year = knownYear || extractYear(rawTitle);
  if (year) params.set("y", year);

  const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as { Search?: OmdbSearchEntry[]; Response: "True" | "False" };
  if (data.Response !== "True") return [];

  return (data.Search ?? []).slice(0, 5).map((entry) => ({
    id: entry.imdbID,
    title: entry.Title,
    year: entry.Year,
    thumbnailUrl: entry.Poster && entry.Poster !== "N/A" ? entry.Poster : undefined,
  }));
}

export async function getOmdbDetailById(
  imdbId: string,
  format: "dvd" | "bluray" = "dvd"
): Promise<LookupResult | null> {
  const apiKey = (await getSetting("omdbApiKey")) || process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ i: imdbId, apikey: apiKey });
  const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return null;

  const data = (await res.json()) as OmdbMovie;
  if (data.Response !== "True") return null;

  return {
    category: "movie",
    formats: [format],
    title: data.Title,
    creators: data.Director && data.Director !== "N/A" ? data.Director : undefined,
    year: data.Year,
    coverImageUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
    metadataSource: "omdb",
    rawMetadata: data,
  };
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

type TmdbSearchResult = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
};

export async function searchTmdbByTitle(
  rawTitle: string,
  knownYear?: string
): Promise<LookupCandidate[]> {
  const apiKey = (await getSetting("tmdbApiKey")) || process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  const title = cleanMovieTitle(rawTitle);
  if (!title) return [];

  const params = new URLSearchParams({ query: title, api_key: apiKey });
  const year = knownYear || extractYear(rawTitle);
  if (year) params.set("primary_release_year", year);

  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: TmdbSearchResult[] };
  return (data.results ?? []).slice(0, 5).map((entry) => ({
    id: String(entry.id),
    title: entry.title,
    year: extractYear(entry.release_date),
    thumbnailUrl: entry.poster_path ? `${TMDB_IMAGE_BASE}${entry.poster_path}` : undefined,
  }));
}

type TmdbMovieDetail = {
  title: string;
  release_date?: string;
  poster_path?: string | null;
  credits?: { crew?: { job: string; name: string }[] };
};

export async function getTmdbDetailById(
  tmdbId: string,
  format: "dvd" | "bluray" = "dvd"
): Promise<LookupResult | null> {
  const apiKey = (await getSetting("tmdbApiKey")) || process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ api_key: apiKey, append_to_response: "credits" });
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as TmdbMovieDetail;
  const directors = data.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name);

  return {
    category: "movie",
    formats: [format],
    title: data.title,
    creators: directors?.length ? directors.join(", ") : undefined,
    year: extractYear(data.release_date),
    coverImageUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : undefined,
    metadataSource: "tmdb",
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
    // MusicBrainz doesn't reliably tell us the physical format, so default
    // to CD — the most common case — and let the user flip it to Vinyl.
    category: "music",
    formats: ["cd"],
    title: release.title,
    creators: release["artist-credit"]?.map((credit) => credit.name).join(", ") || undefined,
    year: extractYear(release.date),
    coverImageUrl,
    metadataSource: "musicbrainz",
    rawMetadata: release,
  };
}

export async function searchMusicBrainzCandidates(rawTitle: string): Promise<LookupCandidate[]> {
  const title = rawTitle.trim();
  if (!title) return [];

  const params = new URLSearchParams({ query: `release:"${title}"`, fmt: "json", limit: "5" });
  const res = await fetch(`https://musicbrainz.org/ws/2/release/?${params.toString()}`, {
    cache: "no-store",
    headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { releases?: MusicBrainzRelease[] };
  const releases = data.releases ?? [];

  return Promise.all(
    releases.map(async (release) => {
      const coverImageUrl = await lookupMusicBrainzCoverArt(release.id);
      const year = extractYear(release.date);
      return {
        id: release.id,
        title: release.title,
        year,
        thumbnailUrl: coverImageUrl,
        result: {
          // MusicBrainz doesn't reliably tell us the physical format, so
          // default to CD — the most common case — and let the user flip
          // it to Vinyl.
          category: "music" as const,
          formats: ["cd"],
          title: release.title,
          creators: release["artist-credit"]?.map((credit) => credit.name).join(", ") || undefined,
          year,
          coverImageUrl,
          metadataSource: "musicbrainz",
          rawMetadata: release,
        },
      };
    })
  );
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

  const { category, format } = categorizeUpc(item.category);
  if (category === "movie" && (format === "dvd" || format === "bluray")) {
    const movie = await lookupOmdbByTitle(item.title, undefined, format);
    if (movie) return movie;
  }
  if (category === "music") {
    const album = await lookupMusicBrainzByTitle(item.title);
    if (album) return album;
  }

  return {
    category,
    formats: format ? [format] : [],
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
