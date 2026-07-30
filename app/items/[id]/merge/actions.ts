"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, plexWatchEvents } from "@/lib/db/schema";

export type MergeState = {
  error?: string;
};

// Shared by mergeItemAction (the manual picker) and quickMergeAction (the
// one-click button on /duplicates) — restricted to items added by the same
// user so one household member can't silently absorb or delete another's
// catalog entries.
async function performMerge(sourceId: string, targetId: string): Promise<{ error?: string }> {
  if (targetId === sourceId) return { error: "Can't merge an item into itself." };

  const [source, target] = await Promise.all([
    db.query.items.findFirst({ where: eq(items.id, sourceId) }),
    db.query.items.findFirst({ where: eq(items.id, targetId) }),
  ]);
  if (!source || !target) return { error: "Item not found." };

  if (source.addedByUserId !== target.addedByUserId) {
    return { error: "You can only merge items that were added by the same person." };
  }
  if (source.category !== target.category) {
    return { error: "Items must be the same category to merge." };
  }

  const mergedFormats = Array.from(new Set([...target.formats, ...source.formats]));

  await db.transaction(async (tx) => {
    await tx
      .update(plexWatchEvents)
      .set({ itemId: target.id })
      .where(eq(plexWatchEvents.itemId, source.id));

    await tx
      .update(items)
      .set({
        formats: mergedFormats,
        subtitle: target.subtitle ?? source.subtitle,
        creators: target.creators ?? source.creators,
        year: target.year ?? source.year,
        coverImageUrl: target.coverImageUrl ?? source.coverImageUrl,
        notes: target.notes ?? source.notes,
        barcode: target.barcode ?? source.barcode,
        isbn: target.isbn ?? source.isbn,
        series: target.series ?? source.series,
        seriesNumber: target.seriesNumber ?? source.seriesNumber,
        sortTitle: target.sortTitle ?? source.sortTitle,
        updatedAt: new Date(),
      })
      .where(eq(items.id, target.id));

    await tx.delete(items).where(eq(items.id, source.id));
  });

  return {};
}

export async function mergeItemAction(
  sourceId: string,
  _prevState: MergeState | undefined,
  formData: FormData
): Promise<MergeState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const targetId = String(formData.get("targetId") ?? "").trim();
  if (!targetId) return { error: "Choose an item to merge into." };

  const result = await performMerge(sourceId, targetId);
  if (result.error) return result;

  revalidatePath("/");
  redirect(`/items/${targetId}`);
}

// One-click merge from the possible-duplicates page — both ids are already
// known (bound directly into the form), so there's no picker step.
export async function quickMergeAction(sourceId: string, targetId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const result = await performMerge(sourceId, targetId);
  if (result.error) return;

  revalidatePath("/");
  revalidatePath("/duplicates");
  redirect("/duplicates");
}
