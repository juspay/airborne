"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastSuccess } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  classifyAcknowledgeError,
  describeAcknowledgeFailure,
  emergencyRestoredVersion,
} from "@/lib/control-center/approval";
import { useApprovalActions, useAsyncAction, useMe } from "@/lib/control-center/hooks";
import type { EmergencyReview, Platform } from "@/lib/control-center/types";
import { ApprovalNotice, ApprovalProblem, ServerSaid } from "./approval-notices";
import { PlatformMark } from "./platform-mark";
import { Pkg } from "./version";
import { RelativeTime } from "./time";
import { releasePath } from "./paths";

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * One emergency rollback that a different checker still has to acknowledge. The actor sees why they
 * cannot do it; everyone else with the right gets the Acknowledge button. The server decides either way.
 */
export function EmergencyReviewCard({
  org,
  app,
  platform,
  review,
  canAcknowledge,
  onChanged,
  className,
  dense,
}: {
  org: string;
  app: string;
  platform: Platform | null;
  review: EmergencyReview;
  /** The signed-in user is a checker for this application: the only thing the server asks of them. */
  canAcknowledge: boolean;
  onChanged?: () => void;
  className?: string;
  dense?: boolean;
}) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const mine = Boolean(me) && review.actor === me;
  // A review the server wrote after the rollback finished says so (`rollback_finished`) and names what it restored.
  // Without that it is only the plan, and the card says the outcome is not recorded.
  const { version: restored, confirmed, finished } = emergencyRestoredVersion(review);
  // The server states the rolled-back release's package on the review itself.
  const rolledBack = num(review.package_version);
  const replacement = str(review.new_release_id);
  const reason = str(review.reason);
  const at = str(review.created_at);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-orange-500/50 bg-orange-500/10 p-3 text-sm",
        !dense && "sm:flex-row sm:items-start",
        className
      )}
      role="status"
    >
      <Siren className="mt-0.5 h-4 w-4 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-orange-900 dark:text-orange-200">
          Emergency rollback needs review
          {restored !== null ? (
            <>
              {" "}
              · {confirmed ? "restored" : "planned to restore"} <Pkg version={restored} />
            </>
          ) : finished ? (
            " · rollback finished"
          ) : null}
        </p>
        <p className="text-muted-foreground">
          <span className="font-mono text-xs">{review.actor}</span> ran an emergency rollback of{" "}
          <Link
            href={releasePath(org, app, review.release_id)}
            className="font-mono text-xs underline"
            title={`release ${review.release_id}`}
          >
            {rolledBack !== null ? `v${rolledBack}` : review.release_id}
          </Link>{" "}
          without approval
          {at ? (
            <>
              {" "}
              <RelativeTime iso={at} />
            </>
          ) : null}
          .
          {reason && (
            <>
              {" "}
              Reason: <span className="text-foreground">{reason}</span>
            </>
          )}
        </p>
        {replacement && (
          <p className="text-xs text-muted-foreground">
            Replacement release:{" "}
            <Link
              href={releasePath(org, app, replacement)}
              className="font-mono underline"
              title="Open the replacement"
            >
              {replacement}
            </Link>
            {restored !== null && confirmed && (
              <>
                {" "}
                (serves <Pkg version={restored} size="sm" />)
              </>
            )}
          </p>
        )}
        {!finished && (
          <p className="text-xs text-muted-foreground">
            This review does not record whether the rollback completed. Open the release to see what is live before
            acknowledging.
          </p>
        )}
        {!dense && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PlatformMark platform={platform} />
            <span className="font-mono">{app}</span>
          </div>
        )}
        {mine ? (
          <p className="text-xs text-muted-foreground">
            You performed this rollback, so a different checker must acknowledge it.
          </p>
        ) : !canAcknowledge ? (
          <p className="text-xs text-muted-foreground">A checker for {app} acknowledges this after reviewing it.</p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-orange-500/60"
        onClick={() => setOpen(true)}
        disabled={mine || !canAcknowledge}
        title={
          mine
            ? "You performed this rollback, so a different checker must acknowledge it."
            : !canAcknowledge
              ? `Only a checker for ${app} can acknowledge.`
              : undefined
        }
      >
        <Eye /> Acknowledge
      </Button>
      <AcknowledgeDialog open={open} onOpenChange={setOpen} org={org} app={app} review={review} onChanged={onChanged} />
    </div>
  );
}

function AcknowledgeDialog({
  open,
  onOpenChange,
  org,
  app,
  review,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: string;
  app: string;
  review: EmergencyReview;
  onChanged?: () => void;
}) {
  const actions = useApprovalActions();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setReason("");
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const ok = await run(async () => {
      try {
        await actions.acknowledgeEmergency(org, app, review.release_id, reason.trim());
      } catch (e) {
        // Already acknowledged, or an answer we cannot place: the card on screen may be out of date.
        const kind = classifyAcknowledgeError(e).kind;
        if (kind === "gone" || kind === "unconfirmed") onChanged?.();
        throw e;
      }
      return true;
    });
    if (ok) {
      toastSuccess("Emergency rollback acknowledged", app);
      onOpenChange(false);
      onChanged?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="border-orange-500/60 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <Eye className="h-5 w-5" aria-hidden /> Acknowledge emergency rollback
          </DialogTitle>
          <DialogDescription>
            Acknowledging records that a second person reviewed this single-person change. It does not undo or redo
            anything.
          </DialogDescription>
        </DialogHeader>
        <ApprovalNotice
          title={`${review.actor} ran an emergency rollback of ${num(review.package_version) !== null ? `v${num(review.package_version)}` : review.release_id} without approval`}
          tone="emergency"
          icon={Siren}
        >
          {str(review.reason) && <p className="text-muted-foreground">Their reason: {str(review.reason)}</p>}
          <p className="text-muted-foreground">
            Check the timeline and the release that is live now before acknowledging. If the rollback was wrong, raise a
            request to re-release the right package.
          </p>
        </ApprovalNotice>
        <div className="space-y-1.5">
          <Label htmlFor="cc-ack-reason">Finding (recorded in the timeline)</Label>
          <Textarea
            id="cc-ack-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. reviewed INC-4821; rollback was justified, v9 fix to follow through a request"
            rows={3}
            autoFocus
            disabled={pending}
          />
        </div>
        {error && (
          <AcknowledgeProblem
            rawError={rawError}
            org={org}
            app={app}
            releaseId={review.release_id}
            onNavigate={() => onOpenChange(false)}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || reason.trim().length === 0}>
            {pending ? "Recording…" : "Acknowledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcknowledgeProblem({
  rawError,
  org,
  app,
  releaseId,
  onNavigate,
}: {
  rawError: unknown;
  org: string;
  app: string;
  releaseId: string;
  onNavigate: () => void;
}) {
  const failure = classifyAcknowledgeError(rawError);
  if (failure.kind === "unresolved") {
    return (
      <ApprovalProblem
        failure={failure}
        org={org}
        app={app}
        releaseId={releaseId}
        action="acknowledgement"
        onNavigate={onNavigate}
      />
    );
  }
  const { title, text } = describeAcknowledgeFailure(failure);
  return (
    <ApprovalNotice title={title} tone="danger" role="alert">
      <p className="text-muted-foreground">{text}</p>
      <ServerSaid message={failure.message} />
    </ApprovalNotice>
  );
}
