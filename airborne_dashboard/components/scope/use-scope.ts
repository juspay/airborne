"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { scopeFromLocation, type Scope } from "@/lib/control-center/scope";

/** The scope the URL names. Stable between renders while the URL is unchanged. */
export function useScope(): Scope {
  const pathname = usePathname();
  const search = useSearchParams();
  const org = search?.get("org") ?? "";
  const group = search?.get("group") ?? "";
  const app = search?.get("app") ?? "";
  return useMemo(() => {
    const params = new URLSearchParams();
    if (org) params.set("org", org);
    if (group) params.set("group", group);
    if (app) params.set("app", app);
    return scopeFromLocation(pathname ?? "", params);
  }, [pathname, org, group, app]);
}
