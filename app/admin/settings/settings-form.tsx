"use client";

import { useActionState } from "react";
import { clearOmdbApiKeyAction, updateSettingsAction } from "./actions";

export function SettingsForm({ omdbApiKeySet }: { omdbApiKeySet: boolean }) {
  const [error, formAction, pending] = useActionState(updateSettingsAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-1">
        <label htmlFor="omdbApiKey" className="text-sm font-medium">
          OMDb API key
        </label>
        <input
          id="omdbApiKey"
          name="omdbApiKey"
          placeholder={omdbApiKeySet ? "Currently set — leave blank to keep it" : "Not set"}
          className="border rounded px-3 py-2 bg-transparent"
        />
        <p className="text-xs text-neutral-500">
          Used to enrich DVD entries with title, year, director, and cover art. Get a free key at{" "}
          <a
            href="https://www.omdbapi.com/apikey.aspx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            omdbapi.com/apikey.aspx
          </a>
          .
        </p>
        {omdbApiKeySet && (
          <button
            type="submit"
            formAction={clearOmdbApiKeyAction}
            className="self-start text-sm underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
          >
            Clear key
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t pt-4">
        <span className="text-sm font-medium">Books &amp; CDs</span>
        <p className="text-xs text-neutral-500">
          Book lookups use Open Library and CD lookups use MusicBrainz — both are free and need no API
          key to configure.
        </p>
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
