"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, mediaTypes, type MediaType } from "@/lib/db/schema";
import { lookupBarcode, type LookupResult } from "@/lib/metadata-lookup";

export type ExistingItemSummary = {
  id: string;
  title: string;
  mediaType: MediaType;
  year: string | null;
};

async function findExistingByBarcode(
  barcode: string
): Promise<ExistingItemSummary | undefined> {
  const existing = await db.query.items.findFirst({
    where: eq(items.barcode, barcode),
    columns: { id: true, title: true, mediaType: true, year: true },
  });
  return existing as ExistingItemSummary | undefined;
}

export type BarcodeLookupOutcome =
  | { result: LookupResult & { barcode: string }; existingItem?: ExistingItemSummary }
  | { error: string; existingItem?: ExistingItemSummary };

export async function lookupBarcodeAction(
  barcode: string
): Promise<BarcodeLookupOutcome> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in." };

  const trimmed = barcode.trim();
  if (!trimmed) return { error: "No barcode provided." };

  const existingItem = await findExistingByBarcode(trimmed);

  const result = await lookupBarcode(trimmed);
  if (!result) {
    return {
      error: "No metadata found for that barcode. Enter the details manually.",
      existingItem,
    };
  }

  return { result: { ...result, barcode: trimmed }, existingItem };
}

export async function checkExistingItemAction(
  barcode: string
): Promise<ExistingItemSummary | undefined> {
  const session = await auth();
  if (!session?.user) return undefined;

  const trimmed = barcode.trim();
  if (!trimmed) return undefined;

  return findExistingByBarcode(trimmed);
}

export type CreateItemState = {
  error?: string;
  success?: boolean;
  title?: string;
};

export async function createItemAction(
  _prevState: CreateItemState | undefined,
  formData: FormData
): Promise<CreateItemState> {
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
  const metadataSource = String(formData.get("metadataSource") ?? "").trim() || null;

  let rawMetadata: unknown = null;
  const rawMetadataJson = String(formData.get("rawMetadata") ?? "");
  if (rawMetadataJson) {
    try {
      rawMetadata = JSON.parse(rawMetadataJson);
    } catch {
      rawMetadata = null;
    }
  }

  await db.insert(items).values({
    mediaType,
    barcode,
    title,
    subtitle,
    creators,
    year,
    coverImageUrl,
    notes,
    metadataSource,
    rawMetadata,
    addedByUserId: session.user.id,
  });

  revalidatePath("/");
  return { success: true, title };
}
