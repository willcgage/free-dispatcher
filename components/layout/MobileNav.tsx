"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OperatorRole } from "@/lib/db/schema";

const ITEMS: { href: string; label: string; icon: string; roles?: OperatorRole[] }[] = [
  { href: "/dispatch", label: "Dispatch", icon: "🎛", roles: ["dispatcher", "admin"] },
  { href: "/trains", label: "Trains", icon: "🚂" },
  { href: "/modules", label: "Modules", icon: "🧩" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function MobileNav({ role }: { role: OperatorRole }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-800 bg-slate-900/95 backdrop-blur"
      style={{ paddingBottom: "var(--fd-safe-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
              active ? "text-sky-400" : "text-slate-400"
            }`}
            style={{ minHeight: "var(--fd-nav-height)" }}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
