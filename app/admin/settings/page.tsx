import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user.role !== "admin") {
    redirect("/");
  }

  const omdbApiKey = await getSetting("omdbApiKey");

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsForm omdbApiKeySet={Boolean(omdbApiKey)} />
    </div>
  );
}
