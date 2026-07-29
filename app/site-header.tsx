import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { categories } from "@/lib/db/schema";
import { categoryFormats, categoryLabels, formatLabel } from "@/lib/categories";

const menuLinkClass =
  "rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors";

export async function SiteHeader() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 py-3">
      <Link href="/" className="font-semibold tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
        Household Catalog
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <details className="relative">
          <summary className="cursor-pointer list-none select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Catalog
          </summary>
          <div className="absolute left-0 mt-2 w-56 rounded-lg border bg-background shadow-lg p-2 flex flex-col gap-1 z-20 text-sm max-h-[70vh] overflow-y-auto">
            <Link href="/" className={`${menuLinkClass} font-medium`}>
              All items
            </Link>
            {categories.map((cat) => (
              <div key={cat} className="flex flex-col">
                <Link href={`/?category=${cat}`} className={`${menuLinkClass} font-medium`}>
                  {categoryLabels[cat]}
                </Link>
                {categoryFormats[cat].length > 0 && (
                  <div className="flex flex-col pl-3">
                    {categoryFormats[cat].map((fmt) => (
                      <Link
                        key={fmt}
                        href={`/?category=${cat}&format=${fmt}`}
                        className={`${menuLinkClass} text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300`}
                      >
                        {formatLabel(fmt)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
        <Link href="/scan" className="md:hidden hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Scan
        </Link>
        <Link href="/scan?blank=1" className="hidden md:inline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Add Item
        </Link>
        <Link href="/stats" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Stats
        </Link>
        {session.user.role === "admin" && (
          <details className="relative">
            <summary className="cursor-pointer list-none select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Admin
            </summary>
            <div className="absolute right-0 mt-2 w-40 rounded-lg border bg-background shadow-lg p-2 flex flex-col gap-1 z-20 text-sm">
              <Link href="/admin/users" className={menuLinkClass}>
                Users
              </Link>
              <Link href="/admin/settings" className={menuLinkClass}>
                Settings
              </Link>
            </div>
          </details>
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
