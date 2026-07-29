import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";

// Distinct previously-used values, for <datalist> autocomplete on the
// Creators/Series inputs — not a huge list at household-catalog scale, so a
// plain distinct-select-then-sort-in-JS is simpler than fighting Postgres
// NULL handling in SQL.
function nonEmptyValues(rows: { value: string | null }[]): string[] {
  return rows
    .map((row) => row.value)
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort((a, b) => a.localeCompare(b));
}

export async function getKnownCreators(): Promise<string[]> {
  const rows = await db.selectDistinct({ value: items.creators }).from(items);
  return nonEmptyValues(rows);
}

export async function getKnownSeries(): Promise<string[]> {
  const rows = await db.selectDistinct({ value: items.series }).from(items);
  return nonEmptyValues(rows);
}
