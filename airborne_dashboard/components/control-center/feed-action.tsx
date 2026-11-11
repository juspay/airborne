import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock,
  Cloud,
  CloudOff,
  GitCommitHorizontal,
  ShieldCheck,
  Siren,
  TrendingUp,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { actionLabel } from "@/lib/control-center/deployments";
import type { DeploymentFeedAction } from "@/lib/control-center/types";
import { StateChip, type Tone } from "./status-badge";

const META: Record<DeploymentFeedAction, { icon: ComponentType<{ className?: string }>; tone: Tone }> = {
  created: { icon: GitCommitHorizontal, tone: "muted" },
  ramped: { icon: TrendingUp, tone: "rolling" },
  concluded: { icon: CheckCircle2, tone: "live" },
  rolled_back: { icon: Undo2, tone: "danger" },
  discarded: { icon: XCircle, tone: "muted" },
  emergency_rollback: { icon: Siren, tone: "emergency" },
  requested: { icon: UserCheck, tone: "approval" },
  approved: { icon: ShieldCheck, tone: "approval" },
  rejected: { icon: XCircle, tone: "muted" },
  expired: { icon: Clock, tone: "waiting" },
  cache_failed: { icon: CloudOff, tone: "waiting" },
  cache_retried: { icon: Cloud, tone: "muted" },
  policy_changed: { icon: ShieldCheck, tone: "approval" },
  executed: { icon: CheckCircle2, tone: "live" },
  failed: { icon: AlertTriangle, tone: "danger" },
  stale: { icon: Clock, tone: "waiting" },
  cancelled: { icon: XCircle, tone: "muted" },
  rollback_abandoned: { icon: Undo2, tone: "muted" },
  emergency_acknowledged: { icon: ShieldCheck, tone: "approval" },
};

/** The same chip language as the overview: icon, label and tone, never colour alone. */
export function ActionChip({
  action,
  label,
  className,
}: {
  action: DeploymentFeedAction | string;
  /** Replaces the label, keeping the action's icon and tone. */
  label?: string;
  className?: string;
}) {
  const known = Object.prototype.hasOwnProperty.call(META, action);
  // An action this dashboard does not know is named from what the server sent ("operation_resolved" reads
  // "Operation resolved") in a neutral tone: never dropped, never guessed to be good or bad.
  const m = known ? META[action as DeploymentFeedAction] : { icon: CircleHelp, tone: "muted" as Tone };
  return (
    <StateChip tone={m.tone} icon={m.icon} variant="inline" className={className}>
      {label ?? actionLabel(action)}
    </StateChip>
  );
}
