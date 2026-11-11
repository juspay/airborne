// Reading anonymous device telemetry. Everything here is derived from the server's own numbers and verdicts;
// nothing is estimated. See `airborne_docs/docs/server/control-center.md` ("Anonymous device telemetry").

import type { AppStatus, AppTelemetry, TelemetryRelease, TelemetryStatus, TelemetrySummary } from "./types";

export function isTelemetryError(t: AppTelemetry | undefined): t is { error: string } {
  return Boolean(t) && "error" in (t as object);
}

export function telemetrySummary(t: AppTelemetry | undefined): TelemetrySummary | undefined {
  return t && !isTelemetryError(t) ? t : undefined;
}

/**
 * Why there may be nothing to show. `absent`: the server does not report telemetry (older server, or the
 * release lookup failed). `error`: aggregation failed. `silent`: no install reported in the window, so either
 * telemetry is off for this app or no device has opted in; the two cannot be told apart from here.
 */
export type TelemetryAvailability = "absent" | "error" | "silent" | "reporting";

export function telemetryAvailability(t: AppTelemetry | undefined): TelemetryAvailability {
  if (!t) return "absent";
  if (isTelemetryError(t)) return "error";
  return t.releases.length === 0 ? "silent" : "reporting";
}

export const SIGNAL_SEVERITY: Record<TelemetryStatus, number> = {
  seems_bad: 3,
  suspicious_reports: 2,
  insufficient_data: 1,
  no_signal: 0,
  observed_only: 1,
};

export function worstSignal(rows: TelemetryRelease[]): TelemetryStatus | undefined {
  let worst: TelemetryStatus | undefined;
  for (const r of rows) {
    if (!worst || SIGNAL_SEVERITY[r.signal.status] > SIGNAL_SEVERITY[worst]) worst = r.signal.status;
  }
  return worst;
}

/** Short label. Never "healthy": the detector only says whether it flagged something. */
export function signalLabel(status: TelemetryStatus): string {
  switch (status) {
    case "seems_bad":
      return "Deployment seems bad";
    case "suspicious_reports":
      return "Suspicious reports";
    case "insufficient_data":
      return "Not enough data";
    case "observed_only":
      return "Reports without comparison";
    case "no_signal":
      return "Nothing flagged";
  }
}

/** The server's own sample rule: `boot_started` devices on this release and on its baseline, both >= minimum. */
export function bootSample(row: TelemetryRelease, baseline: TelemetryRelease | undefined) {
  const minimum = row.signal.minimum_boot_devices ?? 20;
  return {
    minimum,
    current: row.boot_started,
    baseline: baseline?.boot_started,
    met: row.boot_started >= minimum && (baseline?.boot_started ?? 0) >= minimum,
  };
}

/** One sentence on why the server reached this verdict. Unknown stays unknown: it is never worded as healthy. */
export function signalExplanation(row: TelemetryRelease): string {
  const s = row.signal;
  const min = s.minimum_boot_devices ?? 20;
  switch (s.status) {
    case "seems_bad":
      return `Boot failures rose and successful boots fell against the baseline, with ${min}+ booting devices on both.`;
    case "observed_only":
      return "Current boot reports are available, but there is no baseline in this window. No comparative health assessment is possible.";
    case "suspicious_reports":
      if (!s.baseline_release_id)
        return "At least five installs reported failed boots (10% or more of boot starts). No baseline is available; reports are unverified.";
      return s.successes_down
        ? `Failures rose and successes fell, but fewer than ${min} devices booted on one side, so it is not called bad.`
        : "Failures rose but successful boots did not fall. A partial crash and forged reports both look like this.";
    case "insufficient_data":
      return s.baseline_release_id
        ? `Fewer than ${min} devices booted this release or its baseline. Unknown, not healthy.`
        : "No earlier release reported for this native version and platform, so there is nothing to compare with. Unknown, not healthy.";
    case "no_signal":
      return `${min}+ devices booted on each side and failures did not rise. Reports are unverified, so this is not proof of health.`;
  }
}

export function rowsForRelease(t: AppTelemetry | undefined, releaseId: string): TelemetryRelease[] {
  const s = telemetrySummary(t);
  return s ? s.releases.filter((r) => r.release_id === releaseId) : [];
}

/** The release ids the app is serving now: live in any context plus anything rolling out or waiting. */
export function servedReleaseIds(app: AppStatus): Set<string> {
  return new Set([...app.live.map((l) => l.release_id), ...app.active.map((a) => a.release_id)]);
}

/** Rows for releases the app serves now. Rows for superseded or rolled-back releases are history. */
export function currentRows(app: AppStatus): TelemetryRelease[] {
  const s = telemetrySummary(app.telemetry);
  if (!s) return [];
  const served = servedReleaseIds(app);
  return s.releases.filter((r) => served.has(r.release_id));
}

/** The one state the overview and group pages flag for an app. Only releases served now count. */
export function appFlag(app: AppStatus): "seems_bad" | "suspicious_reports" | null {
  const worst = worstSignal(currentRows(app));
  return worst === "seems_bad" || worst === "suspicious_reports" ? worst : null;
}

/**
 * What to say about an app's served releases, most worrying first. `no_reports`: the app is reporting-capable
 * but nothing came back for what it serves (telemetry off, or no device opted in). `unavailable`: the server
 * could not aggregate. `absent`: this server does not report telemetry.
 */
export type AppTelemetryState = TelemetryStatus | "no_reports" | "unavailable" | "absent";

export function appTelemetryState(app: AppStatus): AppTelemetryState {
  const availability = telemetryAvailability(app.telemetry);
  if (availability === "absent") return "absent";
  if (availability === "error") return "unavailable";
  return worstSignal(currentRows(app)) ?? "no_reports";
}

/** The rows that carry a flag for a release served now, worst first, so the page can show each one. */
export function flaggedRows(app: AppStatus): TelemetryRelease[] {
  return currentRows(app)
    .filter((r) => r.signal.status === "seems_bad" || r.signal.status === "suspicious_reports")
    .sort((a, b) => SIGNAL_SEVERITY[b.signal.status] - SIGNAL_SEVERITY[a.signal.status]);
}

/** The row a flagged row is compared against: same release, native version and platform as `row.signal.baseline_release_id`. */
export function baselineOf(summary: TelemetrySummary | undefined, row: TelemetryRelease): TelemetryRelease | undefined {
  const id = row.signal.baseline_release_id;
  if (!id || !summary) return undefined;
  return summary.releases.find(
    (r) => r.release_id === id && r.platform === row.platform && r.native_version === row.native_version
  );
}

/**
 * The advice for one release served now: the worst flagged row, with the failure rates the server computed.
 * Information only. Nothing in the UI acts on it; it changes emphasis and wording.
 */
export interface ReleaseFlag {
  status: "seems_bad" | "suspicious_reports";
  row: TelemetryRelease;
  baseline: TelemetryRelease | undefined;
  /** 0..1, the server's own rate. */
  failureRate: number | undefined;
  baselineFailureRate: number | undefined;
}

export function flagForRelease(app: AppStatus | undefined, releaseId: string): ReleaseFlag | undefined {
  if (!app) return undefined;
  const row = flaggedRows(app).find((r) => r.release_id === releaseId);
  if (!row) return undefined;
  return {
    status: row.signal.status as ReleaseFlag["status"],
    row,
    baseline: baselineOf(telemetrySummary(app.telemetry), row),
    failureRate: row.signal.boot_failure_rate,
    baselineFailureRate: row.signal.baseline_failure_rate,
  };
}

export interface Adoption {
  /** Distinct installs that acknowledged a successful boot: the server's definition of adoption. */
  booted: number;
  started: number;
  failed: number;
  rolledBack: number;
  downloaded: number;
  reporting: number;
  reports: number;
  rows: TelemetryRelease[];
}

/** Server totals deduplicate installs across native versions and platforms. Never sum cohort counts. */
export function adoptionFor(t: AppTelemetry | undefined, releaseId: string): Adoption | undefined {
  const rows = rowsForRelease(t, releaseId);
  if (rows.length === 0) return undefined;
  const total = telemetrySummary(t)?.release_totals?.find((r) => r.release_id === releaseId);
  if (!total) return undefined;
  const sum = (k: keyof TelemetryRelease) => Number(total[k] ?? 0);
  return {
    booted: sum("boot_success"),
    started: sum("boot_started"),
    failed: sum("boot_failed"),
    rolledBack: sum("rollback"),
    downloaded: sum("package_downloaded"),
    reporting: sum("reporting_devices"),
    reports: sum("unverified_reports"),
    rows,
  };
}

/** Newest release first, then native version, then platform, so a table reads top-down in time. */
export function sortRows(rows: TelemetryRelease[]): TelemetryRelease[] {
  return [...rows].sort(
    (a, b) =>
      b.release_created - a.release_created ||
      b.release_id.localeCompare(a.release_id) ||
      compareVersions(b.native_version, a.native_version) ||
      a.platform.localeCompare(b.platform)
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10));
  const pb = b.split(".").map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (!Number.isNaN(d) && d !== 0) return d;
  }
  return a.localeCompare(b);
}

const EXACT = new Intl.NumberFormat("en-GB");
const COMPACT = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(n: number): string {
  return EXACT.format(n);
}

/** "1.2k" for tight cells; the exact count belongs in a title. */
export function compactCount(n: number): string {
  return n < 10_000 ? EXACT.format(n) : COMPACT.format(n);
}

/** A server-reported rate (0..1) as a whole percentage. Only ever applied to the server's own rates. */
export function formatRate(rate: number | undefined): string {
  if (rate === undefined || Number.isNaN(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function devices(n: number): string {
  return `${formatCount(n)} device${n === 1 ? "" : "s"}`;
}

/** True when the release's own package is in the exclusion list (package versions are strings on the wire). */
export function isExcluded(blocked: string[] | null | undefined, packageVersion: number | string | null): boolean {
  if (!blocked || packageVersion === null) return false;
  return blocked.includes(String(packageVersion));
}

/**
 * Whether the exclusions card has anything to say. Nothing excluded is not news, so the card is left out;
 * an unreadable list (`null`) is shown, because that is a fact the person needs.
 */
export function hasExclusions(blocked: string[] | null | undefined): boolean {
  return blocked === null || (Array.isArray(blocked) && blocked.length > 0);
}

/** Natural order for display: numeric package versions ascending. */
export function sortVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}
