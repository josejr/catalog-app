"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, mediaTypes, type MediaType } from "@/lib/db/schema";
import { lookupOmdbByTitle } from "@/lib/metadata-lookup";

export type UpdateItemState = {
  error?: string;
};

export type OmdbLookupState = {
  error?: string;
  result?: {
    title: string;
    year?: string;
    creators?: string;
    coverImageUrl?: string;
  };
};

export async function lookupOmdbForItemAction(
  title: string,
  year: string
): Promise<OmdbLookupState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  if (!process.env.OMDB_API_KEY) {
    return { error: "OMDb lookup isn't configured (missing OMDB_API_KEY)." };
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Enter a title first." };

  const match = await lookupOmdbByTitle(trimmedTitle, year.trim() || undefined);
  if (!match) return { error: "No match found on OMDb." };

  return {
    result: {
      title: match.title,
      year: match.year,
      creators: match.creators,
      coverImageUrl: match.coverImageUrl,
    },
  };
}

export async function updateItemAction(
  itemId: string,
  _prevState: UpdateItemState | undefined,
  formData: FormData
): Promise<UpdateItemState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const mediaType = formData.get("mediaType");
  if (typeof mediaType !== "string" || !mediaTypes.includes(mediaType as MediaType)) {
    return { error: "Invalid media type." };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const creators = String(formData.get("creators") ?? "").trim() || null;
  const year = String(formData.get("year") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const barcode = String(formData.get("barcode") ?? "").trim() || null;

  await db
    .update(items)
    .set({
      mediaType,
      barcode,
      title,
      subtitle,
      creators,
      year,
      coverImageUrl,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));

  revalidatePath("/");
  redirect("/");
}
