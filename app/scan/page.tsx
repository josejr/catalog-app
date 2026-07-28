import { Scanner } from "./scanner";

export default function ScanPage() {
  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-semibold">Scan an item</h1>
      <Scanner />
    </div>
  );
}
