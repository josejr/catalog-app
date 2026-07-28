import type { MediaType } from "@/lib/db/schema";

export const mediaTypeLabels: Record<MediaType, string> = {
  book: "Book",
  cd: "CD",
  dvd: "DVD",
  other: "Other",
};
