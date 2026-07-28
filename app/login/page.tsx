import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Household Catalog</h1>
      <LoginForm callbackUrl={callbackUrl ?? "/"} />
    </div>
  );
}
