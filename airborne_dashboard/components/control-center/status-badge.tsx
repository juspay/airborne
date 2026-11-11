import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserCheck,
  XCircle,
} from "lucide-react";
import { requestStatusLabel, requestStatusTone, sensitivityLabel } from "@/lib/control-center/approval";
import type { DeploymentRequestStatus, RollbackSensitiveReason } from "@/lib/control-center/types";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/control-center/format";
import type { ReleaseOutcome, ReleaseStatus } from "@/lib/control-center/types";

/** `approval` is maker-checker (violet, never confused with a rollout state); `emergency` is the single-person path. */
export type Tone = "live" | "rolling" | "waiting" | "muted" | "danger" | "approval" | "emergency" | "strict";

export const TONE_TEXT: Record<Tone, string> = {
  live: "text-emerald-700 dark:text-emerald-300",
  rolling: "text-sky-700 dark:text-sky-300",
  waiting: "text-amber-700 dark:text-amber-300",
  muted: "text-muted-foreground",
  danger: "text-red-700 dark:text-red-300",
  approval: "text-violet-700 dark:text-violet-300",
  emergency: "text-orange-700 dark:text-orange-300",
  strict: "text-teal-700 dark:text-teal-300",
};

export const TONE_BG: Record<Tone, string> = {
  live: "bg-emerald-500/10 border-emerald-500/30",
  rolling: "bg-sky-500/10 border-sky-500/30",
  waiting: "bg-amber-500/10 border-amber-500/30",
  muted: "bg-muted border-border",
  danger: "bg-red-500/10 border-red-500/30",
  approval: "bg-violet-500/10 border-violet-500/30",
  emergency: "bg-orange-500/10 border-orange-500/40",
  strict: "bg-teal-500/10 border-teal-500/30",
};

export const TONE_FILL: Record<Tone, string> = {
  live: "bg-emerald-500",
  rolling: "bg-sky-500",
  waiting: "bg-amber-500",
  muted: "bg-muted-foreground/40",
  danger: "bg-red-500",
  approval: "bg-violet-500",
  emergency: "bg-orange-500",
  strict: "bg-teal-500",
};

export function toneForStatus(status: ReleaseStatus | string): Tone {
  switch (status) {
    case "INPROGRESS":
      return "rolling";
    case "CREATED":
      return "waiting";
    case "CONCLUDED":
      return "live";
    case "DISCARDED":
      return "muted";
    default:
      return "muted";
  }
}

export function iconForStatus(status: ReleaseStatus | string): ComponentType<{ className?: string }> {
  switch (status) {
    case "INPROGRESS":
      return CircleDot;
    case "CREATED":
      return Clock;
    case "CONCLUDED":
      return CheckCircle2;
    case "DISCARDED":
      return XCircle;
    default:
      return CircleDashed;
  }
}

interface ChipProps {
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  /** `badge` has a tinted background; `inline` is text + icon only. */
  variant?: "badge" | "inline";
  title?: string;
}

/** Status is never colour alone: every chip carries an icon and a label. */
export function StateChip({ tone, icon: Icon, children, className, variant = "badge", title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-none",
        variant === "badge" && "rounded-md border px-1.5 py-1",
        variant === "badge" && TONE_BG[tone],
        TONE_TEXT[tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

export function StatusChip({
  status,
  className,
  variant,
}: {
  status: ReleaseStatus | string;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip tone={toneForStatus(status)} icon={iconForStatus(status)} className={className} variant={variant}>
      {statusLabel(status)}
    </StateChip>
  );
}

export function LiveChip({ className, variant }: { className?: string; variant?: "badge" | "inline" }) {
  return (
    <StateChip tone="live" icon={CheckCircle2} className={className} variant={variant}>
      Live
    </StateChip>
  );
}

/** Header chip for a release. A concluded release is labelled by the server's outcome, never by status alone. */
export function ReleaseStateChip({
  status,
  outcome,
  className,
  variant,
}: {
  status: ReleaseStatus | string;
  outcome: ReleaseOutcome | undefined;
  className?: string;
  variant?: "badge" | "inline";
}) {
  if (status !== "CONCLUDED") return <StatusChip status={status} className={className} variant={variant} />;
  const props = { className, variant };
  switch (outcome) {
    case "live":
      return <LiveChip {...props} />;
    case "superseded":
      return (
        <StateChip tone="muted" icon={CheckCircle2} {...props}>
          Superseded
        </StateChip>
      );
    case "concluded_on_control":
      return (
        <StateChip tone="muted" icon={CircleDashed} {...props}>
          Concluded on control
        </StateChip>
      );
    default:
      return (
        <StateChip
          tone="waiting"
          icon={AlertTriangle}
          {...props}
          title="The server did not report this release's outcome"
        >
          Concluded · outcome unknown
        </StateChip>
      );
  }
}

export function NothingLiveChip({ className, variant }: { className?: string; variant?: "badge" | "inline" }) {
  return (
    <StateChip tone="muted" icon={CircleDashed} className={className} variant={variant}>
      Nothing live
    </StateChip>
  );
}

export function LookupFailedChip({
  message,
  className,
  variant,
}: {
  message?: string | null;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip tone="danger" icon={AlertTriangle} className={className} variant={variant} title={message ?? undefined}>
      Lookup failed
    </StateChip>
  );
}

// ---------------------------------------------------------------------------
// Maker-checker chips
// ---------------------------------------------------------------------------

/** The policy is on for this application: adding exposure needs a second person. */
export function ApprovalRequiredChip({
  className,
  variant,
  pending,
}: {
  className?: string;
  variant?: "badge" | "inline";
  /** Pending requests, shown as a count when above zero. */
  pending?: number;
}) {
  return (
    <StateChip
      tone="approval"
      icon={ShieldCheck}
      className={className}
      variant={variant}
      title="Maker-checker is on: creating, ramping up, making live, editing and rolling back a live release need a request approved by a different checker."
    >
      Approval required{pending ? ` · ${pending} awaiting` : ""}
    </StateChip>
  );
}

export function AwaitingApprovalChip({
  count,
  className,
  variant,
}: {
  count?: number;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip tone="approval" icon={UserCheck} className={className} variant={variant}>
      {count !== undefined ? `${count} awaiting approval` : "Awaiting approval"}
    </StateChip>
  );
}

export function NeedsReviewChip({
  count,
  className,
  variant,
}: {
  count?: number;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip
      tone="emergency"
      icon={Eye}
      className={className}
      variant={variant}
      title="An emergency rollback skipped approval and has not been acknowledged by a different checker yet."
    >
      {count !== undefined ? `${count} needs review` : "Needs review"}
    </StateChip>
  );
}

export function EmergencyChip({ className, variant }: { className?: string; variant?: "badge" | "inline" }) {
  return (
    <StateChip tone="emergency" icon={Siren} className={className} variant={variant}>
      Emergency rollback
    </StateChip>
  );
}

export function RollbackSensitiveChip({
  reason,
  className,
  variant,
}: {
  reason: RollbackSensitiveReason | string;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip
      tone="danger"
      icon={ShieldAlert}
      className={className}
      variant={variant}
      title={`Marked rollback-sensitive (${sensitivityLabel(reason)}): lowering its target or rolling it back needs a request or an emergency rollback.`}
    >
      Rollback-sensitive · {sensitivityLabel(reason)}
    </StateChip>
  );
}

const REQUEST_ICON: Record<string, ComponentType<{ className?: string }>> = {
  pending: UserCheck,
  executing: CircleDot,
  executed: CheckCircle2,
  failed: AlertTriangle,
  rejected: XCircle,
  cancelled: XCircle,
  expired: Clock,
  stale: AlertTriangle,
};

export function RequestStatusChip({
  status,
  className,
  variant,
}: {
  status: DeploymentRequestStatus | string;
  className?: string;
  variant?: "badge" | "inline";
}) {
  return (
    <StateChip
      tone={requestStatusTone(status)}
      icon={REQUEST_ICON[status] ?? CircleDashed}
      className={className}
      variant={variant}
    >
      {requestStatusLabel(status)}
    </StateChip>
  );
}
