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
  aspectRatio?: number;
  bitrate?: number;
  Part?: PlexMediaPart[];
};

export type PlexMovieDetail = PlexMovie & {
  summary?: string;
  duration?: number;
  contentRating?: string;
  audienceRating?: number;
  rating?: number;
  Genre?: { tag: string }[];
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
    const res = await fetch(`${baseUrl}/library/metadata/${ratingKey}`, {
      headers: { "X-Plex-Token": token, Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return undefined;

    const data = (await res.json()) as PlexMetadataResponse;
    return data.MediaContainer.Metadata?.[0];
  } catch {
    return undefined;
  }
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
