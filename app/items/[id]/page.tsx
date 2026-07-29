import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites, items, itemTags, type Category } from "@/lib/db/schema";
import { categoryLabels, formatLabel } from "@/lib/categories";
import {
  formatResolution,
  formatRuntime,
  getMovieDetail,
  type PlexMovieDetail,
} from "@/lib/plex";
import { CoverImage } from "@/app/cover-image";
import { addTagAction, removeTagAction, toggleFavoriteAction } from "./actions";

function formatWatchCount(count: number): string {
  return count === 0 ? "Never watched" : `Watched ${count} time${count === 1 ? "" : "s"}`;
}

function formatWatchedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReleaseDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function formatFileSize(bytes: number | undefined): string | undefined {
  if (!bytes) return undefined;
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function formatRating(rating: number | undefined): string | undefined {
  if (rating === undefined) return undefined;
  return rating.toFixed(1);
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function WatchHistory({ events }: { events: { id: string; viewedAt: Date; watchedBy: string | null }[] }) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">
        Watch history ({events.length})
      </dt>
      <dd>
        <ul className="flex flex-col gap-1 text-sm max-h-64 overflow-y-auto">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-4">
              <span>{formatWatchedAt(event.viewedAt)}</span>
              {event.watchedBy && (
                <span className="text-neutral-500 shrink-0">{event.watchedBy}</span>
              )}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  const session = await auth();
  const userId = session?.user.id ?? "";

  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: {
      addedBy: { columns: { name: true } },
      watchEvents: {
        orderBy: (watchEvents, { desc }) => [desc(watchEvents.viewedAt)],
        limit: 50,
      },
      favorites: { where: eq(favorites.userId, userId) },
      tags: { where: eq(itemTags.userId, userId), orderBy: (tags, { asc }) => [asc(tags.tag)] },
    },
  });
  if (!item) notFound();

  const isFavorite = item.favorites.length > 0;

  const plexDetail: PlexMovieDetail | undefined =
    item.category === "movie" && item.formats.includes("digital") && item.plexRatingKey
      ? await getMovieDetail(item.plexRatingKey)
      : undefined;
  const media = plexDetail?.Media?.[0];
  const part = media?.Part?.[0];
  const runtime = formatRuntime(plexDetail?.duration);
  const resolution = formatResolution(media?.videoResolution);
  const releaseDate = formatReleaseDate(plexDetail?.originallyAvailableAt);
  const fileSize = formatFileSize(part?.size);
  const categoryLabel = categoryLabels[item.category as Category] ?? item.category;
  const formatsLabel = item.formats.length ? item.formats.map(formatLabel).join(", ") : undefined;
  const seriesLabel = item.series
    ? item.seriesNumber
      ? `${item.series} #${item.seriesNumber}`
      : item.series
    : undefined;

  const favoriteButton = (
    <form action={toggleFavoriteAction.bind(null, item.id)}>
      <button
        type="submit"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={`text-2xl leading-none ${
          isFavorite
            ? "text-amber-500"
            : "text-neutral-300 dark:text-neutral-700 hover:text-amber-500"
        } transition-colors`}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </form>
  );

  const footer = (
    <>
      <div className="flex flex-col gap-2">
        <dt className="text-xs uppercase tracking-wide text-neutral-500">Your tags</dt>
        <dd className="flex flex-wrap gap-2 items-center">
          {item.tags.map((t) => (
            <form key={t.id} action={removeTagAction.bind(null, item.id, t.tag)}>
              <button
                type="submit"
                className="rounded-full border px-2 py-0.5 text-xs flex items-center gap-1 hover:border-red-400 hover:text-red-600 transition-colors"
              >
                {t.tag}
                <span aria-hidden>×</span>
              </button>
            </form>
          ))}
          <form action={addTagAction.bind(null, item.id)} className="flex items-center gap-1">
            <input
              type="text"
              name="tag"
              placeholder="Add tag"
              maxLength={50}
              required
              className="border rounded-full px-2 py-0.5 text-xs bg-transparent w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            />
            <button
              type="submit"
              className="text-xs underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
            >
              Add
            </button>
          </form>
        </dd>
      </div>

      {item.notes && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Notes</dt>
          <dd className="whitespace-pre-wrap">{item.notes}</dd>
        </div>
      )}

      {item.isbn && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">ISBN</dt>
          <dd>{item.isbn}</dd>
        </div>
      )}

      {item.barcode && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Barcode</dt>
          <dd>{item.barcode}</dd>
        </div>
      )}

      <p className="text-xs text-neutral-500">Added by {item.addedBy?.name ?? "Unknown"}</p>

      <div className="flex items-center gap-4">
        <Link
          href={`/items/${item.id}/edit?from=${encodeURIComponent(backHref)}`}
          className="underline text-sm"
        >
          Edit
        </Link>
        <Link href={`/items/${item.id}/merge`} className="underline text-sm">
          Merge
        </Link>
        <Link
          href={`/items/${item.id}/delete?from=${encodeURIComponent(backHref)}`}
          className="underline text-sm text-red-600 hover:text-red-700 transition-colors"
        >
          Delete
        </Link>
        <Link href={backHref} className="underline text-sm">
          Back to catalog
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex-1 p-6">
      {/* Mobile layout: current fields + watch history, unchanged. */}
      <div className="md:hidden flex flex-col gap-6 max-w-lg">
        <div className="flex gap-4">
          {item.coverImageUrl ? (
            <CoverImage
              src={item.coverImageUrl}
              alt={item.title}
              className="w-24 h-32 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-900"
            />
          ) : (
            <div className="w-24 h-32 rounded shrink-0 bg-neutral-100 dark:bg-neutral-900" />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              {categoryLabel}
              {formatsLabel && ` · ${formatsLabel}`}
              {item.year && ` · ${item.year}`}
            </span>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{item.title}</h1>
              {favoriteButton}
            </div>
            {item.subtitle && <p className="text-neutral-500">{item.subtitle}</p>}
            {item.creators && <p className="text-sm text-neutral-500">{item.creators}</p>}
            {seriesLabel && <p className="text-sm text-neutral-500">{seriesLabel}</p>}
          </div>
        </div>

        {plexDetail?.summary && <p className="text-sm">{plexDetail.summary}</p>}

        {(item.plexWatchCount !== null || plexDetail) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {item.plexWatchCount !== null && (
              <DetailField label="Plex">{formatWatchCount(item.plexWatchCount)}</DetailField>
            )}
            {plexDetail?.Genre?.length ? (
              <div className="col-span-2">
                <DetailField label="Genre">
                  {plexDetail.Genre.map((g) => g.tag).join(", ")}
                </DetailField>
              </div>
            ) : null}
            {runtime && <DetailField label="Runtime">{runtime}</DetailField>}
            {plexDetail?.contentRating && (
              <DetailField label="Content Rating">{plexDetail.contentRating}</DetailField>
            )}
            {resolution && <DetailField label="Resolution">{resolution}</DetailField>}
            {media?.container && (
              <DetailField label="File Type">
                <span className="uppercase">{media.container}</span>
              </DetailField>
            )}
            {media?.videoCodec && (
              <DetailField label="Video Codec">
                <span className="uppercase">{media.videoCodec}</span>
              </DetailField>
            )}
            {media?.audioCodec && (
              <DetailField label="Audio Codec">
                <span className="uppercase">{media.audioCodec}</span>
              </DetailField>
            )}
            {media?.aspectRatio && (
              <DetailField label="Aspect Ratio">{media.aspectRatio.toFixed(2)}:1</DetailField>
            )}
          </dl>
        )}

        <WatchHistory events={item.watchEvents} />

        {footer}
      </div>

      {/* Desktop layout: expanded Plex metadata alongside a larger cover. */}
      <div className="hidden md:flex gap-10 max-w-4xl">
        <div className="shrink-0">
          {item.coverImageUrl ? (
            <CoverImage
              src={item.coverImageUrl}
              alt={item.title}
              className="w-64 h-96 object-cover rounded-lg shadow bg-neutral-100 dark:bg-neutral-900"
            />
          ) : (
            <div className="w-64 h-96 rounded-lg shadow bg-neutral-100 dark:bg-neutral-900" />
          )}
        </div>

        <div className="flex flex-col gap-6 min-w-0 flex-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              {categoryLabel}
              {formatsLabel && ` · ${formatsLabel}`}
              {item.year && ` · ${item.year}`}
              {plexDetail?.studio && ` · ${plexDetail.studio}`}
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold">{item.title}</h1>
              {favoriteButton}
            </div>
            {item.subtitle && <p className="text-lg text-neutral-500">{item.subtitle}</p>}
            {item.creators && <p className="text-sm text-neutral-500">{item.creators}</p>}
            {seriesLabel && <p className="text-sm text-neutral-500">{seriesLabel}</p>}
            {plexDetail?.tagline && (
              <p className="text-sm italic text-neutral-500">{plexDetail.tagline}</p>
            )}
          </div>

          {plexDetail?.summary && <p className="text-sm leading-relaxed">{plexDetail.summary}</p>}

          {(item.plexWatchCount !== null || plexDetail) && (
            <dl className="grid grid-cols-4 gap-x-6 gap-y-4 text-sm">
              {item.plexWatchCount !== null && (
                <DetailField label="Plex">{formatWatchCount(item.plexWatchCount)}</DetailField>
              )}
              {releaseDate && <DetailField label="Released">{releaseDate}</DetailField>}
              {runtime && <DetailField label="Runtime">{runtime}</DetailField>}
              {plexDetail?.contentRating && (
                <DetailField label="Content Rating">{plexDetail.contentRating}</DetailField>
              )}
              {formatRating(plexDetail?.audienceRating) && (
                <DetailField label="Audience Rating">
                  {formatRating(plexDetail?.audienceRating)}
                </DetailField>
              )}
              {formatRating(plexDetail?.rating) && (
                <DetailField label="Critic Rating">{formatRating(plexDetail?.rating)}</DetailField>
              )}
              {plexDetail?.Genre?.length ? (
                <div className="col-span-2">
                  <DetailField label="Genre">
                    {plexDetail.Genre.map((g) => g.tag).join(", ")}
                  </DetailField>
                </div>
              ) : null}
              {plexDetail?.Country?.length ? (
                <DetailField label="Country">
                  {plexDetail.Country.map((c) => c.tag).join(", ")}
                </DetailField>
              ) : null}
              {plexDetail?.Writer?.length ? (
                <div className="col-span-2">
                  <DetailField label="Writer">
                    {plexDetail.Writer.map((w) => w.tag).join(", ")}
                  </DetailField>
                </div>
              ) : null}
              {plexDetail?.Collection?.length ? (
                <DetailField label="Collection">
                  {plexDetail.Collection.map((c) => c.tag).join(", ")}
                </DetailField>
              ) : null}
              {plexDetail?.Role?.length ? (
                <div className="col-span-4">
                  <DetailField label="Cast">
                    {plexDetail.Role.slice(0, 8)
                      .map((r) => r.tag)
                      .join(", ")}
                  </DetailField>
                </div>
              ) : null}
              {resolution && <DetailField label="Resolution">{resolution}</DetailField>}
              {media?.container && (
                <DetailField label="File Type">
                  <span className="uppercase">{media.container}</span>
                </DetailField>
              )}
              {media?.videoCodec && (
                <DetailField label="Video Codec">
                  <span className="uppercase">{media.videoCodec}</span>
                </DetailField>
              )}
              {media?.videoFrameRate && (
                <DetailField label="Frame Rate">{media.videoFrameRate}</DetailField>
              )}
              {media?.audioCodec && (
                <DetailField label="Audio Codec">
                  <span className="uppercase">{media.audioCodec}</span>
                </DetailField>
              )}
              {media?.audioChannels && (
                <DetailField label="Audio Channels">{media.audioChannels}</DetailField>
              )}
              {media?.aspectRatio && (
                <DetailField label="Aspect Ratio">{media.aspectRatio.toFixed(2)}:1</DetailField>
              )}
              {fileSize && <DetailField label="File Size">{fileSize}</DetailField>}
            </dl>
          )}

          <WatchHistory events={item.watchEvents} />

          {footer}
        </div>
      </div>
    </div>
  );
}
