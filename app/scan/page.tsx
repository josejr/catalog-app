import { getKnownCreators, getKnownSeries } from "@/lib/catalog-values";
import { Scanner } from "./scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ blank?: string }>;
}) {
  const { blank } = await searchParams;
  const [knownCreators, knownSeries] = await Promise.all([getKnownCreators(), getKnownSeries()]);

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Scan an item</h1>
      <Scanner
        startBlank={blank === "1"}
        knownCreators={knownCreators}
        knownSeries={knownSeries}
      />
    </div>
  );
}
