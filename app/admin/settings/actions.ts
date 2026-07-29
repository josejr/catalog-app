"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { allFormats, defaultFormatColors, setFormatColors } from "@/lib/format-colors";
import { setSetting } from "@/lib/settings";

export async function updateSettingsAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return "Only admins can change settings.";
  }

  const omdbApiKey = String(formData.get("omdbApiKey") ?? "").trim();
  if (omdbApiKey) {
    await setSetting("omdbApiKey", omdbApiKey);
  }

  const tmdbApiKey = String(formData.get("tmdbApiKey") ?? "").trim();
  if (tmdbApiKey) {
    await setSetting("tmdbApiKey", tmdbApiKey);
  }

  const hardcoverApiKey = String(formData.get("hardcoverApiKey") ?? "").trim();
  if (hardcoverApiKey) {
    await setSetting("hardcoverApiKey", hardcoverApiKey);
  }

  revalidatePath("/admin/settings");
}

export async function clearOmdbApiKeyAction(): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "admin") return;

  await setSetting("omdbApiKey", "");
  revalidatePath("/admin/settings");
}

export async function clearTmdbApiKeyAction(): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "admin") return;

  await setSetting("tmdbApiKey", "");
  revalidatePath("/admin/settings");
}

export async function clearHardcoverApiKeyAction(): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "admin") return;

  await setSetting("hardcoverApiKey", "");
  revalidatePath("/admin/settings");
}

export async function updateFormatColorsAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return "Only admins can change settings.";
  }

  const colors: Record<string, string> = {};
  for (const format of allFormats) {
    const value = String(formData.get(`color:${format}`) ?? "").trim();
    colors[format] = /^#[0-9a-fA-F]{6}$/.test(value) ? value : defaultFormatColors[format];
  }
  await setFormatColors(colors);

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
