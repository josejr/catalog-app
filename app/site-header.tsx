import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 py-3">
      <Link href="/" className="font-semibold tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
        Household Catalog
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Catalog
        </Link>
        <Link href="/scan" className="md:hidden hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Scan
        </Link>
        {session.user.role === "admin" && (
          <>
            <Link href="/admin/users" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Users
            </Link>
            <Link href="/admin/settings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Settings
            </Link>
          </>
        )}
        <span className="text-neutral-500">{session.user.name}</span>
        <form action={logoutAction}>
          <button type="submit" className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
