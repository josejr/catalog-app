"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { IScannerControls } from "@zxing/browser";
import { categoryFormats, categoryLabels, formatLabel } from "@/lib/categories";
import { categories, type Category } from "@/lib/db/schema";
import {
  checkExistingItemAction,
  createItemAction,
  lookupBarcodeAction,
  type CreateItemState,
  type ExistingItemSummary,
} from "./actions";

const initialCreateItemState: CreateItemState = {};

type ReviewData = {
  category: Category;
  formats: string[];
  title: string;
  subtitle: string;
  creators: string;
  year: string;
  coverImageUrl: string;
  barcode: string;
  isbn: string;
  metadataSource: string;
  rawMetadata: string;
  notice?: string;
  existingItem?: ExistingItemSummary;
};

function emptyReview(barcode = ""): ReviewData {
  return {
    category: "book",
    formats: [],
    title: "",
    subtitle: "",
    creators: "",
    year: "",
    coverImageUrl: "",
    barcode,
    isbn: "",
    metadataSource: "",
    rawMetadata: "",
  };
}

const inputClass = "border rounded px-3 py-2 bg-transparent";
const labelClass = "text-sm font-medium";

export function Scanner({
  startBlank = false,
  knownCreators = [],
  knownSeries = [],
}: {
  startBlank?: boolean;
  knownCreators?: string[];
  knownSeries?: string[];
}) {
  const [mode, setMode] = useState<"scanning" | "manual" | "review" | "success">(
    startBlank ? "review" : "scanning"
  );
  const [manualBarcode, setManualBarcode] = useState("");
  const [review, setReview] = useState<ReviewData | null>(startBlank ? emptyReview() : null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);

  const [formState, formAction, pending] = useActionState(
    createItemAction,
    initialCreateItemState
  );
  const [handledFormState, setHandledFormState] = useState(formState);
  if (formState !== handledFormState) {
    setHandledFormState(formState);
    if (formState.success) setMode("success");
  }

  useEffect(() => {
    if (mode !== "scanning") return;

    let cancelled = false;
    handledRef.current = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result && !handledRef.current) {
              handledRef.current = true;
              controlsRef.current?.stop();
              handleDecoded(result.getText());
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? err.message : "Could not access the camera."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [mode]);

  function handleDecoded(barcode: string) {
    startLookup(async () => {
      const outcome = await lookupBarcodeAction(barcode);
      if ("result" in outcome) {
        const r = outcome.result;
        setReview({
          category: r.category,
          formats: r.formats ?? [],
          title: r.title ?? "",
          subtitle: r.subtitle ?? "",
          creators: r.creators ?? "",
          year: r.year ?? "",
          coverImageUrl: r.coverImageUrl ?? "",
          barcode: r.barcode,
          isbn: r.isbn ?? "",
          metadataSource: r.metadataSource,
          rawMetadata: r.rawMetadata ? JSON.stringify(r.rawMetadata) : "",
          existingItem: outcome.existingItem,
        });
      } else {
        setReview({
          ...emptyReview(barcode),
          notice: outcome.error,
          existingItem: outcome.existingItem,
        });
      }
      setMode("review");
    });
  }

  function handleSkipLookup(barcode: string) {
    startLookup(async () => {
      const existingItem = await checkExistingItemAction(barcode);
      setReview({ ...emptyReview(barcode), existingItem });
      setMode("review");
    });
  }

  function handleBlankAdd() {
    setReview(emptyReview());
    setMode("review");
  }

  function reset() {
    setReview(null);
    setManualBarcode("");
    setCameraError(null);
    setMode("scanning");
  }

  if (mode === "success") {
    return (
      <div className="flex flex-col gap-4">
        <p>Added &ldquo;{formState.title}&rdquo; to the catalog.</p>
        <button type="button" onClick={reset} className="underline text-left w-fit">
          Scan another item
        </button>
      </div>
    );
  }

  if (mode === "review" && review) {
    return (
      <form action={formAction} className="flex flex-col gap-4 max-w-sm">
        {review.notice && (
          <p className="text-sm text-amber-600">{review.notice}</p>
        )}
        {review.existingItem && (
          <p className="text-sm rounded border border-amber-600 text-amber-600 px-3 py-2">
            Already in your catalog:{" "}
            <strong>{categoryLabels[review.existingItem.category]}</strong>{" "}
            &ldquo;{review.existingItem.title}&rdquo;
            {review.existingItem.year && ` (${review.existingItem.year})`}.
            Saving will add a second copy.
          </p>
        )}
        {formState.error && <p className="text-sm text-red-600">{formState.error}</p>}

        <input type="hidden" name="barcode" value={review.barcode} />
        <input type="hidden" name="metadataSource" value={review.metadataSource} />
        <input type="hidden" name="rawMetadata" value={review.rawMetadata} />

        <div className="flex flex-col gap-1">
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            name="category"
            value={review.category}
            onChange={(e) => {
              const category = e.target.value as Category;
              setReview({ ...review, category, formats: [] });
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

        {categoryFormats[review.category].length > 0 && (
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Formats</span>
            <div className="flex flex-wrap gap-3">
              {categoryFormats[review.category].map((format) => (
                <label key={format} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="formats"
                    value={format}
                    checked={review.formats.includes(format)}
                    onChange={(e) => {
                      setReview({
                        ...review,
                        formats: e.target.checked
                          ? [...review.formats, format]
                          : review.formats.filter((f) => f !== format),
                      });
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
            defaultValue={review.title}
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
            placeholder="Defaults to the title above"
            className={inputClass}
          />
          <p className="text-xs text-neutral-500">
            Optional override for sorting only — e.g. &ldquo;Hobbit, The&rdquo; so it sorts under
            H.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="subtitle" className={labelClass}>
            Subtitle
          </label>
          <input
            id="subtitle"
            name="subtitle"
            defaultValue={review.subtitle}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="creators" className={labelClass}>
            {review.category === "music" ? "Artist" : "Creators"}
          </label>
          <input
            id="creators"
            name="creators"
            list="known-creators"
            defaultValue={review.creators}
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
            defaultValue={review.year}
            className={inputClass}
          />
        </div>

        {review.category === "book" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="isbn" className={labelClass}>
              ISBN
            </label>
            <input id="isbn" name="isbn" defaultValue={review.isbn} className={inputClass} />
          </div>
        )}

        {review.category === "book" && (
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="series" className={labelClass}>
                Series
              </label>
              <input id="series" name="series" list="known-series" className={inputClass} />
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
              <input id="seriesNumber" name="seriesNumber" className={inputClass} />
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
            defaultValue={review.coverImageUrl}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className={labelClass}>
            Notes
          </label>
          <textarea id="notes" name="notes" className={inputClass} />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save item"}
          </button>
          <button type="button" onClick={reset} className="underline text-sm">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="manualBarcode" className={labelClass}>
            Barcode
          </label>
          <input
            id="manualBarcode"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            inputMode="numeric"
            autoFocus
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={looking || !manualBarcode.trim()}
            onClick={() => handleDecoded(manualBarcode.trim())}
            className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
          >
            {looking ? "Looking up..." : "Look up"}
          </button>
          <button
            type="button"
            disabled={looking}
            onClick={() => handleSkipLookup(manualBarcode.trim())}
            className="underline text-sm"
          >
            Skip lookup
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMode("scanning")}
          className="underline text-sm text-left w-fit"
        >
          Use camera instead
        </button>
        <button
          type="button"
          onClick={handleBlankAdd}
          className="underline text-sm text-left w-fit"
        >
          Add item without scanning
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      {cameraError ? (
        <p className="text-sm text-red-600">{cameraError}</p>
      ) : (
        <video
          ref={videoRef}
          className="w-full rounded bg-black aspect-video"
          muted
          playsInline
        />
      )}
      {looking && <p className="text-sm text-neutral-500">Looking up metadata...</p>}
      <button
        type="button"
        onClick={() => setMode("manual")}
        className="underline text-sm text-left w-fit"
      >
        Enter barcode manually
      </button>
      <button
        type="button"
        onClick={handleBlankAdd}
        className="underline text-sm text-left w-fit"
      >
        Add item without scanning
      </button>
    </div>
  );
}
