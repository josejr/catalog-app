import { categoryFormats } from "@/lib/categories";
import { getSetting, setSetting } from "@/lib/settings";

// Flat, de-duplicated list of every format across all categories (e.g.
// "digital" appears for both movies and books but shares one color).
export const allFormats = Array.from(new Set(Object.values(categoryFormats).flat()));

export const defaultFormatColors: Record<string, string> = {
  dvd: "#2563eb",
  bluray: "#7c3aed",
  digital: "#059669",
  cd: "#ea580c",
  vinyl: "#db2777",
  hardcover: "#92400e",
  paperback: "#64748b",
};

export async function getFormatColors(): Promise<Record<string, string>> {
  const stored = await getSetting("formatColors");
  if (!stored) return defaultFormatColors;

  try {
    const parsed = JSON.parse(stored) as Record<string, string>;
    return { ...defaultFormatColors, ...parsed };
  } catch {
    return defaultFormatColors;
  }
}

export async function setFormatColors(colors: Record<string, string>): Promise<void> {
  await setSetting("formatColors", JSON.stringify(colors));
}
