import Link from "next/link";
import { db } from "@/lib/db";
import { items, mediaTypes, type MediaType } from "@/lib/db/schema";
import { mediaTypeLabels } from "@/lib/media-types";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

function isMediaType(value: string): value is MediaType {
  return (mediaTypes as readonly string[]).includes(value);
}

const sortFields = ["createdAt", "title", "year"] as const;
type SortField = (typeof sortFields)[number];

const sortFieldConfig: Record<
  SortField,
  { label: string; column: typeof items.createdAt | typeof items.title | typeof items.year; defaultDir: "asc" | "desc" }
> = {
  createdAt: { label: "Date Added", column: items.createdAt, defaultDir: "desc" },
  title: { label: "Title", column: items.title, defaultDir: "asc" },
  year: { label: "Year", column: items.year, defaultDir: "asc" },
};

function isSortField(value: string): value is SortField {
  return (sortFields as readonly string[]).includes(value);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const { type, q, sort, dir } = await searchParams;
  const activeFilter = type && isMediaType(type) ? type : undefined;
  const query = q?.trim() || undefined;
  const sortField = sort && isSortField(sort) ? sort : "createdAt";
  const sortDir = dir === "asc" ? "asc" : dir === "desc" ? "desc" : sortFieldConfig[sortField].defaultDir;

  const conditions = [];
  if (activeFilter) conditions.push(eq(items.mediaType, activeFilter));
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
        ilike(items.title, pattern),
        ilike(items.subtitle, pattern),
        ilike(items.creators, pattern)
      )
    );
  }

  const orderFn = sortDir === "asc" ? asc : desc;

  const catalogItems = await db.query.items.findMany({
    with: { addedBy: { columns: { name: true } } },
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: orderFn(sortFieldConfig[sortField].column),
  });

  function hrefFor(overrides: {
    type?: string | null;
    q?: string | null;
    sort?: string | null;
    dir?: string | null;
  }) {
    const merged = {
      type: overrides.type !== undefined ? overrides.type : activeFilter,
      q: overrides.q !== undefined ? overrides.q : query,
      sort: overrides.sort !== undefined ? overrides.sort : sortField,
      dir: overrides.dir !== undefined ? overrides.dir : sortDir,
    };
    const params = new URLSearchParams();
    if (merged.type) params.set("type", merged.type);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort && merged.sort !== "createdAt") params.set("sort", merged.sort);
    const mergedSortField = (merged.sort as SortField) || "createdAt";
    if (merged.dir && merged.dir !== sortFieldConfig[mergedSortField].defaultDir) {
      params.set("dir", merged.dir);
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const filterLinkClass = (isActive: boolean) =>
    isActive
      ? "font-medium underline"
      : "text-neutral-500 underline decoration-neutral-300 dark:decoration-neutral-700";

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <span className="text-sm text-neutral-500">
          {catalogItems.length}{" "}
          {catalogItems.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <Link href={hrefFor({ type: null })} className={filterLinkClass(!activeFilter)}>
          All
        </Link>
        {mediaTypes.map((mt) => (
          <Link
            key={mt}
            href={hrefFor({ type: mt })}
            className={filterLinkClass(activeFilter === mt)}
          >
            {mediaTypeLabels[mt]}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <form action="/" method="GET" className="flex items-center gap-2 text-sm">
          {activeFilter && <input type="hidden" name="type" value={activeFilter} />}
          {sortField !== "createdAt" && <input type="hidden" name="sort" value={sortField} />}
          {sortDir !== sortFieldConfig[sortField].defaultDir && (
            <input type="hidden" name="dir" value={sortDir} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search title, subtitle, creators…"
            className="border rounded px-2 py-1 w-64 max-w-full bg-transparent"
          />
          <button type="submit" className="underline">
            Search
          </button>
          {query && (
            <Link href={hrefFor({ q: null })} className="text-neutral-500 underline">
              Clear
            </Link>
          )}
        </form>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">Sort:</span>
          {sortFields.map((field) => {
            const isActive = sortField === field;
            const nextDir = isActive
              ? sortDir === "asc"
                ? "desc"
                : "asc"
              : sortFieldConfig[field].defaultDir;
            return (
              <Link
                key={field}
                href={hrefFor({ sort: field, dir: nextDir })}
                className={filterLinkClass(isActive)}
              >
                {sortFieldConfig[field].label}
                {isActive && (sortDir === "asc" ? " ↑" : " ↓")}
              </Link>
            );
          })}
        </div>
      </div>

      {catalogItems.length === 0 ? (
        <p className="text-neutral-500">
          {query
            ? `No items match "${query}".`
            : activeFilter
            ? `No ${mediaTypeLabels[activeFilter].toLowerCase()} items yet.`
            : "No items yet. Scan a barcode to add the first one."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {catalogItems.map((item) => (
            <li key={item.id} className="flex gap-4 border-b pb-3">
              {item.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.coverImageUrl}
                  alt=""
                  className="w-12 h-16 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-900"
                />
              ) : (
                <div className="w-12 h-16 rounded shrink-0 bg-neutral-100 dark:bg-neutral-900" />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {mediaTypeLabels[item.mediaType as MediaType] ??
                      item.mediaType}
                  </span>
                  {item.year && (
                    <span className="text-xs text-neutral-500">
                      {item.year}
                    </span>
                  )}
                </div>
                <Link
                  href={`/items/${item.id}`}
                  className="font-medium truncate hover:underline"
                >
                  {item.title}
                </Link>
                {item.subtitle && (
                  <span className="text-sm text-neutral-500 truncate">
                    {item.subtitle}
                  </span>
                )}
                {item.creators && (
                  <span className="text-sm text-neutral-500 truncate">
                    {item.creators}
                  </span>
                )}
              </div>
              <Link
                href={`/items/${item.id}/edit`}
                className="underline text-sm shrink-0 self-start"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
