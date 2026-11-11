"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PINNED_CAP, capPinned, pinnedApps, type NowApp, type NowBucket } from "@/lib/control-center/deployments";
import { primaryActive } from "@/lib/control-center/format";
import { accentFor } from "./app-status-row";
import { PlatformIcon } from "./platform-mark";
import { appPath, releasePath } from "./paths";
import { RelativeTime } from "./time";
import { PanelTitle } from "./states";

const HEADING: Partial<Record<NowBucket, string>> = {
  attention: "Needs attention",
  rolling: "Rolling out",
};

function contextOf(r: NowApp, showOrg: boolean): string | undefined {
  const bits = [showOrg ? r.org : null, r.group?.name ?? null].filter(Boolean);
  return bits.length ? bits.join(" · ") : undefined;
}

const sentence = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/**
 * One pinned application on one line (about 44px): which application, why it is here, when it last moved. The full
 * row (live release, rollout bar, policy chips, recovery) is on the Overview and the application's own page, which
 * the name links to; this list is a queue to read down, not a second Overview.
 */
function PinnedLine({ r, showOrg }: { r: NowApp; showOrg: boolean }) {
  const { app, org } = r;
  const context = contextOf(r, showOrg);
  const active = primaryActive(app);
  const extra = app.active.length - (active ? 1 : 0);
  return (
    <li
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-x-4 gap-y-0.5 border-l-2 px-4 py-1.5 text-sm md:grid md:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)_auto] md:flex-nowrap md:py-0",
        accentFor(app)
      )}
      data-testid="pinned-line"
    >
      <div className="flex min-w-0 items-center gap-2">
        <PlatformIcon platform={app.platform} className="text-muted-foreground" />
        <Link
          href={appPath(org, app.application)}
          className="shrink-0 truncate font-mono text-xs hover:underline"
          title={`Open ${app.application}: policies, approvals and state`}
        >
          {app.application}
        </Link>
        {context && (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={context}>
            {context}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-xs md:flex-nowrap">
        {r.bucket === "attention" && r.reasons.length > 0 && (
          <span className="truncate font-medium text-foreground" data-testid="pinned-reason">
            {sentence(r.reasons.join(" · "))}
          </span>
        )}
        {r.bucket === "attention" && app.error && (
          <span className="truncate text-muted-foreground" title={app.error}>
            {app.error}
          </span>
        )}
        {r.bucket === "rolling" && active && (
          <>
            <Link
              href={releasePath(org, app.application, active.release_id)}
              className="shrink-0 font-semibold tabular-nums hover:underline"
              title={`Open release ${active.release_id}`}
            >
              v{active.package_version}
            </Link>
            <span className="shrink-0 text-muted-foreground">
              {active.status === "INPROGRESS" ? "rolling out" : "not started"}
            </span>
            <span className="flex shrink-0 items-center gap-2" title="Rollout target, not devices">
              <span className="tabular-nums">{active.traffic_percentage}% target</span>
              <span className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-sky-500"
                  style={{ width: `${Math.max(0, Math.min(100, active.traffic_percentage))}%` }}
                />
              </span>
            </span>
            {extra > 0 && <span className="shrink-0 text-muted-foreground">+{extra} more</span>}
          </>
        )}
      </div>
      {app.last_activity_at ? (
        <RelativeTime iso={app.last_activity_at} className="text-xs text-muted-foreground md:text-right" />
      ) : (
        <span aria-hidden />
      )}
    </li>
  );
}

/**
 * Above the feed: what needs a person and what is moving. What is simply live, or has nothing live, is the Overview's
 * job and is not repeated here. Applications that need a person come first, with the reason in words. Returns nothing
 * when neither list has an entry; the caller says so.
 */
export function NowSection({ rows, showOrg }: { rows: NowApp[]; showOrg: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const pinned = pinnedApps(rows);
  const { shown, hiddenAttention, hiddenRolling } = capPinned(pinned, expanded);
  const hidden = hiddenAttention + hiddenRolling;
  const buckets: NowBucket[] = ["attention", "rolling"];
  const more = [
    hiddenAttention > 0 ? `${hiddenAttention} more ${hiddenAttention === 1 ? "needs" : "need"} attention` : null,
    hiddenRolling > 0 ? `${hiddenRolling} more rolling out` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const list = shown.filter((r) => r.bucket === b);
        if (list.length === 0) return null;
        const total = pinned.filter((r) => r.bucket === b).length;
        return (
          <section
            key={b}
            aria-label={HEADING[b]}
            className={cn("rounded-lg border bg-card text-card-foreground", b === "attention" && "border-red-500/30")}
          >
            <header className="flex items-baseline gap-2 border-b px-4 py-2">
              <PanelTitle>{HEADING[b]}</PanelTitle>
              <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
            </header>
            <ul className="divide-y">
              {list.map((r) => (
                <PinnedLine key={`${r.org}/${r.app.application}`} r={r} showOrg={showOrg} />
              ))}
            </ul>
          </section>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-lg border border-dashed px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          data-testid="pinned-more"
        >
          {more}. Show all {pinned.length}
        </button>
      )}
      {expanded && pinned.length > PINNED_CAP + 1 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          data-testid="pinned-fewer"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
