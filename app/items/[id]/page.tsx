import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { items, type MediaType } from "@/lib/db/schema";
import { mediaTypeLabels } from "@/lib/media-types";
import { formatResolution, formatRuntime, getMovieDetail } from "@/lib/plex";

function formatWatchCount(count: number): string {
  return count === 0 ? "Never watched" : `Watched ${count} time${count === 1 ? "" : "s"}`;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: { addedBy: { columns: { name: true } } },
  });
  if (!item) notFound();

  const plexDetail =
    item.mediaType === "digital" && item.plexRatingKey
      ? await getMovieDetail(item.plexRatingKey)
      : undefined;
  const media = plexDetail?.Media?.[0];
  const runtime = formatRuntime(plexDetail?.duration);
  const resolution = formatResolution(media?.videoResolution);

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-lg">
      <div className="flex gap-4">
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt=""
            className="w-24 h-32 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-900"
          />
        ) : (
          <div className="w-24 h-32 rounded shrink-0 bg-neutral-100 dark:bg-neutral-900" />
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            {mediaTypeLabels[item.mediaType as MediaType] ?? item.mediaType}
            {item.year && ` · ${item.year}`}
          </span>
          <h1 className="text-xl font-semibold">{item.title}</h1>
          {item.subtitle && <p className="text-neutral-500">{item.subtitle}</p>}
          {item.creators && <p className="text-sm text-neutral-500">{item.creators}</p>}
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

      {item.notes && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Notes</dt>
          <dd className="whitespace-pre-wrap">{item.notes}</dd>
        </div>
      )}

      {item.barcode && (
        <div className="flex flex-col gap-1">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Barcode</dt>
          <dd>{item.barcode}</dd>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Added by {item.addedBy?.name ?? "Unknown"}
      </p>

      <div className="flex items-center gap-4">
        <Link href={`/items/${item.id}/edit`} className="underline text-sm">
          Edit
        </Link>
        <Link href="/" className="underline text-sm">
          Back to catalog
        </Link>
      </div>
    </div>
  );
}
