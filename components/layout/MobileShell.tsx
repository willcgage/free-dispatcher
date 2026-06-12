"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getOperator, type Operator } from "@/lib/client/operator";
import { MobileNav } from "./MobileNav";

/**
 * Mobile shell: gates operator routes behind a join, renders the page content
 * in a safe-area-padded scroll area, and mounts the bottom nav. The /join
 * screen renders without the nav (operator not yet identified).
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<{ checked: boolean; operator: Operator | null }>(
    { checked: false, operator: null },
  );
  const { checked, operator } = auth;

  const isJoin = pathname === "/join";

  useEffect(() => {
    // Read operator identity from sessionStorage on mount (not available during
    // SSR; reading in render would cause a hydration mismatch).
    const op = getOperator();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuth({ checked: true, operator: op });
    if (!op && !isJoin) router.replace("/join");
  }, [isJoin, router]);

  if (isJoin) {
    return <div className="fd-mobile min-h-screen bg-slate-950 text-slate-100">{children}</div>;
  }

  if (!checked || !operator) {
    return (
      <div className="fd-mobile flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="fd-mobile min-h-screen bg-slate-950 text-slate-100">
      <div className="fd-mobile-scroll mx-auto max-w-md px-4 pt-4">{children}</div>
      <MobileNav role={operator.role} />
    </div>
  );
}
