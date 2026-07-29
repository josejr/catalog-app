import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { deleteItemAction } from "./actions";

export default async function DeleteItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from && from.startsWith("/") && !from.startsWith("//") ? from : `/items/${id}`;

  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) notFound();

  const deleteWithId = deleteItemAction.bind(null, item.id);
  const isPlexLinked =
    item.category === "movie" && item.formats.includes("digital") && item.plexRatingKey;

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Delete item</h1>
      <p className="text-sm text-neutral-500">
        Permanently remove <strong className="text-foreground">{item.title}</strong> from the
        catalog? This can&rsquo;t be undone — watch history, favorites, and tags on it are
        removed too.
        {isPlexLinked &&
          " Since it's synced from Plex, it will come back the next time the Plex sync runs if it's still in your library."}
      </p>
      <form action={deleteWithId} className="flex items-center gap-4">
        <input type="hidden" name="from" value={from ?? ""} />
        <button
          type="submit"
          className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 transition-colors"
        >
          Delete permanently
        </button>
        <Link href={backHref} className="underline text-sm">
          Cancel
        </Link>
      </form>
    </div>
  );
}
