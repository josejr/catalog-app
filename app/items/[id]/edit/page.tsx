import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { getKnownCreators, getKnownSeries } from "@/lib/catalog-values";
import { ItemForm } from "./item-form";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;

  const [item, knownCreators, knownSeries] = await Promise.all([
    db.query.items.findFirst({ where: eq(items.id, id) }),
    getKnownCreators(),
    getKnownSeries(),
  ]);
  if (!item) notFound();

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Edit item</h1>
      <ItemForm item={item} from={backHref} knownCreators={knownCreators} knownSeries={knownSeries} />
    </div>
  );
}
