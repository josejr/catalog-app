"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { mediaTypes } from "@/lib/db/schema";
import { mediaTypeLabels } from "@/lib/media-types";
import {
  lookupOmdbForItemAction,
  updateItemAction,
  type UpdateItemState,
} from "./actions";

const initialState: UpdateItemState = {};

const inputClass = "border rounded px-3 py-2 bg-transparent";
const labelClass = "text-sm font-medium";

type Item = {
  id: string;
  mediaType: string;
  title: string;
  subtitle: string | null;
  creators: string | null;
  year: string | null;
  coverImageUrl: string | null;
  barcode: string | null;
  notes: string | null;
};

export function ItemForm({ item }: { item: Item }) {
  const updateItemWithId = updateItemAction.bind(null, item.id);
  const [state, formAction, pending] = useActionState(
    updateItemWithId,
    initialState
  );

  const [mediaType, setMediaType] = useState(item.mediaType);
  const [title, setTitle] = useState(item.title);
  const [creators, setCreators] = useState(item.creators ?? "");
  const [year, setYear] = useState(item.year ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(item.coverImageUrl ?? "");
  const [omdbError, setOmdbError] = useState<string | undefined>();
  const [omdbPending, startOmdbLookup] = useTransition();

  function fetchFromOmdb() {
    setOmdbError(undefined);
    startOmdbLookup(async () => {
      const result = await lookupOmdbForItemAction(title, year);
      if (result.error) {
        setOmdbError(result.error);
        return;
      }
      if (result.result) {
        setTitle(result.result.title);
        if (result.result.year) setYear(result.result.year);
        if (result.result.creators) setCreators(result.result.creators);
        if (result.result.coverImageUrl) setCoverImageUrl(result.result.coverImageUrl);
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-col gap-1">
        <label htmlFor="mediaType" className={labelClass}>
          Media type
        </label>
        <select
          id="mediaType"
          name="mediaType"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
          className={inputClass}
        >
          {mediaTypes.map((type) => (
            <option key={type} value={type}>
              {mediaTypeLabels[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="subtitle" className={labelClass}>
          Subtitle
        </label>
        <input
          id="subtitle"
          name="subtitle"
          defaultValue={item.subtitle ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="creators" className={labelClass}>
          Creators
        </label>
        <input
          id="creators"
          name="creators"
          value={creators}
          onChange={(e) => setCreators(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="year" className={labelClass}>
          Year
        </label>
        <input
          id="year"
          name="year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="coverImageUrl" className={labelClass}>
          Cover image URL
        </label>
        <input
          id="coverImageUrl"
          name="coverImageUrl"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          className={inputClass}
        />
      </div>

      {mediaType === "dvd" && (
        <div className="flex flex-col gap-2 border rounded p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchFromOmdb}
              disabled={omdbPending || !title.trim()}
              className="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {omdbPending ? "Fetching..." : "Fetch from OMDb"}
            </button>
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt=""
                className="h-16 w-auto rounded border"
              />
            )}
          </div>
          {omdbError && <p className="text-sm text-red-600">{omdbError}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="barcode" className={labelClass}>
          Barcode
        </label>
        <input
          id="barcode"
          name="barcode"
          defaultValue={item.barcode ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={item.notes ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        <Link href="/" className="underline text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
