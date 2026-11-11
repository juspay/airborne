"use client";

import type { ComponentType } from "react";
import {
  AlertTriangle,
  CircleDashed,
  CircleDot,
  CircleHelp,
  Clock,
  CloudOff,
  Eye,
  FileWarning,
  Flag,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionSummary } from "@/lib/control-center/format";
import { StateChip, type Tone } from "./status-badge";

export type Focus =
  | "all"
  | "bad"
  | "suspicious"
  | "paused"
  | "cache"
  | "review"
  | "approval"
  | "rolling"
  | "waiting"
  | "failed"
  | "nothing"
  | "insufficient";

const ITEMS: {
  key: Exclude<Focus, "all">;
  field: keyof AttentionSummary;
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  label: (n: number) => string;
}[] = [
  { key: "bad", field: "seemsBad", tone: "danger", icon: Flag, label: (n) => `${n} Deployment seems bad` },
  {
    key: "suspicious",
    field: "suspicious",
    tone: "waiting",
    icon: FileWarning,
    label: (n) => `${n} Suspicious reports`,
  },
  { key: "paused", field: "writesPaused", tone: "danger", icon: AlertTriangle, label: (n) => `${n} Writes paused` },
  { key: "cache", field: "cacheStale", tone: "waiting", icon: CloudOff, label: (n) => `${n} CDN cache stale` },
  { key: "review", field: "needsReview", tone: "emergency", icon: Eye, label: (n) => `${n} Needs review` },
  {
    key: "approval",
    field: "awaitingApproval",
    tone: "approval",
    icon: UserCheck,
    label: (n) => `${n} Awaiting approval`,
  },
  { key: "rolling", field: "rollingOut", tone: "rolling", icon: CircleDot, label: (n) => `${n} rolling out` },
  { key: "waiting", field: "notStarted", tone: "muted", icon: Clock, label: (n) => `${n} not started` },
  { key: "failed", field: "lookupFailed", tone: "danger", icon: AlertTriangle, label: (n) => `${n} lookup failed` },
  { key: "nothing", field: "nothingLive", tone: "muted", icon: CircleDashed, label: (n) => `${n} nothing live` },
  {
    key: "insufficient",
    field: "insufficientData",
    tone: "muted",
    icon: CircleHelp,
    label: (n) => `${n} not enough data`,
  },
];

/** Compact, non-interactive chips for a card header. */
export function AttentionChips({ summary, compact }: { summary: AttentionSummary; compact?: boolean }) {
  const visible = ITEMS.filter(
    (i) => summary[i.field] > 0 && (!compact || (i.key !== "nothing" && i.key !== "insufficient"))
  );
  if (visible.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-1.5", compact ? "shrink-0" : "flex-wrap")}>
      {visible.map((i) => (
        <StateChip
          key={i.key}
          tone={i.tone}
          icon={i.icon}
          variant="inline"
          className="text-[11px]"
          title={i.label(summary[i.field])}
        >
          {compact ? summary[i.field] : i.label(summary[i.field])}
        </StateChip>
      ))}
    </div>
  );
}

/** The strip under the page title. Each chip is a filter toggle. */
export function AttentionStrip({
  summary,
  focus,
  onFocus,
  totals,
}: {
  summary: AttentionSummary;
  focus: Focus;
  onFocus: (f: Focus) => void;
  totals: { orgs: number; groups: number; apps: number };
}) {
  const quiet =
    summary.stateUnknown === 0 &&
    summary.seemsBad === 0 &&
    summary.suspicious === 0 &&
    summary.writesPaused === 0 &&
    summary.cacheStale === 0 &&
    summary.needsReview === 0 &&
    summary.awaitingApproval === 0 &&
    summary.rollingOut === 0 &&
    summary.notStarted === 0 &&
    summary.lookupFailed === 0;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Attention filters">
      <button
        type="button"
        onClick={() => onFocus("all")}
        aria-pressed={focus === "all"}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs font-medium",
          focus === "all" ? "border-foreground/40 bg-foreground/5" : "text-muted-foreground hover:text-foreground"
        )}
      >
        All · {totals.apps} app{totals.apps === 1 ? "" : "s"} in {totals.groups} group{totals.groups === 1 ? "" : "s"}
        {totals.orgs > 1 ? ` across ${totals.orgs} orgs` : ""}
      </button>
      {ITEMS.map((i) => {
        const n = summary[i.field];
        if (n === 0) return null;
        const pressed = focus === i.key;
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onFocus(pressed ? "all" : i.key)}
            aria-pressed={pressed}
            className={cn(
              "rounded-md transition-shadow",
              pressed && "ring-2 ring-ring ring-offset-1 ring-offset-background"
            )}
          >
            <StateChip tone={i.tone} icon={i.icon}>
              {i.label(n)}
            </StateChip>
          </button>
        );
      })}
      {summary.stateUnknown > 0 && (
        <span role="alert">
          State unreadable for {summary.stateUnknown} app{summary.stateUnknown === 1 ? "" : "s"}. Refresh before acting.
        </span>
      )}
      {quiet && totals.apps > 0 && (
        <span className="text-xs text-muted-foreground">
          {summary.approvalOn > 0
            ? "Quiet: nothing rolling out, nothing awaiting approval, no lookup failures, no stale caches."
            : "Quiet: nothing rolling out, no lookup failures, no stale caches."}
        </span>
      )}
    </div>
  );
}
