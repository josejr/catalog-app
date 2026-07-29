import { Scanner } from "./scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ blank?: string }>;
}) {
  const { blank } = await searchParams;

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Scan an item</h1>
      <Scanner startBlank={blank === "1"} />
    </div>
  );
}
