"use client";

import Link from "next/link";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeContext } from "@/lib/control-center/format";
import type { LiveRelease } from "@/lib/control-center/types";
import { Pkg } from "./version";
import { releasePath } from "./paths";

/**
 * A general release does not replace an older locale-targeted one: Superposition ranks contexts by
 * specificity, not by age. Names the locale audiences that keep their current package.
 */
export function LocaleExceptionsNotice({
  org,
  app,
  exceptions,
  verb = "Making this release live",
  dense,
  className,
}: {
  org: string;
  app: string;
  exceptions: LiveRelease[];
  /** What the operator is about to do, as the subject of the sentence. */
  verb?: string;
  dense?: boolean;
  className?: string;
}) {
  if (exceptions.length === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 text-sm",
        dense ? "p-2.5" : "p-3",
        className
      )}
    >
      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {exceptions.length === 1
            ? "One locale audience stays behind"
            : `${exceptions.length} locale audiences stay behind`}
        </p>
        <p className="text-muted-foreground">
          {verb} does not reach devices covered by a locale-targeted release: the more specific release keeps winning,
          however old it is.
        </p>
        <ul className={cn("space-y-1", dense && "text-xs")}>
          {exceptions.map((l) => (
            <li key={l.release_id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs">locale = {String(l.dimensions.locale)}</span>
              <span className="text-muted-foreground">keeps</span>
              <Link
                href={releasePath(org, app, l.release_id)}
                className="inline-flex items-baseline gap-1 hover:underline"
              >
                <Pkg version={l.package_version} size="sm" />
              </Link>
              {Object.keys(l.dimensions).length > 1 && (
                <span
                  className="truncate font-mono text-[11px] text-muted-foreground"
                  title={describeContext(l.dimensions)}
                >
                  {describeContext(l.dimensions)}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          To move a locale audience too, create a release targeted at that locale and make it live.
        </p>
      </div>
    </div>
  );
}
