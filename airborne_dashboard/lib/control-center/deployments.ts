// Rules for the Deployments page that do not need React: which actions each filter chip stands for, how filters sit
// in the URL, which applications are pinned above the feed, how events fall into days.

import { primaryActive } from "./format";
import { appTelemetryState } from "./telemetry";
import type { Scope } from "./scope";
import type {
  AppStatus,
  AuditCompleteness,
  DeploymentFeedAction,
  DeploymentFeedItem,
  DeploymentFeedPage,
  DeploymentFeedQuery,
  Overview,
  OverviewOrganisation,
} from "./types";

export const FEED_ACTIONS: DeploymentFeedAction[] = [
  "created",
  "ramped",
  "concluded",
  "rolled_back",
  "discarded",
  "emergency_rollback",
  "requested",
  "approved",
  "rejected",
  "expired",
  "cache_failed",
  "cache_retried",
  "policy_changed",
  "executed",
  "failed",
  "stale",
  "cancelled",
  "rollback_abandoned",
  "emergency_acknowledged",
];

export const ACTION_LABEL: Record<DeploymentFeedAction, string> = {
  created: "Created",
  ramped: "Target set",
  concluded: "Concluded",
  rolled_back: "Rolled back",
  discarded: "Discarded",
  emergency_rollback: "Emergency rollback",
  requested: "Approval requested",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Request expired",
  cache_failed: "CDN cache not cleared",
  cache_retried: "CDN cache retried",
  policy_changed: "Policy changed",
  executed: "Request executed",
  failed: "Request failed",
  stale: "Request out of date",
  cancelled: "Request cancelled",
  rollback_abandoned: "Rollback abandoned",
  emergency_acknowledged: "Emergency rollback reviewed",
};

/** "operation_resolved" -> "Operation resolved". For an action name this dashboard has no label for. */
export function humaniseAction(action: string): string {
  const words = action
    .replace(/[_\-\s]+/g, " ")
    .trim()
    .toLowerCase();
  if (!words) return "Unknown event";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The label for any action the server sent, known or not. */
export function actionLabel(action: string): string {
  return Object.prototype.hasOwnProperty.call(ACTION_LABEL, action)
    ? ACTION_LABEL[action as DeploymentFeedAction]
    : humaniseAction(action);
}

/** Action chips: each stands for a set of actions. They are the only action filter. */
export const STATUS_CHIPS: { key: string; label: string; actions: DeploymentFeedAction[] }[] = [
  { key: "rollouts", label: "Rollouts", actions: ["created", "ramped"] },
  { key: "concluded", label: "Concluded", actions: ["concluded"] },
  {
    key: "rolled_back",
    label: "Rolled back",
    actions: ["rolled_back", "emergency_rollback", "emergency_acknowledged", "rollback_abandoned"],
  },
  { key: "discarded", label: "Discarded", actions: ["discarded"] },
  {
    key: "approvals",
    label: "Approvals",
    actions: ["requested", "approved", "rejected", "expired", "executed", "failed", "stale", "cancelled"],
  },
  { key: "cache", label: "CDN cache", actions: ["cache_failed", "cache_retried"] },
  { key: "policy", label: "Policy", actions: ["policy_changed"] },
];

export type FeedPlatform = "web" | "android" | "ios";
export const FEED_PLATFORMS: FeedPlatform[] = ["web", "android", "ios"];

export type SinceRange = "any" | "24h" | "7d" | "30d";
export const SINCE_LABEL: Record<SinceRange, string> = {
  any: "Any time",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};
const SINCE_MS: Record<Exclude<SinceRange, "any">, number> = {
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
};

export interface FeedFilters {
  actions: DeploymentFeedAction[];
  platform?: FeedPlatform;
  actor: string;
  since: SinceRange;
}

export const NO_FILTERS: FeedFilters = { actions: [], platform: undefined, actor: "", since: "any" };

export function filtersActive(f: FeedFilters): boolean {
  return f.actions.length > 0 || Boolean(f.platform) || f.actor.trim() !== "" || f.since !== "any";
}

type Search = { get(name: string): string | null; getAll(name: string): string[] };

/** Unknown values in a hand-edited URL are ignored, never sent to the server. */
export function filtersFromSearch(search: Search | null | undefined): FeedFilters {
  if (!search) return NO_FILTERS;
  const actions = FEED_ACTIONS.filter((a) => search.getAll("action").includes(a));
  const p = search.get("platform");
  const s = search.get("since");
  return {
    actions,
    platform: FEED_PLATFORMS.find((x) => x === p),
    actor: (search.get("actor") ?? "").slice(0, 200),
    since: s === "24h" || s === "7d" || s === "30d" ? s : "any",
  };
}

export function filtersToParams(f: FeedFilters): Record<string, string | string[] | undefined> {
  return {
    action: f.actions.length ? f.actions : undefined,
    platform: f.platform,
    actor: f.actor.trim() || undefined,
    since: f.since === "any" ? undefined : f.since,
  };
}

/** Rounded down to the hour so every page of one feed asks for the same lower bound. */
export function sinceTimestamp(range: SinceRange, now: Date): string | undefined {
  if (range === "any") return undefined;
  const t = Math.floor((now.getTime() - SINCE_MS[range]) / 3600_000) * 3600_000;
  return new Date(t).toISOString();
}

export function feedQuery(scope: Scope, f: FeedFilters, now: Date): DeploymentFeedQuery {
  return {
    org: scope.org,
    group: scope.group,
    app: scope.app,
    action: f.actions.length ? f.actions : undefined,
    platform: f.platform,
    actor: f.actor.trim() || undefined,
    since: sinceTimestamp(f.since, now),
    limit: 50,
  };
}

/** `?org=&group=&app=&action=a&action=b&platform=&actor=&since=&cursor=&limit=`; empty values are left out. */
export function feedSearch(q: DeploymentFeedQuery): string {
  const p = new URLSearchParams();
  for (const k of ["org", "group", "app", "platform", "actor", "since", "cursor"] as const) {
    const v = q[k];
    if (v) p.set(k, v);
  }
  for (const a of q.action ?? []) p.append("action", a);
  if (q.limit) p.set("limit", String(q.limit));
  const text = p.toString();
  return text ? `?${text}` : "";
}

export function toggleChip(
  actions: DeploymentFeedAction[],
  chipActions: DeploymentFeedAction[]
): DeploymentFeedAction[] {
  const on = chipActions.every((a) => actions.includes(a));
  const next = new Set(actions);
  for (const a of chipActions) {
    if (on) next.delete(a);
    else next.add(a);
  }
  return FEED_ACTIONS.filter((a) => next.has(a));
}

// ---------------------------------------------------------------------------
// Pages of the feed
// ---------------------------------------------------------------------------

export interface FeedView {
  items: DeploymentFeedPage["items"];
  /** True when any loaded page said some applications could not be read. */
  partial: boolean;
  errors: DeploymentFeedPage["errors"];
  nextCursor: string | null;
  /** What the server said about its own completeness, if it said anything. */
  completeness: AuditCompleteness | string | null | undefined;
}

/** Pages, newest first. Events seen twice (a page boundary moved under a new event) are shown once. */
export function mergePages(pages: DeploymentFeedPage[]): FeedView {
  const seen = new Set<string>();
  const items: FeedView["items"] = [];
  const errors = new Map<string, DeploymentFeedPage["errors"][number]>();
  let partial = false;
  let completeness: AuditCompleteness | string | null | undefined;
  for (const p of pages) {
    for (const it of p.items) {
      if (seen.has(it.event_id)) continue;
      seen.add(it.event_id);
      items.push(it);
    }
    // `errors` without `partial: true` is still a read that failed: treat it as partial.
    if (p.partial || (p.errors?.length ?? 0) > 0) partial = true;
    for (const e of p.errors ?? []) errors.set(`${e.org}/${e.app ?? ""}/${e.reason}`, e);
    if (completeness === undefined && p.audit_completeness != null) completeness = p.audit_completeness;
  }
  const last = pages[pages.length - 1];
  return { items, partial, errors: [...errors.values()], nextCursor: last?.next_cursor ?? null, completeness };
}

/**
 * Polling reads only the first page. Its newest events are put in front of the pages already loaded, when the two
 * overlap (so nothing can sit between them). When more new events arrived than one page holds, nothing is merged and
 * `newer` says so: the caller offers a reload rather than showing a feed with a hole in it.
 */
export function mergeHead(
  pages: DeploymentFeedPage[],
  head: DeploymentFeedPage | undefined
): { pages: DeploymentFeedPage[]; newer: boolean } {
  if (!head || pages.length === 0) return { pages, newer: false };
  const first = pages[0];
  if (head === first) return { pages, newer: false };
  const known = new Set(first.items.map((i) => i.event_id));
  const overlaps = head.items.some((i) => known.has(i.event_id));
  if (!overlaps && head.items.length > 0 && first.items.length > 0) return { pages, newer: true };
  const fresh = new Set(head.items.map((i) => i.event_id));
  const merged: DeploymentFeedPage = {
    ...first,
    items: [...head.items, ...first.items.filter((i) => !fresh.has(i.event_id))],
    // The newest read of which applications could be read, and of what the server promises.
    partial: head.partial,
    errors: head.errors,
    audit_completeness: head.audit_completeness ?? first.audit_completeness,
  };
  return { pages: [merged, ...pages.slice(1)], newer: false };
}

// ---------------------------------------------------------------------------
// What the server says it cannot promise
// ---------------------------------------------------------------------------

export interface CompletenessNote {
  /** One sentence for the foot of the feed. */
  text: string;
  /** The server's own caveats, shown on request. */
  notes: string[];
}

const strings = (v: unknown, max = 12): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((x) => x.slice(0, 400))
        .slice(0, max)
    : [];

/**
 * An honest note from the server's `audit_completeness`, or nothing. The field is optional and may be a string or an
 * object; when it is absent the dashboard says nothing about completeness at all (it has no basis to).
 */
export function completenessNote(raw: AuditCompleteness | string | null | undefined): CompletenessNote | null {
  if (raw == null) return null;
  // Plain words for the foot of the feed. The server's own technical notes are behind "Details", not in this sentence.
  const asRecorded =
    "Events are shown as recorded. A few kinds of change are recorded late or not at all, so an event that is not here is not proof that it did not happen.";
  if (typeof raw === "string") {
    const word = raw
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, "_");
    if (word === "" || word === "complete") return null;
    if (word === "best_effort") {
      return {
        text: "Events are recorded on a best-effort basis. An event that is not here may still have happened.",
        notes: [],
      };
    }
    return {
      text: `${asRecorded} The server reports completeness as “${humaniseAction(raw).toLowerCase()}”.`,
      notes: [],
    };
  }
  if (typeof raw !== "object") return null;
  if (raw.complete === true) return null;
  const notes = strings((raw as { notes?: unknown }).notes);
  const lossy = strings((raw as { best_effort_actions?: unknown }).best_effort_actions);
  if (notes.length === 0 && lossy.length > 0) {
    notes.push(`Recorded after the change, so they can be lost: ${lossy.map(actionLabel).join(", ")}.`);
  }
  if (raw.complete !== false && notes.length === 0) return null;
  return { text: asRecorded, notes };
}

/** "Today", "Yesterday", or the date, in the viewer's time zone. */
export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** How a release is named on a row: its package version, else a short release id. `null` when there is neither. */
export function releaseLabel(it: Pick<DeploymentFeedItem, "package_version" | "release_id">): string | null {
  const v = it.package_version?.trim();
  if (v) return /^v\d/i.test(v) ? v : `v${v}`;
  const id = it.release_id?.trim();
  if (!id) return null;
  return id.length > 8 ? `release …${id.slice(-6)}` : `release ${id}`;
}

/** What happened to a release, as the end of a sentence about it. Only the actions that say it the same way every time. */
const HAPPENED: Record<string, (it: DeploymentFeedItem) => string> = {
  created: () => "created",
  ramped: (it) => (it.to_target != null ? `ramped to ${it.to_target}%` : "ramped"),
  concluded: () => "made live",
  discarded: () => "discarded",
  rolled_back: () => "rolled back",
  emergency_rollback: () => "rolled back in an emergency",
};

/** The server's own wording when it had nothing better to say: "Event on release 7522…". Never shown as it is. */
const GENERIC_SUMMARY = /^\s*(event on release\b|event\s*$)/i;

/**
 * What a row says, in words: "kharcha-ios v3 rolled back", "nav-web v4 ramped to 50%", "nav-web v2 made live". It is
 * built from the row's own application, package version and action, so it reads the same whatever the server wrote
 * (and never as "Event on release 000113"). A short release id stands in only where there is no version, and nothing
 * stands in where there is no release. Three kinds of row keep the server's sentence, because it says more than the
 * action does: an operator's recovery note, a request step (who asked for what), and an event with no fixed wording.
 * An unknown action with nothing but the generic sentence is its own label after the application.
 */
export function readableSummary(it: DeploymentFeedItem): string {
  const label = releaseLabel(it);
  const subject = [it.app, label].filter(Boolean).join(" ");
  const happened = HAPPENED[it.action];
  // A request step whose summary is only the action's own name ("requested") is no more of a sentence than the
  // generic one. Other events keep a short summary: "Policy changed" is already what it is.
  const bare =
    ["requested", "approved", "rejected", "expired", "executed", "failed", "stale", "cancelled"].includes(it.action) &&
    it.summary.trim().toLowerCase() === it.action;
  const generic = it.summary.trim() === "" || GENERIC_SUMMARY.test(it.summary) || bare;
  if (happened && !it.recovered) return `${subject} ${happened(it)}`;
  if (generic) return `${subject} ${actionLabel(it.action).toLowerCase()}`;
  const id = it.release_id?.trim();
  if (!id || !label || !it.summary.includes(id)) return it.summary;
  return it.summary.split(`release ${id}`).join(label).split(id).join(label);
}

const OUTCOMES = ["executed", "failed", "stale", "cancelled"];

/**
 * An `approved` row is not the last word when its own request has a later outcome row: executed, failed, went stale or
 * was cancelled. Maps each such approved row's event id to the outcome, so the row never reads as the final state.
 * Rows are paired by the request they belong to (`request_id`, in the same organisation and application) and never by
 * release: two requests can share a release, and one's outcome is not the other's. An approval with no `request_id`
 * (an older event) is left alone. Only what is loaded can be matched, and an outcome is newer than its approval, so a
 * feed read newest first has already seen it.
 */
export function supersededApprovals(items: DeploymentFeedItem[]): Map<string, string> {
  const out = new Map<string, string>();
  const latest = new Map<string, DeploymentFeedItem>();
  for (const it of items) {
    if (!it.request_id) continue;
    const key = `${it.org}\u0000${it.app}\u0000${it.request_id}`;
    if (OUTCOMES.includes(it.action)) {
      const seen = latest.get(key);
      if (!seen || it.at > seen.at) latest.set(key, it);
    } else if (it.action === "approved") {
      const o = latest.get(key);
      if (o && o.at >= it.at) out.set(it.event_id, o.action);
    }
  }
  return out;
}

/** Steps shown in a release row's chain before the middle is folded away. */
export const CHAIN_MAX = 5;

/**
 * The chain of step names on a collapsed release row, oldest first. Up to `CHAIN_MAX` steps are written out; a longer
 * one keeps the first and the last and says how many are between: "Approval requested → … (9 more) → Request
 * executed". Every step is still in the row when it is opened.
 */
export function chainText(path: string[], max = CHAIN_MAX): string {
  if (path.length <= max) return path.join(" → ");
  return `${path[0]} → … (${path.length - 2} more) → ${path[path.length - 1]}`;
}

export interface FeedStep {
  items: DeploymentFeedItem[];
}

/**
 * Consecutive events of the same release (same organisation, application and release id) become one row; the steps
 * stay inside it, newest first. An event with no release stands alone. Order is the feed's own.
 */
export function groupFeed(items: DeploymentFeedItem[]): FeedStep[] {
  const out: FeedStep[] = [];
  for (const it of items) {
    const prev = out[out.length - 1]?.items[0];
    if (prev && it.release_id && prev.release_id === it.release_id && prev.org === it.org && prev.app === it.app) {
      out[out.length - 1].items.push(it);
    } else {
      out.push({ items: [it] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// "Live and rolling now": the overview, flattened and pinned
// ---------------------------------------------------------------------------

export type NowBucket = "attention" | "rolling" | "live" | "nothing";

export interface NowApp {
  org: string;
  group: { id: string; name: string } | null;
  app: AppStatus;
  bucket: NowBucket;
  /** Why it is pinned, in the order a person should read them. */
  reasons: string[];
}

/** What pins an application above the rest. Unknown never reads as safe: a failed lookup is pinned too. */
export function attentionReasons(app: AppStatus): string[] {
  const r: string[] = [];
  const t = appTelemetryState(app);
  if (app.error) r.push("lookup failed");
  if (app.auxiliary_error) r.push("state partly unreadable");
  if (app.unresolved_operations?.length) r.push("writes paused");
  if (t === "seems_bad") r.push("deployment seems bad");
  else if (t === "suspicious_reports") r.push("suspicious reports");
  if (app.emergency_needs_review?.some((x) => !x.acknowledged_by)) r.push("needs review");
  if ((app.pending_requests ?? 0) > 0) r.push("awaiting approval");
  if (app.cache_invalidation?.status === "failed") r.push("CDN cache stale");
  return r;
}

const ORDER: Record<NowBucket, number> = { attention: 0, rolling: 1, live: 2, nothing: 3 };

export function bucketOf(app: AppStatus): NowBucket {
  if (attentionReasons(app).length > 0) return "attention";
  if (app.active.some((a) => a.status === "INPROGRESS" || a.status === "CREATED")) return "rolling";
  if (app.live.length > 0) return "live";
  return "nothing";
}

function attentionRank(app: AppStatus): number {
  // Inside "attention": the ones a person must act on first.
  const r = attentionReasons(app);
  const rank = [
    "lookup failed",
    "writes paused",
    "deployment seems bad",
    "needs review",
    "awaiting approval",
    "suspicious reports",
    "state partly unreadable",
    "CDN cache stale",
  ];
  return Math.min(...r.map((x) => rank.indexOf(x)).filter((i) => i >= 0), rank.length);
}

/** Only what needs a person or is moving: the two buckets the Deployments page pins above the feed. */
export function pinnedApps(rows: NowApp[]): NowApp[] {
  return rows.filter((r) => r.bucket === "attention" || r.bucket === "rolling");
}

/** How many pinned lines the Deployments page shows before "N more". Keeps the first feed row on the first screen. */
export const PINNED_CAP = 5;

/**
 * The first `cap` pinned rows (they are already in the order a person should read them), and what is left over,
 * counted by kind so the page can say "3 more need attention". With `expanded` nothing is held back.
 */
export function capPinned(
  pinned: NowApp[],
  expanded: boolean,
  cap = PINNED_CAP
): { shown: NowApp[]; hiddenAttention: number; hiddenRolling: number } {
  // A single row over the cap is shown rather than hidden behind a button that says "1 more".
  const shown = expanded || pinned.length <= cap + 1 ? pinned : pinned.slice(0, cap);
  const rest = pinned.slice(shown.length);
  return {
    shown,
    hiddenAttention: rest.filter((r) => r.bucket === "attention").length,
    hiddenRolling: rest.filter((r) => r.bucket === "rolling").length,
  };
}

export function nowApps(overview: Overview | undefined): NowApp[] {
  if (!overview) return [];
  const rows: NowApp[] = [];
  const add = (o: OverviewOrganisation, group: NowApp["group"], app: AppStatus) =>
    rows.push({ org: o.name, group, app, bucket: bucketOf(app), reasons: attentionReasons(app) });
  for (const o of overview.organisations) {
    for (const g of o.groups) for (const m of g.members) add(o, { id: g.id, name: g.name }, m);
    for (const m of o.ungrouped) add(o, null, m);
  }
  return rows.sort(
    (a, b) =>
      ORDER[a.bucket] - ORDER[b.bucket] ||
      (a.bucket === "attention" ? attentionRank(a.app) - attentionRank(b.app) : 0) ||
      (a.bucket === "rolling"
        ? Number(primaryActive(b.app)?.status === "INPROGRESS") - Number(primaryActive(a.app)?.status === "INPROGRESS")
        : 0) ||
      (b.app.last_activity_at ?? "").localeCompare(a.app.last_activity_at ?? "") ||
      a.org.localeCompare(b.org) ||
      a.app.application.localeCompare(b.app.application)
  );
}
