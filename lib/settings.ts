import { eq } from "drizzle-orm";
import { db } from "./db";
import { settings } from "./db/schema";

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value || undefined;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!value) {
    await db.delete(settings).where(eq(settings.key, key));
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
