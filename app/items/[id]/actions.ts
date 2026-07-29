"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites, itemTags } from "@/lib/db/schema";

// Bound directly to a <form action={...}> per item, so favoriting works
// without any client JS — toggling just re-derives state from the DB
// rather than trusting a client-passed boolean.
export async function toggleFavoriteAction(itemId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const existing = await db.query.favorites.findFirst({
    where: and(eq(favorites.itemId, itemId), eq(favorites.userId, session.user.id)),
  });

  if (existing) {
    await db.delete(favorites).where(eq(favorites.id, existing.id));
  } else {
    await db.insert(favorites).values({ itemId, userId: session.user.id });
  }

  revalidatePath("/");
  revalidatePath(`/items/${itemId}`);
}

export async function addTagAction(itemId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const tag = String(formData.get("tag") ?? "").trim().slice(0, 50);
  if (!tag) return;

  try {
    await db.insert(itemTags).values({ itemId, userId: session.user.id, tag });
  } catch {
    // Unique constraint on (item, user, tag) — already tagged, nothing to do.
  }

  revalidatePath("/");
  revalidatePath(`/items/${itemId}`);
}

export async function removeTagAction(itemId: string, tag: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await db
    .delete(itemTags)
    .where(
      and(
        eq(itemTags.itemId, itemId),
        eq(itemTags.userId, session.user.id),
        eq(itemTags.tag, tag)
      )
    );

  revalidatePath("/");
  revalidatePath(`/items/${itemId}`);
}
