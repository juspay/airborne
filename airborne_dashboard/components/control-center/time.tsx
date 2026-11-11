"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { absoluteTime, relativeTime } from "@/lib/control-center/format";
import { useNow } from "@/lib/control-center/hooks";

export function RelativeTime({
  iso,
  className,
  prefix,
}: {
  iso: string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const now = useNow();
  if (!iso) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <time dateTime={iso} title={absoluteTime(iso)} className={cn("whitespace-nowrap tabular-nums", className)}>
      {prefix}
      {relativeTime(iso, now)}
    </time>
  );
}

export function LastUpdated({
  at,
  pollMs,
  isValidating,
  onRefresh,
  unknown,
  className,
}: {
  at: Date | null;
  pollMs: number;
  isValidating: boolean;
  onRefresh?: () => void;
  /** The page loaded, but part of its state could not be read: "updated just now" would claim more than it knows. */
  unknown?: boolean;
  className?: string;
}) {
  const now = useNow(1000);
  const seconds = at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;
  if (unknown) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <span>State not fully read</span>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={!onRefresh || isValidating}>
          <RefreshCw className={cn("h-3.5 w-3.5", isValidating && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <button
        type="button"
        onClick={onRefresh}
        disabled={!onRefresh || isValidating}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-accent/10 hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent"
        title={at ? `Last updated ${absoluteTime(at.toISOString())}. Polling every ${pollMs / 1000}s.` : "Loading"}
      >
        <RefreshCw className={cn("h-3 w-3", isValidating && "animate-spin")} aria-hidden />
        <span className="tabular-nums">
          {seconds === null ? "Loading…" : seconds < 2 ? "Updated just now" : `Updated ${seconds}s ago`}
        </span>
      </button>
      <span className="hidden sm:inline text-muted-foreground/70">· every {pollMs / 1000}s</span>
    </div>
  );
}
