import type { Category } from "@/lib/db/schema";

export const categoryLabels: Record<Category, string> = {
  movie: "Movie",
  music: "Music",
  book: "Book",
  other: "Other",
};

// Formats a title can be tagged with, scoped per category — a single
// catalog entry can have more than one checked (e.g. a movie owned on
// both DVD and digital).
export const categoryFormats: Record<Category, readonly string[]> = {
  movie: ["dvd", "bluray", "digital"],
  music: ["cd", "vinyl"],
  book: ["hardcover", "paperback", "digital"],
  other: [],
};

const formatLabels: Record<string, string> = {
  dvd: "DVD",
  bluray: "Blu-ray",
  digital: "Digital",
  cd: "CD",
  vinyl: "Vinyl",
  hardcover: "Hardcover",
  paperback: "Paperback",
};

export function formatLabel(format: string): string {
  return formatLabels[format] ?? format;
}
