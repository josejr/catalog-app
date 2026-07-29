import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { allFormats, getFormatColors } from "@/lib/format-colors";
import { getSetting } from "@/lib/settings";
import { FormatColorsForm } from "./format-colors-form";
import { SettingsForm } from "./settings-form";

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-500" : "bg-neutral-400"}`}
    />
  );
}

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") {
    redirect("/");
  }

  const omdbApiKey = await getSetting("omdbApiKey");
  const omdbConfigured = Boolean(omdbApiKey);
  const tmdbApiKey = await getSetting("tmdbApiKey");
  const tmdbConfigured = Boolean(tmdbApiKey);
  const hardcoverApiKey = await getSetting("hardcoverApiKey");
  const hardcoverConfigured = Boolean(hardcoverApiKey);
  const formatColors = await getFormatColors();

  return (
    <div className="flex-1 p-6 flex flex-col gap-8 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Books</h2>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active />
          Active — Open Library, free with no API key needed.
        </p>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active={hardcoverConfigured} />
          Hardcover {hardcoverConfigured ? "— API key configured." : "— not configured."}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">CDs</h2>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active />
          Active — MusicBrainz, free with no API key needed.
        </p>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active />
          iTunes (cover art) — free, no API key needed.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Movies</h2>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active={omdbConfigured} />
          OMDb {omdbConfigured ? "— API key configured." : "— not configured."}
        </p>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active={tmdbConfigured} />
          TMDB {tmdbConfigured ? "— API key configured." : "— not configured."}
        </p>
        <p className="text-sm text-neutral-500 flex items-center gap-2">
          <StatusDot active />
          iTunes (cover art) — free, no API key needed.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">API keys</h2>
        <SettingsForm
          omdbApiKeySet={omdbConfigured}
          tmdbApiKeySet={tmdbConfigured}
          hardcoverApiKeySet={hardcoverConfigured}
        />
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Pill colors</h2>
        <p className="text-sm text-neutral-500">
          Colors used for the format pills on the catalog grid view.
        </p>
        <FormatColorsForm formats={allFormats} colors={formatColors} />
      </section>
    </div>
  );
}
