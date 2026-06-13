"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ensureAdminToken } from "@/lib/client/api";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/session", label: "Session" },
  { href: "/admin/trains", label: "Trains" },
  { href: "/admin/modules", label: "Modules" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAdminToken()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "auth failed"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 w-56 border-r border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-6">
          <div className="text-lg font-bold tracking-tight">Free Dispatcher</div>
          <div className="text-xs text-slate-400">Admin · host console</div>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-56 p-6">
        {error ? (
          <div className="rounded-md border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            Admin auth error: {error}
          </div>
        ) : !ready ? (
          <div className="text-sm text-slate-400">Authorizing…</div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
