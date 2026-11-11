"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { filtersFromSearch, filtersToParams } from "@/lib/control-center/deployments";
import {
  CC_BASE,
  LAST_SCOPE_KEY,
  parseStoredScope,
  QUERY_SCOPED_PAGES,
  restorableScope,
  scopeTarget,
  serialiseScope,
  type Scope,
} from "@/lib/control-center/scope";

// One restore per page load: a link to the bare overview later in the same visit means All, and must stay All.
let restoredThisLoad = false;
// A restore is on its way: until the URL names a scope, the bare address must not overwrite what is remembered.
let restoring = false;

function read(): Scope {
  try {
    return parseStoredScope(window.localStorage.getItem(LAST_SCOPE_KEY));
  } catch {
    return {};
  }
}

function write(scope: Scope) {
  try {
    window.localStorage.setItem(LAST_SCOPE_KEY, serialiseScope(scope));
  } catch {
    // Storage may be blocked or full; remembering the scope is a courtesy.
  }
}

/**
 * Open where the person last was. When a visit starts on Overview, Deployments or Approvals with no scope in the URL,
 * go to the last scope used, if it still exists. After that, every scope the person visits is remembered, All included,
 * so choosing All is itself remembered.
 */
export function useRememberedScope(
  scope: Scope,
  organisations: { name: string; applications: { application: string }[] }[]
) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  useEffect(() => {
    if (organisations.length === 0) return; // the organisations decide whether a remembered scope still exists
    if (restoring && !scope.org) return;
    restoring = false;
    const bare = QUERY_SCOPED_PAGES.includes(pathname.replace(/\/+$/, "")) && !scope.org;
    if (!restoredThisLoad) {
      restoredThisLoad = true;
      if (bare) {
        const target = restorableScope(read(), organisations);
        if (target) {
          restoring = true;
          router.replace(scopeTarget(pathname, target, filtersToParams(filtersFromSearch(search))));
          return;
        }
      }
    }
    if (pathname.startsWith(CC_BASE) || scope.org) write(scope);
  }, [pathname, scope, organisations, router, search]);
}
