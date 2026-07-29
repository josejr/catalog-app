import { Fragment } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, categories, type Category } from "@/lib/db/schema";
import { categoryFormats, categoryLabels, formatLabel } from "@/lib/categories";

type Counts = { mine: number; total: number };

function emptyCounts(): Counts {
  return { mine: 0, total: 0 };
}

export default async function StatsPage() {
  const session = await auth();
  const userId = session?.user.id ?? "";

  const rows = await db
    .select({
      category: items.category,
      formats: items.formats,
      addedByUserId: items.addedByUserId,
    })
    .from(items);

  const overall = emptyCounts();
  const categoryCounts: Record<Category, Counts> = {
    movie: emptyCounts(),
    music: emptyCounts(),
    book: emptyCounts(),
    other: emptyCounts(),
  };
  const formatCounts: Record<Category, Record<string, Counts>> = {
    movie: Object.fromEntries(categoryFormats.movie.map((f) => [f, emptyCounts()])),
    music: Object.fromEntries(categoryFormats.music.map((f) => [f, emptyCounts()])),
    book: Object.fromEntries(categoryFormats.book.map((f) => [f, emptyCounts()])),
    other: {},
  };

  for (const row of rows) {
    const category = row.category as Category;
    const isMine = row.addedByUserId === userId;

    overall.total++;
    if (isMine) overall.mine++;

    const catCounts = categoryCounts[category];
    if (catCounts) {
      catCounts.total++;
      if (isMine) catCounts.mine++;
    }

    for (const format of row.formats) {
      const bucket = formatCounts[category]?.[format];
      if (bucket) {
        bucket.total++;
        if (isMine) bucket.mine++;
      }
    }
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold">{overall.total}</span>
          <span className="text-neutral-500">Total items</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold">{overall.mine}</span>
          <span className="text-neutral-500">Added by you</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="py-2 pr-4 font-medium">Category</th>
              <th className="py-2 pr-4 font-medium text-right">Total</th>
              <th className="py-2 font-medium text-right">Yours</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium">{categoryLabels[cat]}</td>
                  <td className="py-2 pr-4 text-right">{categoryCounts[cat].total}</td>
                  <td className="py-2 text-right">{categoryCounts[cat].mine}</td>
                </tr>
                {categoryFormats[cat].map((format) => (
                  <tr key={format} className="border-b text-neutral-500">
                    <td className="py-1.5 pr-4 pl-4">{formatLabel(format)}</td>
                    <td className="py-1.5 pr-4 text-right">{formatCounts[cat][format].total}</td>
                    <td className="py-1.5 text-right">{formatCounts[cat][format].mine}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
