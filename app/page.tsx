import { db } from "@/lib/db";
import { items, type MediaType } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

const mediaTypeLabels: Record<MediaType, string> = {
  book: "Book",
  cd: "CD",
  dvd: "DVD",
  other: "Other",
};

export default async function Home() {
  const catalogItems = await db.query.items.findMany({
    with: { addedBy: { columns: { name: true } } },
    orderBy: desc(items.createdAt),
  });

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <span className="text-sm text-neutral-500">
          {catalogItems.length}{" "}
          {catalogItems.length === 1 ? "item" : "items"}
        </span>
      </div>

      {catalogItems.length === 0 ? (
        <p className="text-neutral-500">
          No items yet. Scan a barcode to add the first one.
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
                <span className="font-medium truncate">{item.title}</span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
