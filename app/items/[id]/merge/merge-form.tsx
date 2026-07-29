"use client";

import { useActionState } from "react";
import { formatLabel } from "@/lib/categories";
import { mergeItemAction, type MergeState } from "./actions";

type Candidate = {
  id: string;
  title: string;
  year: string | null;
  formats: string[];
};

const initialState: MergeState = {};

export function MergeForm({
  itemId,
  candidates,
  query,
}: {
  itemId: string;
  candidates: Candidate[];
  query: string;
}) {
  const mergeWithId = mergeItemAction.bind(null, itemId);
  const [state, formAction, pending] = useActionState(mergeWithId, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action="" method="GET" className="flex items-center gap-2 text-sm">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search title…"
          className="border rounded-full px-4 py-1.5 flex-1 bg-transparent"
        />
        <button
          type="submit"
          className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
        >
          Search
        </button>
      </form>

      <form action={formAction} className="flex flex-col gap-3">
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        {candidates.length === 0 ? (
          <p className="text-sm text-neutral-500">No matching items to merge with.</p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <label className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
                  <input type="radio" name="targetId" value={candidate.id} required />
                  <span className="min-w-0 flex-1 truncate">
                    {candidate.title}
                    {candidate.year && (
                      <span className="text-neutral-500"> ({candidate.year})</span>
                    )}
                  </span>
                  {candidate.formats.length > 0 && (
                    <span className="text-xs text-neutral-500 shrink-0">
                      {candidate.formats.map(formatLabel).join(", ")}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={pending || candidates.length === 0}
          className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50 self-start"
        >
          {pending ? "Merging..." : "Merge"}
        </button>
      </form>
    </div>
  );
}
