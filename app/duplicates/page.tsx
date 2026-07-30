import Link from "next/link";
import { findPossibleDuplicates } from "@/lib/duplicates";
import { categoryLabels, formatLabel } from "@/lib/categories";
import { quickMergeAction } from "@/app/items/[id]/merge/actions";

export default async function DuplicatesPage() {
  const groups = await findPossibleDuplicates();

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Possible duplicates</h1>
        <p className="text-sm text-neutral-500">
          Items in the same category sharing an identical title — often the same title owned on
          more than one format (e.g. a DVD and a Plex-synced digital copy). Review each group and
          merge the ones that really are duplicates.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No possible duplicates found.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => {
            const mixedOwners = group.items.some(
              (item) => item.addedByUserId !== group.items[0].addedByUserId
            );
            return (
              <li
                key={`${group.category}-${group.title}`}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{group.title}</h2>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {categoryLabels[group.category] ?? group.category}
                  </span>
                </div>

                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    const mergeTargets = group.items.filter(
                      (other) => other.id !== item.id && other.addedByUserId === item.addedByUserId
                    );
                    return (
                      <li key={item.id} className="flex items-center gap-3 text-sm flex-wrap">
                        {item.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverImageUrl}
                            alt=""
                            className="w-8 h-11 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-900"
                          />
                        ) : (
                          <div className="w-8 h-11 rounded shrink-0 bg-neutral-100 dark:bg-neutral-900" />
                        )}
                        <Link
                          href={`/items/${item.id}`}
                          className="underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {item.formats.length ? item.formats.map(formatLabel).join(", ") : "No format set"}
                        </Link>
                        {item.year && <span className="text-neutral-500">{item.year}</span>}
                        <span className="text-neutral-500">
                          Added by {item.addedByName ?? "Unknown"}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          {mergeTargets.map((target) => (
                            <form key={target.id} action={quickMergeAction.bind(null, item.id, target.id)}>
                              <button
                                type="submit"
                                className="underline text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
                              >
                                Merge into{" "}
                                {target.formats.length ? target.formats.map(formatLabel).join("/") : "this"}
                              </button>
                            </form>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {mixedOwners && (
                  <p className="text-xs text-neutral-500">
                    Added by different household members — those can&rsquo;t be merged
                    automatically.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
