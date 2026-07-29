import { and, asc, eq, ilike, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { items, type Category } from "@/lib/db/schema";
import { categoryLabels } from "@/lib/categories";
import { MergeForm } from "./merge-form";

export default async function MergeItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;

  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: { addedBy: { columns: { name: true } } },
  });
  if (!item) notFound();

  const query = q?.trim();
  const conditions = [
    eq(items.addedByUserId, item.addedByUserId),
    eq(items.category, item.category),
    ne(items.id, item.id),
  ];
  if (query) conditions.push(ilike(items.title, `%${query}%`));

  const candidates = await db.query.items.findMany({
    where: and(...conditions),
    orderBy: asc(items.title),
    limit: 20,
  });

  const categoryLabel = (categoryLabels[item.category as Category] ?? item.category).toLowerCase();

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Merge item</h1>
      <p className="text-sm text-neutral-500">
        Combine <strong className="text-foreground">{item.title}</strong> into another{" "}
        {categoryLabel} added by {item.addedBy?.name ?? "the same person"}. Formats are
        combined onto the item you pick, and this one is deleted. Only items added by the
        same person can be merged.
      </p>
      <MergeForm itemId={item.id} candidates={candidates} query={query ?? ""} />
      <Link href={`/items/${item.id}`} className="underline text-sm">
        Cancel
      </Link>
    </div>
  );
}
