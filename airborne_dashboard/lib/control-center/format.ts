import { formatDistanceToNowStrict, format } from "date-fns";
import type {
  ActiveRelease,
  AppStatus,
  DimensionContext,
  LiveRelease,
  Overview,
  Platform,
  ReleaseStatus,
  ServingPolicy,
} from "./types";
import { appTelemetryState } from "./telemetry";

export const PLATFORM_LABEL: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  other: "Other",
};

export const PLATFORM_ORDER: Platform[] = ["android", "ios", "web", "other"];

export function platformLabel(p: Platform | null | undefined): string {
  return p ? PLATFORM_LABEL[p] : "App";
}

/** "Android · kharcha-android", or just the app name when the platform is not known. */
export function platformApp(p: Platform | null | undefined, app: string): string {
  return p ? `${PLATFORM_LABEL[p]} · ${app}` : app;
}

export function guessPlatform(application: string): Platform {
  const a = application.toLowerCase();
  if (/(^|[-_])(android|droid)([-_]|$)/.test(a)) return "android";
  if (/(^|[-_])ios([-_]|$)/.test(a)) return "ios";
  if (/(^|[-_])web([-_]|$)/.test(a)) return "web";
  return "other";
}

export function statusLabel(status: ReleaseStatus | string): string {
  switch (status) {
    case "CREATED":
      return "Not started";
    case "INPROGRESS":
      return "Rolling out";
    case "CONCLUDED":
      return "Concluded";
    case "DISCARDED":
      return "Discarded";
    default:
      return status;
  }
}

/** Stable key for a dimension context so live and active releases can be matched. */
export function contextKey(dims: DimensionContext | null | undefined): string {
  if (!dims) return "";
  const entries = Object.entries(dims).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export function isDefaultContext(dims: DimensionContext | null | undefined): boolean {
  return !dims || Object.keys(dims).length === 0;
}

export function describeContext(dims: DimensionContext | null | undefined): string {
  if (isDefaultContext(dims)) return "All users (no dimensions)";
  return Object.entries(dims!)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k} = ${String(v)}`)
    .join(" · ");
}

// A dimension that names a native version: `app_version`, `native_version`, `os`, `os_version`, `sdk_version`,
// `build_number`. Anchored, so `host`, `position` or `cost_center` are not read as one just for containing "os".
const NATIVE_VERSION_KEYS = /^(app_|native_)?(version|build|sdk|os)(_.*)?$/i;

export function splitReach(dims: DimensionContext | null | undefined): {
  nativeVersions: [string, string][];
  dimensions: [string, string][];
} {
  const nativeVersions: [string, string][] = [];
  const dimensions: [string, string][] = [];
  Object.entries(dims ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => {
      const pair: [string, string] = [k, String(v)];
      if (NATIVE_VERSION_KEYS.test(k)) nativeVersions.push(pair);
      else dimensions.push(pair);
    });
  return { nativeVersions, dimensions };
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.abs(now.getTime() - d.getTime());
  if (diff < 45_000) return "just now";
  return `${formatDistanceToNowStrict(d, { addSuffix: false })} ago`;
}

export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "d MMM yyyy, HH:mm:ss");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Config versions on the server are UUIDs; show the first block and keep the full value in a title. */
export function shortConfig(version: string): string {
  // A UUID, or a long hash (a re-released config carries a 64-character digest): keep the first 8.
  return UUID_RE.test(version) || /^[0-9a-f]{16,}$/i.test(version) ? version.slice(0, 8) : version;
}

export function shortId(id: string, keep = 6): string {
  if (id.length <= keep * 2 + 1) return id;
  return `${id.slice(0, keep)}…${id.slice(-keep)}`;
}

export function hasActiveReleases(overview: Overview | undefined): boolean {
  if (!overview) return false;
  return overview.organisations.some(
    (o) =>
      o.groups.some((g) => g.members.some((m) => m.active.length > 0)) || o.ungrouped.some((m) => m.active.length > 0)
  );
}

export function allApps(overview: Overview | undefined): AppStatus[] {
  if (!overview) return [];
  return overview.organisations.flatMap((o) => [...o.groups.flatMap((g) => g.members), ...o.ungrouped]);
}

export interface AttentionSummary {
  /** Apps whose served release the device telemetry flags as seeming bad. Advice: nothing was changed. */
  seemsBad: number;
  /** Apps whose served release has suspicious reports: failures up without the evidence to call it bad. */
  suspicious: number;
  /** Apps whose served releases are too thinly reported to judge (and none is flagged). Unknown, not healthy. */
  insufficientData: number;
  writesPaused: number;
  /** Apps whose latest CDN invalidation failed: cached release answers may be stale. */
  cacheStale: number;
  /** Emergency rollbacks not yet acknowledged by a different checker. */
  needsReview: number;
  /** Deployment requests awaiting a checker. */
  awaitingApproval: number;
  /** Applications with maker-checker on. Zero means the policy is off everywhere and nothing about it is shown. */
  approvalOn: number;
  rollingOut: number;
  notStarted: number;
  lookupFailed: number;
  stateUnknown: number;
  nothingLive: number;
}

export function summariseAttention(apps: AppStatus[]): AttentionSummary {
  const s: AttentionSummary = {
    seemsBad: 0,
    suspicious: 0,
    insufficientData: 0,
    writesPaused: 0,
    cacheStale: 0,
    needsReview: 0,
    awaitingApproval: 0,
    approvalOn: 0,
    rollingOut: 0,
    notStarted: 0,
    lookupFailed: 0,
    stateUnknown: 0,
    nothingLive: 0,
  };
  for (const a of apps) {
    if (a.auxiliary_error != null) s.stateUnknown += 1;
    const telemetry = appTelemetryState(a);
    if (telemetry === "seems_bad") s.seemsBad += 1;
    else if (telemetry === "suspicious_reports") s.suspicious += 1;
    // `observed_only` is the same unknown: devices reported but there is nothing to compare them with.
    else if (telemetry === "insufficient_data" || telemetry === "observed_only") s.insufficientData += 1;
    if (a.unresolved_operations?.length) s.writesPaused += 1;
    if (a.cache_invalidation?.status === "failed") s.cacheStale += 1;
    s.needsReview += a.emergency_needs_review?.filter((r) => !r.acknowledged_by).length ?? 0;
    s.awaitingApproval += a.pending_requests ?? 0;
    if (a.approval_required) s.approvalOn += 1;
    if (a.error) {
      s.lookupFailed += 1;
      continue;
    }
    for (const r of a.active) {
      if (r.status === "INPROGRESS") s.rollingOut += 1;
      else s.notStarted += 1;
    }
    if (a.live.length === 0 && a.active.length === 0) s.nothingLive += 1;
  }
  return s;
}

export function sortMembersByPlatform<T extends { platform: Platform | null }>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const ia = a.platform ? PLATFORM_ORDER.indexOf(a.platform) : PLATFORM_ORDER.length;
    const ib = b.platform ? PLATFORM_ORDER.indexOf(b.platform) : PLATFORM_ORDER.length;
    return ia - ib;
  });
}

/** The live release an active one would replace: same dimension context, else the default context. */
export function liveForContext(app: AppStatus | undefined, dims: DimensionContext) {
  if (!app) return undefined;
  const key = contextKey(dims);
  return app.live.find((l) => contextKey(l.dimensions) === key) ?? app.live.find((l) => isDefaultContext(l.dimensions));
}

export function primaryActive(app: AppStatus): ActiveRelease | undefined {
  const inProgress = app.active.filter((r) => r.status === "INPROGRESS");
  const pool = inProgress.length > 0 ? inProgress : app.active;
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export const MAX_RAMP_TARGET = 50;

/**
 * Live releases targeted at a locale that a more general release does not replace. Superposition ranks
 * contexts by specificity, so a concluded `locale=kn` release keeps winning over a newer general one for
 * that locale. Returned for a release with no `locale` dimension: every live release whose dimensions are
 * this release's dimensions plus a `locale`.
 */
export function localeExceptions(app: AppStatus | undefined, dims: DimensionContext): LiveRelease[] {
  if (!app || "locale" in (dims ?? {})) return [];
  const base = Object.entries(dims ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return app.live
    .filter((l) => "locale" in l.dimensions)
    .filter((l) => {
      const rest = Object.entries(l.dimensions)
        .filter(([k]) => k !== "locale")
        .sort(([a], [b]) => a.localeCompare(b));
      return JSON.stringify(rest) === JSON.stringify(base);
    })
    .sort((a, b) => String(a.dimensions.locale).localeCompare(String(b.dimensions.locale)));
}

export type ServingState = "strict" | "forced" | "fallback";

/** The three states an operator must tell apart at a glance. */
export function servingState(p: ServingPolicy | undefined): ServingState | undefined {
  if (!p) return undefined;
  if (p.deployment_override) return "forced";
  return p.effective_strict ? "strict" : "fallback";
}

/** Find one application (and its group) in the overview. */
export function locateApp(
  overview: Overview | undefined,
  org: string,
  app: string
): { app: AppStatus | undefined; group: { id: string; name: string } | undefined } {
  const o = overview?.organisations.find((x) => x.name === org);
  if (!o) return { app: undefined, group: undefined };
  for (const g of o.groups) {
    const m = g.members.find((x) => x.application === app);
    if (m) return { app: m, group: { id: g.id, name: g.name } };
  }
  return { app: o.ungrouped.find((x) => x.application === app), group: undefined };
}
