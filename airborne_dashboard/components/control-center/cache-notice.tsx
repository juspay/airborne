"use client";

import { useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess, toastWarning } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import { useAsyncAction, useServingActions } from "@/lib/control-center/hooks";
import type { CacheInvalidationFailure } from "@/lib/control-center/rollback-error";
import type { CacheInvalidation } from "@/lib/control-center/types";
import { RelativeTime } from "./time";

/** Who may retry: the server accepts an organisation owner or admin, or an application admin. */
export function useCanRetryCache(org: string, app: string): boolean {
  const { getOrgAccess, getAppAccess, user } = useAppContext();
  const o = getOrgAccess(org);
  const a = getAppAccess(org, app);
  return Boolean(user?.is_super_admin) || o.includes("owner") || o.includes("admin") || a.includes("admin");
}

function RetryButton({
  org,
  app,
  size = "sm",
  link,
}: {
  org: string;
  app: string;
  size?: "sm" | "default";
  /** A text link instead of a button, for the one-line notice. */
  link?: boolean;
}) {
  const actions = useServingActions();
  const { pending, error, run } = useAsyncAction();
  const canRetry = useCanRetryCache(org, app);
  const retry = async () => {
    const ok = await run(async () => {
      await actions.retryCacheInvalidation(org, app);
      return true;
    });
    if (ok) toastSuccess("CDN cache invalidation submitted", app);
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size={size}
        variant={link ? "link" : "outline"}
        className={link ? "h-auto p-0 text-[13px] text-amber-800 dark:text-amber-300" : "border-amber-500/40"}
        onClick={retry}
        disabled={pending || !canRetry}
        title={
          canRetry
            ? "Repeats only the CDN invalidation. The deployment is not repeated."
            : `Only an organisation admin or an admin of ${app} can retry.`
        }
      >
        {!link && <RefreshCw className={cn(pending && "animate-spin")} />}{" "}
        {pending ? "Retrying…" : link ? "Retry" : "Retry cache clear"}
      </Button>
      {error && (
        <p role="alert" className="max-w-sm break-words text-xs text-amber-800 dark:text-amber-300">
          Still failing: {error}
        </p>
      )}
    </div>
  );
}

/** The app's latest CDN invalidation failed: devices may keep getting the previous release answer. */
export function CacheStaleNotice({
  org,
  app,
  cache,
  dense,
  className,
}: {
  org: string;
  app: string;
  cache: CacheInvalidation | null | undefined;
  dense?: boolean;
  className?: string;
}) {
  if (!cache || cache.status !== "failed") return null;
  const paths = cache.failed_paths ?? [];
  // One line where the page is already about something else. It is amber and unfilled: stale is not a failure of the release.
  if (dense) {
    return (
      <div
        role="status"
        className={cn("flex flex-wrap items-center gap-x-2 text-[13px] text-amber-800 dark:text-amber-300", className)}
        title="The last release change was saved, but the CDN kept its cached answer. Devices behind it may keep getting the previous release until the cache expires or a retry succeeds."
      >
        <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          CDN cache not cleared · <RelativeTime iso={cache.at} />
        </span>
        <RetryButton org={org} app={app} link />
      </div>
    );
  }
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-amber-500/50 p-3 text-sm sm:flex-row sm:items-start sm:gap-3",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            CDN cache not cleared · <RelativeTime iso={cache.at} />
          </span>
        </p>
        <p className="text-muted-foreground">
          The last release change was saved, but the CDN kept its cached answer
          {paths.length > 0 ? ` for ${paths.length} path${paths.length === 1 ? "" : "s"}` : ""}
          {cache.attempts_per_path ? ` after ${cache.attempts_per_path} attempts each` : ""}. Devices behind the CDN may
          keep getting the previous release until the cache expires or a retry succeeds.
        </p>
        {paths.length > 0 && (
          <ul className="space-y-0.5">
            {paths.map((p) => (
              <li key={p} className="break-all font-mono text-xs text-muted-foreground">
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>
      <RetryButton org={org} app={app} />
    </div>
  );
}

/**
 * One line for a group of apps whose CDN cache is stale, instead of one panel per app. Retry all repeats only the
 * CDN invalidation for each of them, for the apps the signed-in person may retry.
 */
export function GroupCacheNotice({
  org,
  apps,
  className,
}: {
  org: string;
  apps: { application: string; cache_invalidation?: CacheInvalidation | null }[];
  className?: string;
}) {
  const actions = useServingActions();
  const { getOrgAccess, getAppAccess, user } = useAppContext();
  const { pending, error, run } = useAsyncAction();
  const [failures, setFailures] = useState<{ app: string; message: string }[]>([]);
  const stale = apps.filter((a) => a.cache_invalidation?.status === "failed");
  if (stale.length === 0) return null;
  const o = getOrgAccess(org);
  const orgAdmin = Boolean(user?.is_super_admin) || o.includes("owner") || o.includes("admin");
  const mayRetry = stale.filter((a) => orgAdmin || getAppAccess(org, a.application).includes("admin"));
  const oldest = stale
    .map((a) => a.cache_invalidation?.at)
    .filter((t): t is string => Boolean(t))
    .sort()[0];
  const names = stale.map((a) => a.application).join(", ");

  const skipped = stale.length - mayRetry.length;
  const retryAll = async () => {
    const failed: { app: string; message: string }[] = [];
    setFailures([]);
    const done = await run(async () => {
      for (const a of mayRetry) {
        try {
          await actions.retryCacheInvalidation(org, a.application);
        } catch (e) {
          failed.push({ app: a.application, message: e instanceof Error ? e.message : String(e) });
        }
      }
      if (failed.length === mayRetry.length) {
        throw new Error(failed.map((f) => `${f.app}: ${f.message}`).join("; "));
      }
      return true;
    });
    setFailures(failed);
    if (done) {
      const left = [
        ...(failed.length > 0 ? [`still failing on ${failed.map((f) => `${f.app} (${f.message})`).join(", ")}`] : []),
        ...(skipped > 0 ? [`${skipped} not retried: only an admin of those apps can`] : []),
      ];
      if (left.length === 0) {
        toastSuccess("CDN cache invalidation submitted", `${mayRetry.length} app${mayRetry.length === 1 ? "" : "s"}`);
      } else {
        toastWarning(
          `CDN cache cleared on ${mayRetry.length - failed.length} of ${stale.length} app${stale.length === 1 ? "" : "s"}`,
          left.join("; ")
        );
      }
    } else {
      toastError("CDN cache not cleared", "Every retry failed.");
    }
  };

  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-2 text-[13px] text-amber-800 dark:text-amber-300", className)}
      title={`${names}. The last release change was saved, but the CDN kept its cached answer. Devices behind it may keep getting the previous release until the cache expires or a retry succeeds.`}
    >
      <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        CDN cache not cleared on {stale.length === 1 ? stale[0].application : `${stale.length} apps`}
        {oldest && (
          <>
            {" "}
            · <RelativeTime iso={oldest} />
          </>
        )}
      </span>
      <Button
        size="sm"
        variant="link"
        className="h-auto p-0 text-[13px] text-amber-800 dark:text-amber-300"
        onClick={retryAll}
        disabled={pending || mayRetry.length === 0}
        title={
          mayRetry.length === 0
            ? "Only an organisation admin or an admin of the app can retry."
            : "Repeats only the CDN invalidation. The deployments are not repeated."
        }
      >
        {pending ? "Retrying…" : stale.length === 1 ? "Retry" : "Retry all"}
      </Button>
      {error && (
        <span role="alert" className="text-xs">
          {error}
        </span>
      )}
      {!error && failures.length > 0 && (
        <span role="alert" className="text-xs">
          Still failing on {failures.map((f) => `${f.app} (${f.message})`).join(", ")}.
        </span>
      )}
      {skipped > 0 && (
        <span className="text-xs">{skipped} not retried: only an organisation admin or the app&apos;s admin can.</span>
      )}
    </div>
  );
}

/**
 * Shown inside a write dialog when the server answered 502 cache_invalidation_failed. The write itself
 * was not refused: the server says it may have committed, so the operator re-reads and retries the cache only.
 */
export function CacheFailureAfterWrite({
  failure,
  org,
  app,
  what,
}: {
  failure: CacheInvalidationFailure;
  org: string;
  app: string;
  /** The change that was sent, e.g. "The new target". */
  what: string;
}) {
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-amber-500/50 p-3 text-sm">
      <p className="font-medium text-amber-800 dark:text-amber-300">Saved, but the CDN cache was not cleared</p>
      <p className="text-muted-foreground">
        {failure.mutationMayHaveCommitted
          ? `${what} is recorded on the server. `
          : `${what} may or may not be recorded; the page refreshes to show the server's state. `}
        The CDN still holds the previous release answer, so devices behind it may not see this change yet. Do not repeat
        the change. Retry clearing the cache; this does not repeat the deployment.
      </p>
      {failure.failedPaths.length > 0 && (
        <ul className="space-y-0.5">
          {failure.failedPaths.map((p) => (
            <li key={p} className="break-all font-mono text-xs text-muted-foreground">
              {p}
            </li>
          ))}
        </ul>
      )}
      <RetryButton org={org} app={app} />
      <p className="break-words text-xs text-muted-foreground">Server said: {failure.message}</p>
    </div>
  );
}
