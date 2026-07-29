"use client";

import { useActionState } from "react";
import { formatLabel } from "@/lib/categories";
import { updateFormatColorsAction } from "./actions";

export function FormatColorsForm({
  formats,
  colors,
}: {
  formats: string[];
  colors: Record<string, string>;
}) {
  const [error, formAction, pending] = useActionState(updateFormatColorsAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {formats.map((format) => (
          <div key={format} className="flex items-center justify-between gap-3">
            <label htmlFor={`color:${format}`} className="text-sm font-medium">
              {formatLabel(format)}
            </label>
            <input
              id={`color:${format}`}
              name={`color:${format}`}
              type="color"
              defaultValue={colors[format]}
              className="h-8 w-12 rounded border bg-transparent p-0.5"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50 self-start"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
