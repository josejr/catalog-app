"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { categoryFormats, categoryLabels, formatLabel } from "@/lib/categories";
import { categories, type Category } from "@/lib/db/schema";
import {
  searchHardcoverAction,
  searchItunesAction,
  searchMusicBrainzAction,
  searchOmdbAction,
  searchOpenLibraryAction,
  searchTmdbAction,
  selectOmdbAction,
  selectTmdbAction,
  updateItemAction,
  type MetadataLookupState,
  type SearchState,
  type UpdateItemState,
} from "./actions";

type LookupCandidate = NonNullable<SearchState["candidates"]>[number];

type MetadataSource = {
  key: string;
  label: string;
  search: (title: string, year: string, isbn: string) => Promise<SearchState>;
  select?: (id: string, format: "dvd" | "bluray") => Promise<MetadataLookupState>;
  // Only the cover image is applied from this source's matches — used for
  // iTunes, whose title/artist matching is much less reliable than the
  // category-specific sources, so it shouldn't touch text fields.
  coverOnly?: boolean;
};

const metadataSourcesByCategory: Record<string, MetadataSource[]> = {
  book: [
    { key: "openlibrary", label: "Open Library", search: (title) => searchOpenLibraryAction(title) },
    {
      key: "hardcover",
      label: "Hardcover",
      search: (title, _year, isbn) => searchHardcoverAction(title, isbn),
    },
    {
      key: "itunes",
      label: "iTunes (cover)",
      search: (title) => searchItunesAction(title, "book"),
      coverOnly: true,
    },
  ],
  music: [
    { key: "musicbrainz", label: "MusicBrainz", search: (title) => searchMusicBrainzAction(title) },
    {
      key: "itunes",
      label: "iTunes (cover)",
      search: (title) => searchItunesAction(title, "music"),
      coverOnly: true,
    },
  ],
  movie: [
    { key: "omdb", label: "OMDb", search: searchOmdbAction, select: selectOmdbAction },
    { key: "tmdb", label: "TMDB", search: searchTmdbAction, select: selectTmdbAction },
    {
      key: "itunes",
      label: "iTunes (cover)",
      search: (title) => searchItunesAction(title, "movie"),
      coverOnly: true,
    },
  ],
};

const initialState: UpdateItemState = {};

const inputClass = "border rounded px-3 py-2 bg-transparent";
const labelClass = "text-sm font-medium";

type Item = {
  id: string;
  category: string;
  formats: string[];
  title: string;
  sortTitle: string | null;
  subtitle: string | null;
  creators: string | null;
  year: string | null;
  coverImageUrl: string | null;
  barcode: string | null;
  isbn: string | null;
  series: string | null;
  seriesNumber: string | null;
  notes: string | null;
};

export function ItemForm({
  item,
  from,
  knownCreators = [],
  knownSeries = [],
}: {
  item: Item;
  from?: string;
  knownCreators?: string[];
  knownSeries?: string[];
}) {
  const updateItemWithId = updateItemAction.bind(null, item.id);
  const [state, formAction, pending] = useActionState(
    updateItemWithId,
    initialState
  );

  const [category, setCategory] = useState(item.category);
  const [formats, setFormats] = useState<string[]>(item.formats);
  const [title, setTitle] = useState(item.title);
  const [creators, setCreators] = useState(item.creators ?? "");
  const [year, setYear] = useState(item.year ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(item.coverImageUrl ?? "");
  const [isbn, setIsbn] = useState(item.isbn ?? "");
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [activeSource, setActiveSource] = useState<MetadataSource | undefined>();
  const [candidates, setCandidates] = useState<LookupCandidate[] | undefined>();
  const [lookupPending, startLookup] = useTransition();

  const metadataSources = metadataSourcesByCategory[category] ?? [];
  const availableFormats = categoryFormats[category as Category] ?? [];
  const format = formats.includes("bluray") ? "bluray" : "dvd";

  function applyMatch(match: NonNullable<MetadataLookupState["result"]>, coverOnly?: boolean) {
    // An explicit pick from the search results, so it's fine to overwrite
    // fields that already have something in them — unlike a silent
    // background fill, the user just chose this match on purpose. A
    // coverOnly source (iTunes) only ever touches the cover image.
    if (!coverOnly) {
      setTitle(match.title);
      if (match.year !== undefined) setYear(match.year);
      if (match.creators !== undefined) setCreators(match.creators);
      if (match.isbn !== undefined) setIsbn(match.isbn);
    }
    if (match.coverImageUrl !== undefined) setCoverImageUrl(match.coverImageUrl);
    setCandidates(undefined);
    setActiveSource(undefined);
  }

  function runSearch(source: MetadataSource) {
    startLookup(async () => {
      setLookupError(undefined);
      setCandidates(undefined);
      setActiveSource(source);
      const result = await source.search(title, year, isbn);
      if (result.error) {
        setLookupError(result.error);
        return;
      }
      setCandidates(result.candidates);
    });
  }

  function pickCandidate(source: MetadataSource, candidate: LookupCandidate) {
    if (candidate.result) {
      applyMatch(candidate.result, source.coverOnly);
      return;
    }
    if (!source.select) return;
    startLookup(async () => {
      setLookupError(undefined);
      const result = await source.select!(candidate.id, format);
      if (result.error) {
        setLookupError(result.error);
        return;
      }
      if (result.result) applyMatch(result.result, source.coverOnly);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      {from && <input type="hidden" name="from" value={from} />}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className={labelClass}>
          Category
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setFormats([]);
            setCandidates(undefined);
            setActiveSource(undefined);
            setLookupError(undefined);
          }}
          className={inputClass}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat]}
            </option>
          ))}
        </select>
      </div>

      {availableFormats.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Formats</span>
          <div className="flex flex-wrap gap-3">
            {availableFormats.map((format) => (
              <label key={format} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="formats"
                  value={format}
                  checked={formats.includes(format)}
                  onChange={(e) => {
                    setFormats((prev) =>
                      e.target.checked ? [...prev, format] : prev.filter((f) => f !== format)
                    );
                  }}
                />
                {formatLabel(format)}
              </label>
            ))}
          </div>
        </div>
      )}

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
        <label htmlFor="sortTitle" className={labelClass}>
          Sort title
        </label>
        <input
          id="sortTitle"
          name="sortTitle"
          defaultValue={item.sortTitle ?? ""}
          placeholder={title || "Defaults to the title above"}
          className={inputClass}
        />
        <p className="text-xs text-neutral-500">
          Optional override for sorting only — e.g. &ldquo;Hobbit, The&rdquo; so it sorts under H.
        </p>
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
          {category === "music" ? "Artist" : "Creators"}
        </label>
        <input
          id="creators"
          name="creators"
          list="known-creators"
          value={creators}
          onChange={(e) => setCreators(e.target.value)}
          className={inputClass}
        />
        <datalist id="known-creators">
          {knownCreators.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
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

      {category === "book" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="isbn" className={labelClass}>
            ISBN
          </label>
          <input
            id="isbn"
            name="isbn"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {category === "book" && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="series" className={labelClass}>
              Series
            </label>
            <input
              id="series"
              name="series"
              list="known-series"
              defaultValue={item.series ?? ""}
              className={inputClass}
            />
            <datalist id="known-series">
              {knownSeries.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1 w-24">
            <label htmlFor="seriesNumber" className={labelClass}>
              Series #
            </label>
            <input
              id="seriesNumber"
              name="seriesNumber"
              defaultValue={item.seriesNumber ?? ""}
              className={inputClass}
            />
          </div>
        </div>
      )}

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

      {metadataSources.length > 0 && (
        <div className="flex flex-col gap-2 border rounded p-3">
          <div className="flex items-center gap-3 flex-wrap">
            {metadataSources.map((source) => (
              <button
                key={source.key}
                type="button"
                onClick={() => runSearch(source)}
                disabled={lookupPending || (!title.trim() && !isbn.trim())}
                className="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {lookupPending && activeSource?.key === source.key
                  ? "Searching..."
                  : `Search ${source.label}`}
              </button>
            ))}
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="" className="h-16 w-auto rounded border" />
            )}
          </div>
          {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}
          {candidates && activeSource && (
            <div className="flex flex-col gap-1">
              {candidates.length === 0 ? (
                <p className="text-sm text-neutral-500">No matches found.</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => pickCandidate(activeSource, candidate)}
                        disabled={lookupPending}
                        className="flex items-center gap-3 w-full text-left rounded border px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50 transition-colors"
                      >
                        {candidate.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={candidate.thumbnailUrl}
                            alt=""
                            className="h-12 w-9 object-cover rounded shrink-0 bg-neutral-100 dark:bg-neutral-900"
                          />
                        ) : (
                          <div className="h-12 w-9 rounded shrink-0 bg-neutral-100 dark:bg-neutral-900" />
                        )}
                        <span className="text-sm min-w-0">
                          <span className="block truncate">{candidate.title}</span>
                          {candidate.year && (
                            <span className="text-neutral-500">{candidate.year}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setCandidates(undefined);
                  setActiveSource(undefined);
                }}
                className="self-start text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
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
        <Link href={from || "/"} className="underline text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
