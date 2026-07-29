import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, categories, favorites, itemTags, users, type Category } from "@/lib/db/schema";
import { categoryFormats, categoryLabels, formatLabel } from "@/lib/categories";
import { getFormatColors } from "@/lib/format-colors";
import { PreferenceLink } from "./preference-link";
import { CoverImage } from "./cover-image";
import { toggleFavoriteAction } from "./items/[id]/actions";
import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";

function isCategory(value: string): value is Category {
  return (categories as readonly string[]).includes(value);
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
const VIEW_COOKIE = "catalogView";
const GRID_SIZE_COOKIE = "catalogGridSize";

const gridSizes = ["sm", "md", "lg"] as const;
type GridSize = (typeof gridSizes)[number];
function isGridSize(value: string): value is GridSize {
  return (gridSizes as readonly string[]).includes(value);
}
const gridSizeConfig: Record<GridSize, { label: string; minTileWidth: number }> = {
  sm: { label: "S", minTileWidth: 110 },
  md: { label: "M", minTileWidth: 150 },
  lg: { label: "L", minTileWidth: 210 },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    format?: string;
    q?: string;
    sort?: string;
    dir?: string;
    addedBy?: string;
    favorite?: string;
    tag?: string;
    view?: string;
    gridSize?: string;
  }>;
}) {
  const { category, format, q, sort, dir, addedBy, favorite, tag, view, gridSize: gridSizeParam } =
    await searchParams;
  const cookieStore = await cookies();
  const session = await auth();
  const userId = session?.user.id ?? "";

  const activeCategory = category && isCategory(category) ? category : undefined;
  // Format tokens are only meaningful once a category narrows their vocabulary
  // (e.g. "digital" means something different for movies vs. books).
  const activeFormats = activeCategory
    ? (format?.split(",").filter((f) => categoryFormats[activeCategory].includes(f)) ?? [])
    : [];
  const query = q?.trim() || undefined;
  const activeFavorite = favorite === "1";

  const [filterUsers, favoriteRows, userTagRows] = await Promise.all([
    db.query.users.findMany({
      columns: { id: true, name: true },
      orderBy: asc(users.name),
    }),
    db.select({ itemId: favorites.itemId }).from(favorites).where(eq(favorites.userId, userId)),
    db
      .selectDistinct({ tag: itemTags.tag })
      .from(itemTags)
      .where(eq(itemTags.userId, userId))
      .orderBy(asc(itemTags.tag)),
  ]);
  const favoriteItemIds = favoriteRows.map((row) => row.itemId);
  const userTags = userTagRows.map((row) => row.tag);
  const activeTag = tag && userTags.includes(tag) ? tag : undefined;

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

  const viewCookie = cookieStore.get(VIEW_COOKIE)?.value;
  const viewMode: "list" | "grid" =
    view === "grid" || view === "list" ? view : viewCookie === "grid" ? "grid" : "list";

  const gridSizeCookie = cookieStore.get(GRID_SIZE_COOKIE)?.value;
  const gridSize: GridSize =
    gridSizeParam && isGridSize(gridSizeParam)
      ? gridSizeParam
      : gridSizeCookie && isGridSize(gridSizeCookie)
      ? gridSizeCookie
      : "md";

  const conditions = [];
  if (activeCategory) conditions.push(eq(items.category, activeCategory));
  if (activeFormats.length) conditions.push(arrayOverlaps(items.formats, activeFormats));
  if (addedByFilter) conditions.push(eq(items.addedByUserId, addedByFilter));
  if (activeFavorite) conditions.push(inArray(items.id, favoriteItemIds));
  if (activeTag) {
    const tagRows = await db
      .select({ itemId: itemTags.itemId })
      .from(itemTags)
      .where(and(eq(itemTags.userId, userId), eq(itemTags.tag, activeTag)));
    conditions.push(inArray(items.id, tagRows.map((row) => row.itemId)));
  }
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
    with: {
      addedBy: { columns: { name: true } },
      favorites: { where: eq(favorites.userId, userId) },
    },
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: orderFn(sortFieldConfig[sortField].column),
  });
  const formatColors = viewMode === "grid" ? await getFormatColors() : undefined;

  function hrefFor(overrides: {
    category?: string | null;
    format?: string[] | null;
    q?: string | null;
    sort?: string | null;
    dir?: string | null;
    addedBy?: string | null;
    favorite?: boolean | null;
    tag?: string | null;
    view?: string | null;
    gridSize?: string | null;
  }) {
    const merged = {
      category: overrides.category !== undefined ? overrides.category : activeCategory,
      format: overrides.format !== undefined ? overrides.format : activeFormats,
      q: overrides.q !== undefined ? overrides.q : query,
      sort: overrides.sort !== undefined ? overrides.sort : sortField,
      dir: overrides.dir !== undefined ? overrides.dir : sortDir,
      addedBy: overrides.addedBy !== undefined ? overrides.addedBy : addedBySelection,
      favorite: overrides.favorite !== undefined ? overrides.favorite : activeFavorite,
      tag: overrides.tag !== undefined ? overrides.tag : activeTag,
      view: overrides.view !== undefined ? overrides.view : viewMode,
      gridSize: overrides.gridSize !== undefined ? overrides.gridSize : gridSize,
    };
    const params = new URLSearchParams();
    if (merged.category) params.set("category", merged.category);
    if (merged.category && merged.format && merged.format.length) {
      params.set("format", merged.format.join(","));
    }
    if (merged.q) params.set("q", merged.q);
    if (merged.favorite) params.set("favorite", "1");
    if (merged.tag) params.set("tag", merged.tag);
    if (merged.sort && merged.sort !== "createdAt") params.set("sort", merged.sort);
    const mergedSortField = (merged.sort as SortField) || "createdAt";
    if (merged.dir && merged.dir !== sortFieldConfig[mergedSortField].defaultDir) {
      params.set("dir", merged.dir);
    }
    if (merged.addedBy) params.set("addedBy", merged.addedBy);
    if (merged.view && merged.view !== "list") params.set("view", merged.view);
    if (merged.gridSize && merged.gridSize !== "md") params.set("gridSize", merged.gridSize);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  // Carried through item/edit links so "Save" and "Back to catalog" can
  // return here with the same filters instead of resetting to "/".
  const catalogHref = hrefFor({});
  const itemHref = (itemId: string) => `/items/${itemId}?from=${encodeURIComponent(catalogHref)}`;

  function categoryBadge(item: { category: string; formats: string[] }): string {
    const label = categoryLabels[item.category as Category] ?? item.category;
    return item.formats.length ? `${label} · ${item.formats.map(formatLabel).join(", ")}` : label;
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
          <span className="text-xs uppercase tracking-wide text-neutral-400">Category</span>
          <Link
            href={hrefFor({ category: null, format: null })}
            className={filterLinkClass(!activeCategory)}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={hrefFor({ category: cat, format: null })}
              className={filterLinkClass(activeCategory === cat)}
            >
              {categoryLabels[cat]}
            </Link>
          ))}
        </div>

        {activeCategory && categoryFormats[activeCategory].length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Format</span>
            {categoryFormats[activeCategory].map((fmt) => {
              const isActive = activeFormats.includes(fmt);
              const nextFormats = isActive
                ? activeFormats.filter((f) => f !== fmt)
                : [...activeFormats, fmt];
              return (
                <Link
                  key={fmt}
                  href={hrefFor({ format: nextFormats })}
                  className={filterLinkClass(isActive)}
                >
                  {formatLabel(fmt)}
                </Link>
              );
            })}
          </div>
        )}

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

        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Favorites</span>
          <Link
            href={hrefFor({ favorite: activeFavorite ? null : true })}
            className={filterLinkClass(activeFavorite)}
          >
            ★ Favorites only
          </Link>
        </div>

        {userTags.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Tags</span>
            <Link href={hrefFor({ tag: null })} className={filterLinkClass(!activeTag)}>
              All
            </Link>
            {userTags.map((t) => (
              <Link
                key={t}
                href={hrefFor({ tag: activeTag === t ? null : t })}
                className={filterLinkClass(activeTag === t)}
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <form action="/" method="GET" className="flex items-center gap-2 text-sm">
          {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
          {activeCategory && activeFormats.length > 0 && (
            <input type="hidden" name="format" value={activeFormats.join(",")} />
          )}
          {sortField !== "createdAt" && <input type="hidden" name="sort" value={sortField} />}
          {sortDir !== sortFieldConfig[sortField].defaultDir && (
            <input type="hidden" name="dir" value={sortDir} />
          )}
          {addedByFilter && <input type="hidden" name="addedBy" value={addedByFilter} />}
          {activeFavorite && <input type="hidden" name="favorite" value="1" />}
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          {viewMode !== "list" && <input type="hidden" name="view" value={viewMode} />}
          {gridSize !== "md" && <input type="hidden" name="gridSize" value={gridSize} />}
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

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">View:</span>
            <PreferenceLink
              href={hrefFor({ view: "list" })}
              cookieName={VIEW_COOKIE}
              cookieValue="list"
              className={filterLinkClass(viewMode === "list")}
            >
              List
            </PreferenceLink>
            <PreferenceLink
              href={hrefFor({ view: "grid" })}
              cookieName={VIEW_COOKIE}
              cookieValue="grid"
              className={filterLinkClass(viewMode === "grid")}
            >
              Grid
            </PreferenceLink>
          </div>
          {viewMode === "grid" && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Size:</span>
              {gridSizes.map((size) => (
                <PreferenceLink
                  key={size}
                  href={hrefFor({ gridSize: size })}
                  cookieName={GRID_SIZE_COOKIE}
                  cookieValue={size}
                  className={filterLinkClass(gridSize === size)}
                >
                  {gridSizeConfig[size].label}
                </PreferenceLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {catalogItems.length === 0 ? (
        <p className="text-neutral-500">
          {query
            ? `No items match "${query}".`
            : activeCategory
            ? `No ${categoryLabels[activeCategory].toLowerCase()} items yet.`
            : "No items yet. Scan a barcode to add the first one."}
        </p>
      ) : viewMode === "grid" ? (
        <ul
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridSizeConfig[gridSize].minTileWidth}px, 1fr))` }}
        >
          {catalogItems.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 bg-white/60 dark:bg-neutral-900/40 shadow-sm hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  {categoryLabels[item.category as Category] ?? item.category}
                </span>
                <div className="flex items-center gap-1.5">
                  {item.year && <span className="text-[10px] text-neutral-500">{item.year}</span>}
                  <form action={toggleFavoriteAction.bind(null, item.id)}>
                    <button
                      type="submit"
                      aria-label={item.favorites.length > 0 ? "Remove from favorites" : "Add to favorites"}
                      className={`text-sm leading-none ${
                        item.favorites.length > 0
                          ? "text-amber-500"
                          : "text-neutral-300 dark:text-neutral-700 hover:text-amber-500"
                      } transition-colors`}
                    >
                      {item.favorites.length > 0 ? "★" : "☆"}
                    </button>
                  </form>
                </div>
              </div>
              <Link href={itemHref(item.id)} className="block">
                {item.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="w-full aspect-[2/3] object-cover rounded-md bg-neutral-100 dark:bg-neutral-900"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-md bg-neutral-100 dark:bg-neutral-900" />
                )}
              </Link>
              <div className="flex flex-col gap-1 min-w-0">
                <Link
                  href={itemHref(item.id)}
                  className="text-sm font-medium truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {item.title}
                </Link>
                {item.formats.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.formats.map((format) => (
                      <span
                        key={format}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: formatColors?.[format] }}
                      >
                        {formatLabel(format)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
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
                    {categoryBadge(item)}
                  </span>
                  {item.year && (
                    <span className="text-xs text-neutral-500">
                      {item.year}
                    </span>
                  )}
                </div>
                <Link
                  href={itemHref(item.id)}
                  className="font-medium truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {item.title}
                </Link>
                {item.addedBy?.name && (
                  <span className="text-xs text-neutral-500 truncate">
                    Added by {item.addedBy.name}
                  </span>
                )}
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
              <div className="flex items-center gap-3 shrink-0 self-start">
                <form action={toggleFavoriteAction.bind(null, item.id)}>
                  <button
                    type="submit"
                    aria-label={item.favorites.length > 0 ? "Remove from favorites" : "Add to favorites"}
                    className={`text-lg leading-none ${
                      item.favorites.length > 0
                        ? "text-amber-500"
                        : "text-neutral-300 dark:text-neutral-700 hover:text-amber-500"
                    } transition-colors`}
                  >
                    {item.favorites.length > 0 ? "★" : "☆"}
                  </button>
                </form>
                <Link
                  href={`/items/${item.id}/edit?from=${encodeURIComponent(catalogHref)}`}
                  className="underline text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
