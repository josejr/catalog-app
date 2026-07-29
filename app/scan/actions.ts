"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { categoryFormats } from "@/lib/categories";
import { db } from "@/lib/db";
import { categories, items, type Category } from "@/lib/db/schema";
import { lookupBarcode, type LookupResult } from "@/lib/metadata-lookup";
import { toTitleCase } from "@/lib/text";

export type ExistingItemSummary = {
  id: string;
  title: string;
  category: Category;
  year: string | null;
};

async function findExistingByBarcode(
  barcode: string
): Promise<ExistingItemSummary | undefined> {
  const existing = await db.query.items.findFirst({
    where: eq(items.barcode, barcode),
    columns: { id: true, title: true, category: true, year: true },
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

  const category = formData.get("category");
  if (typeof category !== "string" || !categories.includes(category as Category)) {
    return { error: "Invalid category." };
  }
  const validFormats = categoryFormats[category as Category];
  const formats = formData
    .getAll("formats")
    .filter((f): f is string => typeof f === "string" && validFormats.includes(f));

  const rawTitle = String(formData.get("title") ?? "").trim();
  if (!rawTitle) return { error: "Title is required." };
  const title = toTitleCase(rawTitle);

  const rawSortTitle = String(formData.get("sortTitle") ?? "").trim();
  const sortTitle = rawSortTitle ? toTitleCase(rawSortTitle) : null;

  const rawSubtitle = String(formData.get("subtitle") ?? "").trim();
  const subtitle = rawSubtitle ? toTitleCase(rawSubtitle) : null;
  const creators = String(formData.get("creators") ?? "").trim() || null;
  const year = String(formData.get("year") ?? "").trim() || null;
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const barcode = String(formData.get("barcode") ?? "").trim() || null;
  const isbn = String(formData.get("isbn") ?? "").trim() || null;
  const series = String(formData.get("series") ?? "").trim() || null;
  const seriesNumber = String(formData.get("seriesNumber") ?? "").trim() || null;
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
    category,
    formats,
    barcode,
    isbn,
    series,
    seriesNumber,
    title,
    sortTitle,
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
