import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-b flex items-center justify-between px-6 py-3">
      <Link href="/" className="font-semibold">
        Household Catalog
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/">Catalog</Link>
        <Link href="/scan" className="md:hidden">
          Scan
        </Link>
        {session.user.role === "admin" && (
          <Link href="/admin/users">Users</Link>
        )}
        <span className="text-neutral-500">{session.user.name}</span>
        <form action={logoutAction}>
          <button type="submit" className="underline">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
