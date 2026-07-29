"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";

export async function deleteItemAction(itemId: string, formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  const from = String(formData.get("from") ?? "").trim();
  const redirectTo = from.startsWith("/") && !from.startsWith("//") ? from : "/";

  // favorites, item_tags, and plex_watch_events all cascade-delete via their
  // item_id foreign key, so a single delete here is enough.
  await db.delete(items).where(eq(items.id, itemId));

  revalidatePath("/");
  redirect(redirectTo);
}
