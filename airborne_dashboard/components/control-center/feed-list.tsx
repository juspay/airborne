"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, History, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  actionLabel,
  chainText,
  completenessNote,
  dayLabel,
  groupFeed,
  readableSummary,
  releaseLabel,
  supersededApprovals,
  type FeedView,
} from "@/lib/control-center/deployments";
import { platformLabel } from "@/lib/control-center/format";
import { useNow } from "@/lib/control-center/hooks";
import type { DeploymentFeedItem } from "@/lib/control-center/types";
import { ActionChip } from "./feed-action";
import { PlatformIcon } from "./platform-mark";
import { appPath, releasePath } from "./paths";
import { RelativeTime } from "./time";
import { EmptyState } from "./states";

/** Where a row goes: its release when it has one, else the application's own page. */
export function rowHref(it: DeploymentFeedItem): string {
  return it.release_id ? releasePath(it.org, it.app, it.release_id) : appPath(it.org, it.app);
}

function Target({ it }: { it: DeploymentFeedItem }) {
  if (it.from_target == null && it.to_target == null) return null;
  // The rollout target, never adoption: the word is on the row.
  return (
    <span className="whitespace-nowrap tabular-nums text-xs text-muted-foreground" title="Rollout target, not devices">
      target {it.from_target == null ? "" : `${it.from_target}% → `}
      {it.to_target == null ? "?" : `${it.to_target}%`}
    </span>
  );
}

/** A row the operator wrote, not the original event: said on the row, never only in the summary. */
function RecoveredMark() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-200"
      title="An operator confirmed this write after an ambiguous upstream result. The action is what it completed."
    >
      <LifeBuoy className="h-3 w-3" aria-hidden />
      Recovered
    </span>
  );
}

/** The chip for an event; an approval that a later outcome overtook says so, so it never reads as the final state. */
function EventChip({ it, outcome, className }: { it: DeploymentFeedItem; outcome?: string; className?: string }) {
  return outcome ? (
    <ActionChip action={outcome} label={`Approved → ${actionLabel(outcome)}`} className={className} />
  ) : (
    <ActionChip action={it.action} className={className} />
  );
}

type Names = (id: string) => string | undefined;

function Meta({
  it,
  showOrg,
  groupName,
  withRelease,
}: {
  it: DeploymentFeedItem;
  showOrg: boolean;
  groupName: Names;
  withRelease: boolean;
}) {
  const label = releaseLabel(it);
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      {it.platform && (
        <span className="inline-flex items-center gap-1">
          <PlatformIcon platform={it.platform} />
          {platformLabel(it.platform)}
        </span>
      )}
      <span className="font-mono">{it.app}</span>
      {showOrg && <span>· {it.org}</span>}
      {it.group && groupName(it.group) && <span className="truncate">· {groupName(it.group)}</span>}
      {withRelease && label && <span className="tabular-nums">· {label}</span>}
      {it.actor && (
        <span className="truncate">
          · {it.recovered ? "operator " : ""}
          {it.actor}
        </span>
      )}
    </p>
  );
}

const ROW_GRID = "md:grid-cols-[6rem_13rem_minmax(0,1fr)_auto] md:items-baseline";
const ROW_BASE = "grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left text-sm";
const ROW_HOVER =
  "hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** One event, one row, linking to its release. */
function SingleRow({
  it,
  outcome,
  showOrg,
  groupName,
}: {
  it: DeploymentFeedItem;
  outcome?: string;
  showOrg: boolean;
  groupName: Names;
}) {
  const summary = readableSummary(it);
  const label = releaseLabel(it);
  return (
    <li>
      <Link href={rowHref(it)} className={cn("group", ROW_BASE, ROW_GRID, ROW_HOVER)}>
        <RelativeTime iso={it.at} className="text-xs text-muted-foreground" />
        <span className="flex flex-wrap items-center gap-1.5">
          <EventChip it={it} outcome={outcome} className="text-xs" />
          {it.recovered && <RecoveredMark />}
        </span>
        <div className="min-w-0">
          <p className="break-words">{summary}</p>
          <Meta it={it} showOrg={showOrg} groupName={groupName} withRelease={!label || !summary.includes(label)} />
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <Target it={it} />
          <ChevronRight
            className="hidden h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}

/**
 * Several consecutive events of one release: one row that opens into its steps. The row says what the newest step
 * is and, in words, the path the release took; "Open release" is inside, so the row itself only expands.
 */
function GroupRow({
  steps,
  outcomes,
  showOrg,
  groupName,
}: {
  steps: DeploymentFeedItem[];
  outcomes: Map<string, string>;
  showOrg: boolean;
  groupName: Names;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const head = steps[0];
  const label = releaseLabel(head);
  // Oldest to newest reads as the release's path.
  const path = [...steps].reverse().map((s) => actionLabel(s.action));
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn("group", ROW_BASE, ROW_GRID, ROW_HOVER)}
      >
        <RelativeTime iso={head.at} className="text-xs text-muted-foreground" />
        <span className="flex flex-wrap items-center gap-1.5">
          <EventChip it={head} outcome={outcomes.get(head.event_id)} className="text-xs" />
          {steps.some((s) => s.recovered) && <RecoveredMark />}
        </span>
        <div className="min-w-0">
          <p className="break-words">
            {label && <span className="font-medium tabular-nums">{label}</span>}
            {label && " · "}
            <span className="text-muted-foreground">{chainText(path)}</span>
          </p>
          <Meta it={head} showOrg={showOrg} groupName={groupName} withRelease={false} />
        </div>
        <div className="flex items-center gap-2 md:justify-end">
          <Target it={head} />
          <span className="whitespace-nowrap text-xs text-muted-foreground">{steps.length} steps</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </div>
      </button>
      {open && (
        <div id={id} className="border-t bg-muted/20 px-4 py-2">
          <ol className="divide-y">
            {steps.map((s) => (
              <li
                key={s.event_id}
                className="grid gap-x-4 gap-y-1 py-2 text-sm md:grid-cols-[6rem_13rem_minmax(0,1fr)_auto] md:items-baseline"
              >
                <RelativeTime iso={s.at} className="text-xs text-muted-foreground" />
                <span className="flex flex-wrap items-center gap-1.5">
                  <EventChip it={s} outcome={outcomes.get(s.event_id)} className="text-xs" />
                  {s.recovered && <RecoveredMark />}
                </span>
                <div className="min-w-0">
                  <p className="break-words">{readableSummary(s)}</p>
                  {s.actor && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.recovered ? "operator " : ""}
                      {s.actor}
                    </p>
                  )}
                </div>
                <div className="md:text-right">
                  <Target it={s} />
                </div>
              </li>
            ))}
          </ol>
          <Link
            href={rowHref(head)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            Open {label ?? "release"}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      )}
    </li>
  );
}

/** Events newest first, under a heading per day. Consecutive events of one release share a row. */
export function FeedList({
  items,
  showOrg,
  groupName,
}: {
  items: DeploymentFeedItem[];
  showOrg: boolean;
  groupName: Names;
}) {
  const now = useNow(60_000);
  const rows = useMemo(() => groupFeed(items), [items]);
  const outcomes = useMemo(() => supersededApprovals(items), [items]);
  let lastDay = "";
  return (
    <ol className="divide-y rounded-lg border bg-card text-card-foreground" data-testid="feed-list">
      {rows.map(({ items: steps }) => {
        const head = steps[0];
        const day = dayLabel(head.at, now);
        const heading = day !== lastDay;
        lastDay = day;
        return (
          <Fragment key={head.event_id}>
            {heading && (
              <li
                aria-hidden={false}
                className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </li>
            )}
            {steps.length === 1 ? (
              <SingleRow it={head} outcome={outcomes.get(head.event_id)} showOrg={showOrg} groupName={groupName} />
            ) : (
              <GroupRow steps={steps} outcomes={outcomes} showOrg={showOrg} groupName={groupName} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Where the full account of what is and is not recorded lives. */
export const FEED_DOCS_HREF = "https://airborne.juspay.in/docs/dashboard/control-center#deployments";

/**
 * The foot of the feed, for the person reading it, not for the engineer: two plain sentences (what is shown, what an
 * empty stretch does and does not mean) and a link to the page that explains it. The server's own list of limits, in
 * its own technical words, is behind "Details". Never "every event". Says nothing when the server said nothing.
 */
export function CompletenessFoot({ completeness }: { completeness: FeedView["completeness"] }) {
  const note = completenessNote(completeness);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!note) return null;
  return (
    <div className="text-center text-xs text-muted-foreground" data-testid="completeness">
      <p className="mx-auto max-w-2xl">
        {note.text}{" "}
        {note.notes.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((v) => !v)}
              className="rounded underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {open ? "Hide details" : "Details"}
            </button>
            {" · "}
          </>
        )}
        <a
          href={FEED_DOCS_HREF}
          target="_blank"
          rel="noreferrer"
          className="rounded underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          How events are recorded
        </a>
      </p>
      {open && (
        <div id={id} className="mx-auto mt-2 max-w-2xl text-left">
          <p className="font-medium text-foreground">Technical notes from the server</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {note.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Shown whenever any loaded page was partial. Never replaced by an empty or healthy-looking feed. */
export function PartialNotice({ view, onRetry }: { view: FeedView; onRetry: () => void }) {
  const n = view.errors.length;
  return (
    <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="flex-1">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            This feed is incomplete
            {n > 0 ? `: ${n} ${n === 1 ? "application" : "applications"} could not be read.` : "."}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Events from the applications below may be missing. An empty stretch here is not proof that nothing happened.
            {view.errors.some((e) => /deadline/i.test(e.reason)) &&
              " The server was busy and ran out of time on some reads; retry in a moment."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
      {n > 0 && (
        <ul className="mt-3 space-y-1 border-t border-amber-500/20 pt-2 text-xs">
          {view.errors.map((e) => (
            <li key={`${e.org}/${e.app ?? ""}/${e.reason}`} className="flex flex-wrap gap-x-2">
              <span className="font-mono">{e.app ? `${e.org} / ${e.app}` : `${e.org} (whole organisation)`}</span>
              <span className="text-muted-foreground">{e.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedEmpty({
  filtered,
  partial,
  onClear,
}: {
  filtered: boolean;
  partial: boolean;
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={History}
      title={
        partial
          ? "No events from the applications that could be read"
          : filtered
            ? "No events match these filters"
            : "No release events in this scope yet"
      }
      message={
        partial
          ? "Some applications could not be read, so this is not a complete answer."
          : filtered
            ? "Try a longer time range or fewer filters."
            : "Events appear here when a release is created, ramped, concluded, rolled back or put through approval."
      }
      action={
        filtered ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
      className={cn(partial && "border-amber-500/40")}
    />
  );
}
