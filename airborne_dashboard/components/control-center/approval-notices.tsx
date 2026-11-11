"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  describeApprovalFailure,
  sensitivityConsequence,
  sensitivityLabel,
  type ApprovalFailure,
} from "@/lib/control-center/approval";
import type { RollbackSensitiveReason } from "@/lib/control-center/types";
import { RollbackProblem } from "./rollback-notices";
import { requestPath } from "./paths";

/** The shape every approval message uses: a titled box, one plain sentence, then the server's words. */
export function ApprovalNotice({
  title,
  children,
  tone = "approval",
  icon: Icon = ShieldCheck,
  className,
  role = "status",
}: {
  title: ReactNode;
  children?: ReactNode;
  tone?: "approval" | "danger" | "warning" | "emergency";
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  role?: "status" | "alert";
}) {
  const box = {
    approval: "border-violet-500/40 bg-violet-500/5",
    danger: "border-red-500/30 bg-red-500/5",
    warning: "border-amber-500/40 bg-amber-500/5",
    emergency: "border-orange-500/50 bg-orange-500/10",
  }[tone];
  const text = {
    approval: "text-violet-900 dark:text-violet-200",
    danger: "text-red-800 dark:text-red-200",
    warning: "text-amber-900 dark:text-amber-200",
    emergency: "text-orange-900 dark:text-orange-200",
  }[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", box, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", text)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("font-medium", text)}>{title}</p>
        {children}
      </div>
    </div>
  );
}

export function ServerSaid({ message }: { message: string }) {
  return <p className="break-words text-xs text-muted-foreground">Server said: {message}</p>;
}

/** Explains a refused approval, rejection, cancellation or request in one shape. */
export function ApprovalProblem({
  failure,
  org,
  app,
  releaseId,
  packageVersion,
  action,
  onNavigate,
  onRaiseInstead,
  className,
}: {
  failure: ApprovalFailure;
  org: string;
  app: string;
  releaseId?: string;
  packageVersion?: number;
  action?: string;
  onNavigate?: () => void;
  /** `approval_required` only: switch the dialog into request mode. */
  onRaiseInstead?: () => void;
  className?: string;
}) {
  if (failure.kind === "unresolved" && releaseId !== undefined) {
    return (
      <RollbackProblem
        failure={failure.failure}
        org={org}
        app={app}
        releaseId={releaseId}
        packageVersion={packageVersion ?? 0}
        onNavigate={onNavigate}
      />
    );
  }
  const title = (() => {
    switch (failure.kind) {
      case "approval_required":
        return "Approval required";
      case "self_approval":
        return "You cannot approve your own request";
      case "stale":
        return "This request is stale";
      case "expired":
        return "This request has expired";
      case "not_pending":
        return "Already decided";
      case "tampered":
        return "Request content does not match";
      case "not_checker":
        return "Not a checker for this application";
      case "not_maker":
        return "Requester is no longer a maker";
      case "not_requester":
        return "Only the requester can cancel";
      case "reason_required":
        return "A reason is required";
      case "unresolved":
        return "Writes are paused for this application";
      case "forbidden":
        return "Refused";
      case "execution_failed":
        return "Approved, but the action failed";
      case "already_executed":
        return "The change was applied";
      case "not_found":
        return "Request not found";
      case "unconfirmed":
        return "Outcome not confirmed";
      default:
        return failure.kind === "other" && failure.status !== undefined && failure.status < 500
          ? "Refused"
          : "Outcome not confirmed";
    }
  })();
  const tone = failure.kind === "approval_required" ? "approval" : "danger";
  return (
    <ApprovalNotice title={title} tone={tone} role="alert" className={className}>
      <p className="text-muted-foreground">{describeApprovalFailure(failure, { action })}</p>
      {failure.kind === "approval_required" && onRaiseInstead && (
        <button type="button" className="text-xs font-medium underline" onClick={onRaiseInstead}>
          Raise a request instead
        </button>
      )}
      <ServerSaid message={failure.message} />
    </ApprovalNotice>
  );
}

/** Shown wherever direct actions are withheld because the release is marked sensitive. */
export function SensitiveNotice({
  reason,
  packageVersion,
  className,
}: {
  reason: RollbackSensitiveReason | string;
  packageVersion: number;
  className?: string;
}) {
  return (
    <ApprovalNotice
      title={`v${packageVersion} is marked rollback-sensitive (${sensitivityLabel(reason)})`}
      tone="danger"
      icon={ShieldAlert}
      className={className}
    >
      <p className="text-muted-foreground">
        Lowering its target or rolling it back {sensitivityConsequence(reason)}, so those actions are not available
        directly here. They need a request approved by a different checker, or an emergency rollback by a checker, which
        is reviewed afterwards.
      </p>
    </ApprovalNotice>
  );
}

/** What an emergency rollback is, said the same way everywhere it appears. */
export function EmergencyExplainer({ className }: { className?: string }) {
  return (
    <ApprovalNotice title="Emergency rollback skips approval" tone="emergency" icon={Siren} className={className}>
      <p className="text-muted-foreground">
        Restore the previous release with a recorded reason; a different checker must review it afterward.
      </p>
    </ApprovalNotice>
  );
}

/** After a request is raised: where it went and when it lapses. */
export function RequestRaised({
  org,
  app,
  requestId,
  expiresAt,
  onNavigate,
}: {
  org: string;
  app: string;
  requestId: string;
  expiresAt: string;
  onNavigate?: () => void;
}) {
  return (
    <ApprovalNotice title="Request raised. Nothing has changed yet.">
      <p className="text-muted-foreground">
        A checker other than you must approve it; approval executes the change immediately. It expires{" "}
        <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time> if nobody decides.
      </p>
      <Link href={requestPath(org, app, requestId)} className="text-xs font-medium underline" onClick={onNavigate}>
        Open the request
      </Link>
    </ApprovalNotice>
  );
}
