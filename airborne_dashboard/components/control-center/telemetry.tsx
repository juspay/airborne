"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileWarning,
  Flag,
  MonitorSmartphone,
  ShieldBan,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { absoluteTime, platformLabel } from "@/lib/control-center/format";
import {
  adoptionFor,
  baselineOf,
  bootSample,
  type Adoption,
  compactCount,
  devices,
  flaggedRows,
  type ReleaseEvidence,
  type ReleaseFlag,
  formatCount,
  formatRate,
  signalExplanation,
  signalLabel,
  sortRows,
  sortVersions,
  splitServedRows,
  telemetryAvailability,
  telemetrySummary,
  worstSignal,
} from "@/lib/control-center/telemetry";
import type {
  AppStatus,
  AppTelemetry,
  TelemetryRelease,
  TelemetryStatus,
  TelemetrySummary,
} from "@/lib/control-center/types";
import { PlatformIcon } from "./platform-mark";
import { releasePath } from "./paths";
import { ErrorState, PanelTitle } from "./states";
import { StateChip, type Tone } from "./status-badge";
import { Pkg } from "./version";

// ---------------------------------------------------------------------------
// Chips. Status is never colour alone, and no verdict is ever green.
// ---------------------------------------------------------------------------

const SIGNAL_TONE: Record<TelemetryStatus, Tone> = {
  seems_bad: "danger",
  suspicious_reports: "waiting",
  insufficient_data: "muted",
  no_signal: "muted",
  observed_only: "muted",
};

const SIGNAL_ICON: Record<TelemetryStatus, ComponentType<{ className?: string }>> = {
  seems_bad: Flag,
  suspicious_reports: FileWarning,
  insufficient_data: CircleHelp,
  no_signal: Activity,
  observed_only: Activity,
};

const SIGNAL_TITLE: Record<TelemetryStatus, string> = {
  seems_bad:
    "Boot failures up and successes down against the baseline. From anonymous, unverified device reports (7 days). Airborne has changed nothing; a person decides.",
  suspicious_reports:
    "Boot failures rose without enough evidence to call the deployment bad. Unverified reports can be forged. Airborne has changed nothing.",
  insufficient_data: "Too few devices reported, or no earlier release to compare with. Unknown, not healthy.",
  observed_only: "Current reports without a baseline; no comparative health assessment is possible.",
  no_signal: "No failure increase detected. Reports are unverified, so this is not proof of health.",
};

export function SignalChip({
  status,
  className,
  variant,
  suffix,
}: {
  status: TelemetryStatus;
  className?: string;
  variant?: "badge" | "inline";
  /** Which release the verdict is about, when the chip is not next to it. */
  suffix?: string;
}) {
  return (
    <StateChip
      tone={SIGNAL_TONE[status]}
      icon={SIGNAL_ICON[status]}
      className={className}
      variant={variant}
      title={SIGNAL_TITLE[status]}
    >
      {signalLabel(status)}
      {suffix && <span className="ml-1 font-normal tabular-nums">{suffix}</span>}
    </StateChip>
  );
}

/** The app's worst flagged release as a chip that opens that release, where the evidence and Roll back are. */
export function AppFlagChip({
  org,
  app,
  className,
  variant = "inline",
}: {
  org: string;
  app: AppStatus;
  className?: string;
  variant?: "badge" | "inline";
}) {
  const worst = flaggedRows(app)[0];
  if (!worst) return null;
  return (
    <Link href={releasePath(org, app.application, worst.release_id)} className="hover:underline">
      <SignalChip
        status={worst.signal.status}
        variant={variant}
        className={className}
        suffix={`v${worst.package_version} · ${formatRate(worst.signal.boot_failure_rate)} reported failing`}
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

function Rate({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return <span className="ml-1 text-muted-foreground">({formatRate(value)})</span>;
}

/** Native version and platform, the two axes a baseline is matched on. */
export function RowScope({ row, className }: { row: TelemetryRelease; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground", className)}>
      <PlatformIcon platform={row.platform} className="h-3 w-3" />
      {platformLabel(row.platform)} {row.native_version}
    </span>
  );
}

/** The numbers behind one verdict next to its baseline. Every figure is distinct devices. */
export function Evidence({
  org,
  app,
  row,
  summary,
  className,
}: {
  org: string;
  app: string;
  row: TelemetryRelease;
  summary: TelemetrySummary | undefined;
  className?: string;
}) {
  const s = row.signal;
  const baseline = baselineOf(summary, row);
  const hasBaseline = Boolean(s.baseline_release_id);
  const sample = bootSample(row, baseline);
  const num = "text-right tabular-nums";
  const lines: { label: string; value: number; base: number | undefined; rate?: [number?, number?]; hot?: boolean }[] =
    [
      { label: "Started", value: row.boot_started, base: baseline?.boot_started },
      {
        label: "Booted",
        value: row.boot_success,
        base: baseline?.boot_success,
        rate: [s.boot_success_rate, s.baseline_success_rate],
      },
      {
        label: "Failed",
        value: row.boot_failed,
        base: baseline?.boot_failed,
        rate: [s.boot_failure_rate, s.baseline_failure_rate],
        hot: s.crashes_up,
      },
      { label: "Rolled back on device", value: row.rollback, base: baseline?.rollback },
      { label: "Downloaded", value: row.package_downloaded, base: baseline?.package_downloaded },
      ...(row.blocked_package > 0
        ? [{ label: "Refused excluded", value: row.blocked_package, base: baseline?.blocked_package }]
        : []),
    ];
  return (
    <div className={cn("space-y-1.5 text-xs", className)}>
      <table
        className="w-full border-collapse"
        title="Distinct devices. A device can fail one launch and boot the next."
      >
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-1 text-left font-semibold">Devices</th>
            <th className="pb-1 text-right font-semibold">
              <Pkg version={Number(row.package_version)} size="sm" className="normal-case tracking-normal" />
            </th>
            <th className="pb-1 text-right font-semibold">
              {baseline ? (
                <Link
                  href={releasePath(org, app, baseline.release_id)}
                  className="normal-case tracking-normal hover:underline"
                  title={`Baseline release ${baseline.release_id}`}
                >
                  <Pkg version={Number(baseline.package_version)} size="sm" className="text-muted-foreground" />{" "}
                  baseline
                </Link>
              ) : (
                <span className="normal-case tracking-normal">{hasBaseline ? "baseline" : "no baseline"}</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody className="[&_td]:py-0.5">
          {lines.map((l) => (
            <tr key={l.label}>
              <td className="text-muted-foreground">{l.label}</td>
              <td className={cn(num, l.hot && "font-semibold text-red-700 dark:text-red-300")}>
                {formatCount(l.value)}
                {hasBaseline && <Rate value={l.rate?.[0]} />}
              </td>
              <td className={cn(num, "text-muted-foreground")}>
                {l.base === undefined ? "—" : formatCount(l.base)}
                {hasBaseline && <Rate value={l.rate?.[1]} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground">
        {sample.minimum}+ started on both sides needed: {sample.met ? "met" : "not met"}.{" "}
        {formatCount(reportCount(row))} reports from {devices(row.reporting_devices)}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The flag
// ---------------------------------------------------------------------------

/** The one note about reports: unverified, and Airborne did nothing. Shown once per screen. */
export function ReportsNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Reports are unverified and can be forged. Airborne has changed nothing.
    </p>
  );
}

/**
 * "Deployment seems bad" or "Suspicious reports" for one release row. On the release page it is the headline
 * of the incident: the failure rate, large, with the actions beneath it. Elsewhere it is a compact card that
 * links to the release. It never acts; a flag changes emphasis and wording, nothing else.
 */
export function DeploymentFlagCard({
  org,
  app,
  row,
  summary,
  dense,
  onReleasePage,
  actions,
  note = true,
  className,
}: {
  org: string;
  app: string;
  row: TelemetryRelease;
  summary: TelemetrySummary | undefined;
  /** Group column: the evidence starts folded. */
  dense?: boolean;
  /** On the release page the card is the incident headline and holds the actions instead of a link. */
  onReleasePage?: boolean;
  /** The release's action row, placed under the headline. */
  actions?: ReactNode;
  /** Whether this card carries the screen's one "unverified" note. */
  note?: boolean;
  className?: string;
}) {
  const s = row.signal;
  const bad = s.status === "seems_bad";
  const [open, setOpen] = useState(!dense && !onReleasePage);
  const Icon = SIGNAL_ICON[s.status];
  const baseline = baselineOf(summary, row);
  const tone = bad ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200";
  const box = cn(
    "rounded-lg border text-sm",
    bad ? "border-red-500/50 bg-red-500/5" : "border-amber-500/50 bg-amber-500/5"
  );

  {
    const platform = platformLabel(row.platform);
    const rate = formatRate(s.boot_failure_rate);
    return (
      <section
        role="status"
        aria-label={`${signalLabel(s.status)}: v${row.package_version}`}
        className={cn(box, "p-4 sm:p-5", className)}
      >
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", tone)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {signalLabel(s.status)}
        </p>
        <p
          className={cn(
            "mt-1 text-[32px] font-semibold leading-9 tracking-tight tabular-nums sm:text-[48px] sm:leading-[56px]",
            bad ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
          )}
        >
          {rate} reported failing
        </p>
        <p className="mt-1 text-base tabular-nums">
          <span className="font-medium">v{row.package_version}</span>
          <span className="text-muted-foreground">
            {" · "}
            {formatCount(row.boot_failed)} of {devices(row.boot_started)} on {platform} {row.native_version}
          </span>
          {baseline && (
            <span className="whitespace-nowrap text-muted-foreground">
              {" · "}v{baseline.package_version}: {formatRate(s.baseline_failure_rate)}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Reported a failed boot in the last 7 days, from unverified reports. {signalExplanation(row)}
        </p>
        {!onReleasePage && (
          <Link
            className="mt-3 inline-block rounded-md border px-3 py-2 font-medium"
            href={releasePath(org, app, row.release_id)}
          >
            Open release
          </Link>
        )}
        {actions && <div className="mt-4">{actions}</div>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {open ? "Hide evidence" : "Show evidence"}
        </button>
        {open && <Evidence org={org} app={app} row={row} summary={summary} className="mt-2" />}
        {note && <ReportsNote className="mt-3" />}
      </section>
    );
  }
}

/**
 * The tick that makes a person read the failure rate before sending a flagged release to more devices. It never
 * blocks anything by itself: it states the rate the flag rests on, and the person ticks it or does not proceed.
 */
export function FlagAcknowledge({
  flag,
  packageVersion,
  consequence,
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
  className,
}: {
  flag: ReleaseFlag;
  packageVersion: number;
  /** What going ahead does, one sentence: "Making it live sends it to everyone in reach." */
  consequence: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const platform = platformLabel(flag.row.platform);
  const rate = formatRate(flag.failureRate);
  return (
    <label
      className={cn("flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-sm", className)}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="mt-0.5"
      />
      <span>
        <strong className="font-medium text-red-800 dark:text-red-200">
          {flag.status === "seems_bad"
            ? `v${packageVersion} is failing on ${rate} of ${platform} devices`
            : `Failures are up on v${packageVersion}: ${rate} of ${platform} devices`}
          {flag.baseline ? ` (v${flag.baseline.package_version}: ${formatRate(flag.baselineFailureRate)})` : ""}.
        </strong>{" "}
        From unverified device reports; Airborne has changed nothing. {consequence} I have read this and want to go
        ahead.
      </span>
    </label>
  );
}

/**
 * What device reports say about the release a decision is about, in the place the decision is made. A flag is the
 * failure rate, large; every other state says what is not known. Information only: nothing here blocks or acts.
 */
export function EvidenceBlock({
  org,
  app,
  evidence,
  loading,
  compact,
  note,
  className,
}: {
  org: string;
  app: string;
  evidence: ReleaseEvidence;
  /** The overview that carries the reports has not answered yet. */
  loading?: boolean;
  compact?: boolean;
  /** What approving does to the flagged release, one line under the numbers. */
  note?: ReactNode;
  className?: string;
}) {
  if (evidence.kind === "flagged") {
    const { flag, others } = evidence;
    const row = flag.row;
    const bad = flag.status === "seems_bad";
    const Icon = SIGNAL_ICON[row.signal.status];
    const tone = bad ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200";
    const platform = platformLabel(row.platform);
    return (
      <section
        role="status"
        aria-label={`${signalLabel(row.signal.status)}: v${row.package_version}`}
        className={cn(
          "rounded-lg border p-3 text-sm sm:p-4",
          bad ? "border-red-500/50 bg-red-500/5" : "border-amber-500/50 bg-amber-500/5",
          className
        )}
      >
        <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium", tone)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {signalLabel(row.signal.status)}
          <span className="font-normal text-muted-foreground">
            v{row.package_version} · {platform} {row.native_version}
          </span>
        </p>
        <p
          className={cn(
            "mt-1 font-semibold leading-tight tracking-tight tabular-nums",
            compact ? "text-2xl" : "text-3xl",
            bad ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
          )}
        >
          {formatRate(flag.failureRate)} reported failing
        </p>
        <p className="mt-1 tabular-nums text-muted-foreground">
          {formatCount(row.boot_failed)} of {devices(row.boot_started)} on {platform} {row.native_version} reported a
          failed boot in the last 7 days
          {flag.baseline ? ` · v${flag.baseline.package_version}: ${formatRate(flag.baselineFailureRate)}` : ""}.
          Unverified reports; Airborne has changed nothing and a person decides.
          {others > 0 && ` ${others} more ${others === 1 ? "cohort is" : "cohorts are"} flagged on this release.`}
        </p>
        {note && <p className="mt-1 font-medium text-foreground">{note}</p>}
        {!compact && (
          <Link
            href={releasePath(org, app, row.release_id)}
            className="mt-2 inline-flex items-center gap-1 text-xs underline"
          >
            Open the release for the full evidence <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </section>
    );
  }

  let title: string;
  let text: string;
  let tone: "muted" | "waiting" = "muted";
  if (loading && evidence.kind === "unknown") {
    title = "Reading device reports…";
    text = "The failure evidence for this release has not loaded yet.";
  } else if (evidence.kind === "unknown") {
    tone = "waiting";
    title = "Failure evidence unknown";
    text =
      evidence.reason === "absent"
        ? "This server does not report device telemetry, so there is no failure rate to show. Unknown, not healthy."
        : evidence.reason === "unavailable"
          ? "The server could not aggregate device reports just now, so there is no failure rate to show. Unknown, not healthy. Refresh before deciding; nothing is blocked."
          : "Device reports could not be read, or the last refresh failed, so the failure rate is unknown. Refresh before deciding; nothing is blocked.";
  } else if (evidence.kind === "none") {
    title = "No device reports for this release";
    text =
      evidence.availability === "silent"
        ? "No install reported in the last 7 days: telemetry is off for this app, or no device has opted in. Unknown, not healthy."
        : "No device reported about this release in the last 7 days. Unknown, not healthy.";
  } else {
    title = signalLabel(evidence.row.signal.status);
    text = signalExplanation(evidence.row);
  }
  return (
    <section
      role="status"
      className={cn(
        "rounded-lg border p-3 text-sm",
        tone === "waiting" ? "border-amber-500/40 bg-amber-500/5" : "bg-muted/30",
        className
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
    </section>
  );
}

/** Every flagged release this app serves now, worst first. Nothing when there is none. */
export function DeploymentFlags({
  org,
  app,
  dense,
  onReleasePage,
  actions,
  note,
  releaseId,
  className,
}: {
  org: string;
  app: AppStatus;
  dense?: boolean;
  onReleasePage?: boolean;
  /** Release page only: the action row goes inside the first flag card. */
  actions?: ReactNode;
  /** False where another line on the same screen already carries the unverified note. */
  note?: boolean;
  /** Only this release's flags. */
  releaseId?: string;
  className?: string;
}) {
  const rows = flaggedRows(app).filter((r) => !releaseId || r.release_id === releaseId);
  if (rows.length === 0) return null;
  const summary = telemetrySummary(app.telemetry);
  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((r, i) => (
        <DeploymentFlagCard
          key={`${r.release_id}:${r.native_version}:${r.platform}`}
          org={org}
          app={app.application}
          row={r}
          summary={summary}
          dense={dense}
          onReleasePage={onReleasePage}
          actions={i === 0 ? actions : undefined}
          note={note}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adoption: observed devices, never a percentage of anything
// ---------------------------------------------------------------------------

function availabilityText(a: "absent" | "error" | "silent"): { short: string; title: string } {
  switch (a) {
    case "absent":
      return { short: "no device reporting", title: "This server does not report device telemetry." };
    case "error":
      return {
        short: "telemetry unavailable",
        title: "The server could not aggregate device reports. Releases are unaffected.",
      };
    case "silent":
      return {
        short: "no device reports · 7d",
        title: "No install reported in the last 7 days: telemetry is off for this app, or no device has opted in.",
      };
  }
}

/** Whether any of these rows carries a flag: such a release leads with its failures, not its successful boots. */
function isFlaggedRows(rows: TelemetryRelease[]): boolean {
  return rows.some((r) => r.signal.status === "seems_bad" || r.signal.status === "suspicious_reports");
}

/** Reports behind a row. Either counter may be missing on a server that does not send it. */
const reportCount = (r: TelemetryRelease) => (r.unverified_reports ?? 0) + (r.verified_reports ?? 0);

/** "Android 3.1.0", or the first two cohorts and a count: which devices a figure is about. */
function cohortOf(rows: TelemetryRelease[]): string {
  const names = [...new Set(rows.map((r) => `${platformLabel(r.platform)} ${r.native_version}`))];
  return names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/**
 * One line for a row or card: devices that booted this release, and that the data is thin when it is. Where the
 * app has nothing to report, `fallback` says so instead of leaving the cell blank.
 */
export function AdoptionLine({
  telemetry,
  releaseId,
  fallback,
  className,
}: {
  telemetry: AppTelemetry | undefined;
  releaseId: string;
  fallback?: boolean;
  className?: string;
}) {
  const availability = telemetryAvailability(telemetry);
  if (availability === "absent") return null;
  const base = cn("text-xs text-muted-foreground", className);
  if (availability !== "reporting") {
    if (!fallback) return null;
    const t = availabilityText(availability);
    return (
      <span className={base} title={t.title}>
        {t.short}
      </span>
    );
  }
  const a = adoptionFor(telemetry, releaseId);
  if (!a) {
    return (
      <span className={base} title="No device reported about this release in the last 7 days.">
        no device reports · 7d
      </span>
    );
  }
  const thin = ["insufficient_data", "observed_only"].includes(worstSignal(a.rows) ?? "");
  // Red only where the server itself saw failures rise; a few failures on a steady release are normal.
  const hot = a.rows.some((r) => r.signal.crashes_up);
  const flagged = isFlaggedRows(a.rows);
  return (
    <span
      className={cn(base, "inline-flex flex-wrap items-center gap-x-1")}
      title={`${formatCount(a.booted)} distinct ${cohortOf(a.rows)} devices reported a successful boot in the last 7 days, of ${formatCount(a.started)} that started booting. ${formatCount(a.failed)} reported a failed boot. Not the installed population, and not the rollout target.`}
    >
      <MonitorSmartphone className="h-3 w-3 shrink-0" aria-hidden />
      {flagged ? (
        <>
          <span>
            <span className="font-semibold tabular-nums text-red-700 dark:text-red-300">{compactCount(a.failed)}</span>{" "}
            of <span className="tabular-nums">{compactCount(a.started)}</span> failed
          </span>
          <span>
            · <span className="tabular-nums">{compactCount(a.booted)}</span> booted
          </span>
        </>
      ) : (
        <>
          <span>
            <span className="tabular-nums text-foreground">{compactCount(a.booted)}</span> reported boots
          </span>
          {a.failed > 0 && (
            <span>
              ·{" "}
              <span className={cn("tabular-nums", hot && "text-red-700 dark:text-red-300")}>
                {compactCount(a.failed)}
              </span>{" "}
              failed
            </span>
          )}
        </>
      )}
      {thin && <span>· not enough data</span>}
    </span>
  );
}

/** The subtitle for a page or section: reported devices are not the rollout target, and nothing hides an absence. */
export function AdoptionNote({ telemetry, className }: { telemetry: AppTelemetry | undefined; className?: string }) {
  const availability = telemetryAvailability(telemetry);
  if (availability === "reporting") return null;
  const t = availabilityText(availability);
  return (
    <span className={cn("text-[11px] leading-tight text-muted-foreground/80", className)} title={t.title}>
      {t.short}
    </span>
  );
}

/** The table rows are one release × native version × platform each, with the evidence one click away. */
function ReportsTable({
  org,
  app,
  rows,
  summary,
  showRelease,
  totals,
}: {
  org: string;
  app: AppStatus;
  rows: TelemetryRelease[];
  summary: TelemetrySummary | undefined;
  showRelease: boolean;
  /** One release's distinct installs, shown as a last row so the figure above the table is a row of it. */
  totals?: Adoption;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [showEarlier, setShowEarlier] = useState(false);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const served = (id: string) =>
    app.live.some((l) => l.release_id === id)
      ? "live"
      : app.active.some((a) => a.release_id === id)
        ? "rolling out"
        : null;
  const cols = 6;
  const num = "text-right tabular-nums";
  const split = showRelease
    ? splitServedRows(rows, (id) => served(id) !== null)
    : { served: rows, earlier: [], collapsible: false };
  const shown = split.collapsible ? (showEarlier ? [...split.served, ...split.earlier] : split.served) : rows;
  const earlierReleases = new Set(split.earlier.map((r) => r.release_id)).size;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground [&>th]:px-2 sm:[&>th]:px-3 [&>th]:py-1.5 [&>th]:font-semibold">
            <th className="pl-4">Native · platform</th>
            <th className={cn(num, "hidden sm:table-cell")} title="Devices that started booting this release">
              Started
            </th>
            <th className={num} title="Devices that reported a successful boot">
              Booted
            </th>
            <th className={num} title="Devices that reported a failed boot. A device can be in Booted and Failed both.">
              Failed
            </th>
            <th className={cn(num, "hidden sm:table-cell")}>Rolled back</th>
            <th className="hidden pr-4 sm:table-cell">Signal</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const key = `${r.release_id}:${r.native_version}:${r.platform}`;
            const first = i === 0 || shown[i - 1].release_id !== r.release_id;
            const relation = served(r.release_id);
            const expanded = open.has(key);
            const flagged =
              Boolean(relation) && (r.signal.status === "seems_bad" || r.signal.status === "suspicious_reports");
            return [
              showRelease && first && (
                <tr key={`${r.release_id}:head`} className={cn("bg-muted/40", i > 0 && "border-t")}>
                  <td colSpan={cols} className="px-4 py-1.5">
                    <Link
                      href={releasePath(org, app.application, r.release_id)}
                      className="inline-flex flex-wrap items-baseline gap-x-2 hover:underline"
                      title={`Open release ${r.release_id}`}
                    >
                      <Pkg
                        version={Number(r.package_version)}
                        className={relation ? undefined : "text-muted-foreground"}
                      />
                      <span className="text-xs text-muted-foreground">
                        {relation ?? "earlier release, not served now"}
                      </span>
                      {!relation && (
                        // Two releases can ship the same package: the release's own id and age tell them apart.
                        <span className="ml-2 text-[11px] text-muted-foreground/80">
                          release …{r.release_id.slice(-6)}
                          {r.release_created > 0 &&
                            ` · created ${absoluteTime(new Date(r.release_created * 1000).toISOString())}`}
                        </span>
                      )}
                    </Link>
                  </td>
                </tr>
              ),
              <tr
                key={key}
                className={cn(
                  "[&>td]:px-2 [&>td]:py-2 sm:[&>td]:px-3",
                  showRelease && !relation && "text-muted-foreground",
                  r.signal.status === "seems_bad" && "bg-red-500/5"
                )}
              >
                <td className="pl-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Hide" : "Show"} evidence for v${r.package_version} on ${platformLabel(r.platform)} ${r.native_version}`}
                      className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <RowScope row={r} />
                  </div>
                  <div className="mt-1 pl-5 sm:hidden">
                    <SignalChip status={r.signal.status} variant="inline" className="text-[11px]" />
                  </div>
                </td>
                <td className={cn(num, "hidden sm:table-cell")}>{formatCount(r.boot_started)}</td>
                <td className={cn(num, (relation || !showRelease) && "text-foreground")}>
                  {formatCount(r.boot_success)}
                </td>
                <td className={cn(num, r.signal.crashes_up && "font-semibold text-red-700 dark:text-red-300")}>
                  {formatCount(r.boot_failed)}
                </td>
                <td className={cn(num, "hidden sm:table-cell")}>{formatCount(r.rollback)}</td>
                <td className="hidden pr-4 sm:table-cell">
                  <SignalChip status={r.signal.status} variant={flagged ? "badge" : "inline"} className="text-[11px]" />
                </td>
              </tr>,
              expanded && (
                <tr key={`${key}:evidence`} className="bg-muted/30">
                  <td colSpan={cols} className="px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                      <p className="text-xs text-muted-foreground">{signalExplanation(r)}</p>
                      <Evidence org={org} app={app.application} row={r} summary={summary} />
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
          {split.collapsible && (
            <tr className="border-t">
              <td colSpan={cols} className="px-4 py-1.5">
                <button
                  type="button"
                  onClick={() => setShowEarlier((v) => !v)}
                  aria-expanded={showEarlier}
                  className="inline-flex items-center gap-1.5 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showEarlier ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {showEarlier ? "Hide" : "Show"} {earlierReleases} earlier release{earlierReleases === 1 ? "" : "s"}{" "}
                  not served now
                </button>
              </td>
            </tr>
          )}
          {totals && rows.length > 1 && (
            <tr className="border-t font-medium [&>td]:px-2 [&>td]:py-2 sm:[&>td]:px-3">
              <td className="pl-4 text-xs text-muted-foreground">All of the above</td>
              <td className={cn(num, "hidden sm:table-cell")}>{formatCount(totals.started)}</td>
              <td className={num}>{formatCount(totals.booted)}</td>
              <td className={num}>{formatCount(totals.failed)}</td>
              <td className={cn(num, "hidden sm:table-cell")}>{formatCount(totals.rolledBack)}</td>
              <td className="hidden pr-4 sm:table-cell" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportsFooter({ note = true }: { note?: boolean }) {
  return (
    <div className="space-y-1 border-t px-4 py-2">
      <p className="text-xs text-muted-foreground">Distinct devices that reported, not the installed population.</p>
      {note && <ReportsNote />}
    </div>
  );
}

function Absence({ availability }: { availability: "absent" | "error" | "silent" }) {
  if (availability === "silent") {
    return (
      <div className="px-4 py-3 text-sm">
        <p className="font-medium">No device reports in the last 7 days.</p>
        <p className="text-muted-foreground">
          Telemetry is off for this app, or no installed build has opted in. Rollout percentages are targets, not
          adoption.
        </p>
      </div>
    );
  }
  return (
    <p className="px-4 py-3 text-sm text-muted-foreground">
      {availability === "error"
        ? "Telemetry unavailable: the server could not aggregate reports. Releases are unaffected."
        : "This server does not report device telemetry."}
    </p>
  );
}

/** The release page's block: devices that booted this release, split by native version and platform. */
export function AdoptionBlock({
  org,
  app,
  releaseId,
  telemetry,
  noteShownAbove,
  className,
}: {
  org: string;
  app: AppStatus | undefined;
  releaseId: string;
  telemetry: AppTelemetry | undefined;
  /** The flag card above already says reports are unverified; this block does not repeat it. */
  noteShownAbove?: boolean;
  className?: string;
}) {
  const availability = telemetryAvailability(telemetry);
  const a = adoptionFor(telemetry, releaseId);
  const summary = telemetrySummary(telemetry);
  return (
    <section
      id="device-reports"
      className={cn("scroll-mt-20 rounded-lg border bg-card text-card-foreground", className)}
      aria-label="Observed adoption"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b px-4 py-2">
        <PanelTitle>Observed adoption · 7 days</PanelTitle>
        <span className="text-[11px] text-muted-foreground">distinct devices</span>
      </div>
      {availability !== "reporting" ? (
        <Absence availability={availability} />
      ) : !a || !app ? (
        <div className="px-4 py-3 text-sm">
          <p className="font-medium">No device reports about this release.</p>
          <p className="text-muted-foreground">The rollout target is who is offered it, not who runs it.</p>
        </div>
      ) : (
        <>
          <div className="space-y-0.5 px-4 pb-2 pt-3">
            {isFlaggedRows(a.rows) ? (
              <>
                {/* A flagged release leads with who failed. The successes are the smaller line beneath. */}
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-red-700 dark:text-red-300">
                    {formatCount(a.failed)}
                  </span>
                  <span className="text-sm text-muted-foreground">of {devices(a.started)} reported a failed boot</span>
                </p>
                <p
                  className="text-xs tabular-nums text-muted-foreground"
                  title="Distinct installs across all rows below; native-version updates do not count twice."
                >
                  {formatCount(a.booted)} reported a successful boot · {cohortOf(a.rows)} · last 7 days ·{" "}
                  {formatCount(a.rolledBack)} rolled back on device
                </p>
              </>
            ) : (
              <>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatCount(a.booted)}</span>
                  <span className="text-sm text-muted-foreground">reported successful boots</span>
                </p>
                <p
                  className="text-xs tabular-nums text-muted-foreground"
                  title="Distinct installs across all rows below; native-version updates do not count twice."
                >
                  {cohortOf(a.rows)} · last 7 days · of {devices(a.started)} that started booting ·{" "}
                  {formatCount(a.failed)} reported a failed boot · {formatCount(a.rolledBack)} rolled back on device
                </p>
              </>
            )}
            {a.booted + a.failed > a.started && (
              <p className="pt-1 text-xs text-muted-foreground">
                Booted and failed are counted separately. A device that failed once and booted on a later launch is in
                both, so together they can add up to more than started.
              </p>
            )}
          </div>
          <ReportsTable org={org} app={app} rows={sortRows(a.rows)} summary={summary} showRelease={false} totals={a} />
          <ReportsFooter note={!noteShownAbove} />
        </>
      )}
    </section>
  );
}

/** The app page's table: every release × native version × platform the server aggregated. */
export function DeviceReportsPanel({
  org,
  app,
  telemetry,
  isLoading,
  error,
  onRetry,
  className,
}: {
  org: string;
  app: AppStatus;
  /** The fresh read from `/telemetry`, or the overview's embedded copy while it loads. */
  telemetry: AppTelemetry | undefined;
  isLoading?: boolean;
  error?: Error;
  onRetry?: () => void;
  className?: string;
}) {
  const availability = telemetryAvailability(telemetry);
  const summary = telemetrySummary(telemetry);
  const rows = summary ? sortRows(summary.releases) : [];
  const reports = rows.reduce((n, r) => n + reportCount(r), 0);
  return (
    <section
      className={cn("rounded-lg border bg-card text-card-foreground", className)}
      aria-label="Adoption by release"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b px-4 py-2">
        <PanelTitle>Adoption by release · 7 days</PanelTitle>
        {rows.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatCount(reports)} reports</span>
        )}
      </div>
      {error && summary && (
        <p role="status" className="border-b px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          The last refresh failed ({error.message}), so these numbers are from an earlier read and may be out of date.
          {onRetry && (
            <>
              {" "}
              <button type="button" className="underline" onClick={onRetry}>
                Retry
              </button>
            </>
          )}
        </p>
      )}
      {error && !summary ? (
        <ErrorState className="m-4" title="Could not load device reports" message={error.message} onRetry={onRetry} />
      ) : isLoading && !telemetry ? (
        <p className="px-4 py-3 text-sm text-muted-foreground" aria-busy>
          Loading device reports…
        </p>
      ) : availability !== "reporting" ? (
        <Absence availability={availability} />
      ) : (
        <>
          <ReportsTable org={org} app={app} rows={rows} summary={summary} showRelease />
          <ReportsFooter />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Security exclusions
// ---------------------------------------------------------------------------

/**
 * Packages a `security` marker has excluded on devices, app-wide and for good. The one limit operators must
 * know: bundled code cannot be excluded over the air.
 */
export function ExclusionsPanel({
  blocked,
  packageVersion,
  isLoading,
  className,
}: {
  /** `undefined`: not read yet (loading, or an older server); `null`: the lookup failed; `[]`: none. */
  blocked: string[] | null | undefined;
  /** The release on screen, so its own exclusion is marked. */
  packageVersion?: number | null;
  isLoading?: boolean;
  className?: string;
}) {
  const versions = blocked ? sortVersions(blocked) : [];
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <PanelTitle>Security exclusions</PanelTitle>
        <ShieldBan className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </div>
      {blocked === undefined ? (
        <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "Not reported by this server."}</p>
      ) : blocked === null ? (
        <p className="text-sm text-muted-foreground">
          Unknown: the list could not be read. Treat older packages as possibly excluded.
        </p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None. A <span className="font-medium text-foreground">security</span> marker on a release would exclude every
          older package on devices.
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5" aria-label="Excluded package versions">
            {versions.map((v) => {
              const mine = packageVersion != null && String(packageVersion) === v;
              return (
                <li
                  key={v}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-xs tabular-nums",
                    mine ? "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-200" : "text-muted-foreground"
                  )}
                >
                  v{v}
                  {mine && <span className="ml-1 font-sans">this release</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {versions.length === 1 ? "1 package" : `${versions.length} packages`} can&apos;t run on upgraded SDKs.
            Permanent and app-wide. Bundled code can&apos;t be blocked over the air: with every cached package excluded,
            devices run what they shipped with. Retire it with a new native build.
          </p>
        </>
      )}
    </div>
  );
}

/** A release or rollback whose package upgraded SDKs refuse. Information, never a block. */
export function ExcludedPackageNotice({
  version,
  phase,
  className,
}: {
  version: number | string;
  /** `page`: a release on screen; `preview`: a rollback not yet confirmed; `done`: one that ran. */
  phase: "page" | "preview" | "done";
  className?: string;
}) {
  const serves =
    phase === "preview"
      ? "The server would serve it again, but"
      : phase === "done"
        ? "The server serves it again, but"
        : "";
  return (
    <div role="note" className={cn("rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-sm", className)}>
      <p className="flex items-start gap-2">
        <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
        <span>
          <strong className="font-medium">v{version} is security-excluded.</strong>{" "}
          {serves ? `${serves} upgraded` : "Upgraded"} SDKs refuse it and boot their bundled code instead; older SDKs
          still run it.
          {phase !== "page" && " Bundled code can't be blocked over the air."}
        </span>
      </p>
    </div>
  );
}

/** The rollback dialog's line when the exclusion list could not be read, so the check is not silently skipped. */
export function ExclusionsUnknownNotice({ className }: { className?: string }) {
  return (
    <p role="note" className={cn("rounded-md border p-2 text-xs text-muted-foreground", className)}>
      Security exclusions could not be read, so it is unknown whether this package is excluded on devices.
    </p>
  );
}
