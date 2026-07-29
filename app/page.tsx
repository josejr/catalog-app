import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { items, mediaTypes, users, type MediaType } from "@/lib/db/schema";
import { mediaTypeLabels } from "@/lib/media-types";
import { PreferenceLink } from "./preference-link";
import { CoverImage } from "./cover-image";
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

const SORT_COOKIE = "catalogSort";
const ADDED_BY_COOKIE = "catalogAddedBy";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; sort?: string; dir?: string; addedBy?: string }>;
}) {
  const { type, q, sort, dir, addedBy } = await searchParams;
  const cookieStore = await cookies();

  const activeFilter = type && isMediaType(type) ? type : undefined;
  const query = q?.trim() || undefined;

  const filterUsers = await db.query.users.findMany({
    columns: { id: true, name: true },
    orderBy: asc(users.name),
  });

  const hasSortParam = sort !== undefined;
  const [cookieSortField, cookieSortDir] = (cookieStore.get(SORT_COOKIE)?.value ?? "").split(":");
  const sortField: SortField = hasSortParam && isSortField(sort)
    ? sort
    : !hasSortParam && isSortField(cookieSortField)
    ? cookieSortField
    : "createdAt";
  const sortDir: "asc" | "desc" = hasSortParam
    ? dir === "asc"
      ? "asc"
      : dir === "desc"
      ? "desc"
      : sortFieldConfig[sortField].defaultDir
    : cookieSortDir === "asc" || cookieSortDir === "desc"
    ? cookieSortDir
    : sortFieldConfig[sortField].defaultDir;

  const addedBySelection = addedBy !== undefined ? addedBy : cookieStore.get(ADDED_BY_COOKIE)?.value;
  const addedByFilter =
    addedBySelection && addedBySelection !== "all" && filterUsers.some((u) => u.id === addedBySelection)
      ? addedBySelection
      : undefined;

  const conditions = [];
  if (activeFilter) conditions.push(eq(items.mediaType, activeFilter));
  if (addedByFilter) conditions.push(eq(items.addedByUserId, addedByFilter));
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
    addedBy?: string | null;
  }) {
    const merged = {
      type: overrides.type !== undefined ? overrides.type : activeFilter,
      q: overrides.q !== undefined ? overrides.q : query,
      sort: overrides.sort !== undefined ? overrides.sort : sortField,
      dir: overrides.dir !== undefined ? overrides.dir : sortDir,
      addedBy: overrides.addedBy !== undefined ? overrides.addedBy : addedBySelection,
    };
    const params = new URLSearchParams();
    if (merged.type) params.set("type", merged.type);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort && merged.sort !== "createdAt") params.set("sort", merged.sort);
    const mergedSortField = (merged.sort as SortField) || "createdAt";
    if (merged.dir && merged.dir !== sortFieldConfig[mergedSortField].defaultDir) {
      params.set("dir", merged.dir);
    }
    if (merged.addedBy) params.set("addedBy", merged.addedBy);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const filterLinkClass = (isActive: boolean) =>
    isActive
      ? "font-medium text-indigo-600 dark:text-indigo-400"
      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 underline decoration-neutral-300 dark:decoration-neutral-700 underline-offset-2 transition-colors";

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <span className="text-sm text-neutral-500">
          {catalogItems.length}{" "}
          {catalogItems.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Type</span>
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

        {filterUsers.length > 1 && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Added by</span>
            <PreferenceLink
              href={hrefFor({ addedBy: "all" })}
              cookieName={ADDED_BY_COOKIE}
              cookieValue="all"
              className={filterLinkClass(!addedByFilter)}
            >
              All
            </PreferenceLink>
            {filterUsers.map((u) => (
              <PreferenceLink
                key={u.id}
                href={hrefFor({ addedBy: u.id })}
                cookieName={ADDED_BY_COOKIE}
                cookieValue={u.id}
                className={filterLinkClass(addedByFilter === u.id)}
              >
                {u.name}
              </PreferenceLink>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <form action="/" method="GET" className="flex items-center gap-2 text-sm">
          {activeFilter && <input type="hidden" name="type" value={activeFilter} />}
          {sortField !== "createdAt" && <input type="hidden" name="sort" value={sortField} />}
          {sortDir !== sortFieldConfig[sortField].defaultDir && (
            <input type="hidden" name="dir" value={sortDir} />
          )}
          {addedByFilter && <input type="hidden" name="addedBy" value={addedByFilter} />}
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search title, subtitle, creators…"
            className="border rounded-full px-4 py-1.5 w-64 max-w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-shadow"
          />
          <button type="submit" className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors">
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
              <PreferenceLink
                key={field}
                href={hrefFor({ sort: field, dir: nextDir })}
                cookieName={SORT_COOKIE}
                cookieValue={`${field}:${nextDir}`}
                className={filterLinkClass(isActive)}
              >
                {sortFieldConfig[field].label}
                {isActive && (sortDir === "asc" ? " ↑" : " ↓")}
              </PreferenceLink>
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
            <li
              key={item.id}
              className="flex gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 bg-white/60 dark:bg-neutral-900/40 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              {item.coverImageUrl ? (
                <CoverImage
                  src={item.coverImageUrl}
                  alt={item.title}
                  className="w-12 h-16 object-cover rounded-md shrink-0 bg-neutral-100 dark:bg-neutral-900"
                />
              ) : (
                <div className="w-12 h-16 rounded-md shrink-0 bg-neutral-100 dark:bg-neutral-900" />
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
                  className="font-medium truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                className="underline text-sm shrink-0 self-start text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
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
