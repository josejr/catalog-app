import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { ItemForm } from "./item-form";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) notFound();

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Edit item</h1>
      <ItemForm item={item} />
    </div>
  );
}
