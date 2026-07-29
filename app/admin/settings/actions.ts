"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
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

  revalidatePath("/admin/settings");
}

export async function clearOmdbApiKeyAction(): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "admin") return;

  await setSetting("omdbApiKey", "");
  revalidatePath("/admin/settings");
}
