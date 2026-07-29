export const PLEX_METADATA_SOURCE = "plex";

const PAGE_SIZE = 200;

export type PlexMovie = {
  ratingKey: string;
  title: string;
  year?: number;
  viewCount?: number;
  thumb?: string;
  Director?: { tag: string }[];
  guid?: string;
};

type PlexMovieListResponse = {
  MediaContainer: {
    totalSize: number;
    Metadata?: PlexMovie[];
  };
};

function plexConnection(): { baseUrl: string; token: string } {
  const baseUrl = process.env.PLEX_SERVER_URL;
  const token = process.env.PLEX_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("PLEX_SERVER_URL and PLEX_TOKEN must be set.");
  }
  return { baseUrl, token };
}

export async function getAllMoviesInSection(sectionKey: string): Promise<PlexMovie[]> {
  const { baseUrl, token } = plexConnection();
  const movies: PlexMovie[] = [];
  let start = 0;
  let totalSize = Infinity;

  while (start < totalSize) {
    const params = new URLSearchParams({
      type: "1",
      "X-Plex-Container-Start": String(start),
      "X-Plex-Container-Size": String(PAGE_SIZE),
    });
    const res = await fetch(
      `${baseUrl}/library/sections/${sectionKey}/all?${params.toString()}`,
      {
        headers: { "X-Plex-Token": token, Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Plex request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as PlexMovieListResponse;
    totalSize = data.MediaContainer.totalSize;
    const page = data.MediaContainer.Metadata ?? [];
    movies.push(...page);
    start += page.length;

    if (page.length === 0) break;
  }

  return movies;
}

export function plexCoverUrl(thumb: string | undefined): string | undefined {
  if (!thumb) return undefined;
  const { baseUrl, token } = plexConnection();
  return `${baseUrl}${thumb}?X-Plex-Token=${token}`;
}

export type PlexMediaPart = {
  file?: string;
  container?: string;
  size?: number;
};

export type PlexMedia = {
  videoResolution?: string;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  aspectRatio?: number;
  bitrate?: number;
  videoFrameRate?: string;
  Part?: PlexMediaPart[];
};

export type PlexTag = { tag: string };
export type PlexCastMember = { tag: string; role?: string };

export type PlexMovieDetail = PlexMovie & {
  summary?: string;
  tagline?: string;
  studio?: string;
  originallyAvailableAt?: string;
  duration?: number;
  contentRating?: string;
  audienceRating?: number;
  rating?: number;
  Genre?: PlexTag[];
  Country?: PlexTag[];
  Writer?: PlexTag[];
  Role?: PlexCastMember[];
  Collection?: PlexTag[];
  Media?: PlexMedia[];
};

type PlexMetadataResponse = {
  MediaContainer: {
    Metadata?: PlexMovieDetail[];
  };
};

// Unlike getAllMoviesInSection (used by the cron sync, which requires Plex
// env vars up front and should fail loudly), this is called from a request-time
// page render — Plex being unconfigured or unreachable should degrade to
// "no extra detail" rather than break the page.
export async function getMovieDetail(ratingKey: string): Promise<PlexMovieDetail | undefined> {
  const baseUrl = process.env.PLEX_SERVER_URL;
  const token = process.env.PLEX_TOKEN;
  if (!baseUrl || !token) return undefined;

  try {
    // Plex has been observed taking 60+ seconds on a "cold" item (likely disk
    // spin-up / on-demand analysis) — bail out fast rather than stalling the
    // page render, and cache successes for a day so a warmed item stays fast.
    const res = await fetch(`${baseUrl}/library/metadata/${ratingKey}`, {
      headers: { "X-Plex-Token": token, Accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return undefined;

    const data = (await res.json()) as PlexMetadataResponse;
    return data.MediaContainer.Metadata?.[0];
  } catch {
    return undefined;
  }
}

export type PlexWatchHistoryEntry = {
  historyKey: string;
  ratingKey: string;
  viewedAt: number;
  accountID: number;
};

type PlexHistoryResponse = {
  MediaContainer: {
    totalSize: number;
    Metadata?: PlexWatchHistoryEntry[];
  };
};

export async function getWatchHistoryForSection(
  sectionKey: string
): Promise<PlexWatchHistoryEntry[]> {
  const { baseUrl, token } = plexConnection();
  const entries: PlexWatchHistoryEntry[] = [];
  let start = 0;
  let totalSize = Infinity;

  while (start < totalSize) {
    const params = new URLSearchParams({
      librarySectionID: sectionKey,
      "X-Plex-Container-Start": String(start),
      "X-Plex-Container-Size": String(PAGE_SIZE),
    });
    const res = await fetch(
      `${baseUrl}/status/sessions/history/all?${params.toString()}`,
      {
        headers: { "X-Plex-Token": token, Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Plex history request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as PlexHistoryResponse;
    totalSize = data.MediaContainer.totalSize;
    const page = data.MediaContainer.Metadata ?? [];
    entries.push(...page);
    start += page.length;

    if (page.length === 0) break;
  }

  return entries;
}

// historyKey looks like "/status/sessions/history/33" — store just the
// trailing id since it's the stable, unique part.
export function historyEventId(historyKey: string): string {
  return historyKey.replace("/status/sessions/history/", "");
}

type PlexAccountsResponse = {
  MediaContainer: {
    Account?: { id: number; name: string }[];
  };
};

export async function getPlexAccountNames(): Promise<Map<number, string>> {
  const { baseUrl, token } = plexConnection();
  const res = await fetch(`${baseUrl}/accounts`, {
    headers: { "X-Plex-Token": token, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Plex accounts request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PlexAccountsResponse;
  const names = new Map<number, string>();
  for (const account of data.MediaContainer.Account ?? []) {
    if (account.name) names.set(account.id, account.name);
  }
  return names;
}

export function formatRuntime(ms: number | undefined): string | undefined {
  if (!ms) return undefined;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatResolution(resolution: string | undefined): string | undefined {
  if (!resolution) return undefined;
  if (resolution === "4k") return "4K";
  if (resolution === "sd") return "SD";
  return `${resolution}p`;
}
