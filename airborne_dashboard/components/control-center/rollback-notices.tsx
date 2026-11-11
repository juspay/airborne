"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AbandonRollback } from "./abandon-rollback";
import { OperationRecovery } from "./operation-recovery";
import { cn } from "@/lib/utils";
import type { RollbackFailure } from "@/lib/control-center/rollback-error";
import type { ReconciledKeys } from "@/lib/control-center/types";
import { releasePath } from "./paths";

/** The red box every refusal uses, so the operator learns one shape. */
function Notice({
  title,
  children,
  tone = "danger",
  className,
}: {
  title: string;
  children: ReactNode;
  tone?: "danger" | "warning";
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "space-y-1.5 rounded-lg border p-3 text-sm",
        tone === "danger" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5",
        className
      )}
    >
      <p
        className={cn(
          "font-medium",
          tone === "danger" ? "text-red-800 dark:text-red-200" : "text-amber-900 dark:text-amber-200"
        )}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

/** A link to a release. The raw id stays in the hover text, not on the page. */
function ReleaseLink({ org, app, id, onNavigate }: { org: string; app: string; id: string; onNavigate?: () => void }) {
  return (
    <Link href={releasePath(org, app, id)} className="underline" onClick={onNavigate} title={`Open release ${id}`}>
      open release
    </Link>
  );
}

function ServerSaid({ message }: { message: string }) {
  return <p className="break-words text-xs text-muted-foreground">Server said: {message}</p>;
}

interface ProblemProps {
  failure: RollbackFailure;
  org: string;
  app: string;
  /** The release the operator is rolling back. */
  releaseId: string;
  packageVersion: number;
  onNavigate?: () => void;
  /** Unresolved only: re-reads the server's view without changing anything. */
  onCheckAgain?: () => void;
  checkingAgain?: boolean;
}

/** Explains a refusal, whether it came from the preview (before confirming) or from the POST. */
export function RollbackProblem({
  failure,
  org,
  app,
  releaseId,
  packageVersion,
  onNavigate,
  onCheckAgain,
  checkingAgain,
}: ProblemProps) {
  const link = (id: string) => <ReleaseLink org={org} app={app} id={id} onNavigate={onNavigate} />;

  switch (failure.kind) {
    case "blocked": {
      const replacement = failure.replacementReleaseId ? (
        <p className="text-muted-foreground">
          This rollback created a replacement release ({link(failure.replacementReleaseId)}).
        </p>
      ) : null;
      switch (failure.code) {
        case "superseded":
          return (
            <Notice title="A newer release is live">
              <p className="text-muted-foreground">
                v{packageVersion} is no longer the live release for its reach, so it cannot be rolled back. Nothing was
                changed.{" "}
                {failure.currentLiveReleaseId ? (
                  <>To roll back, act on the release that is live now ({link(failure.currentLiveReleaseId)}).</>
                ) : (
                  <>To roll back, open the release that is live now from the overview.</>
                )}
              </p>
              {replacement}
              <ServerSaid message={failure.message} />
            </Notice>
          );
        case "ongoing":
          return (
            <Notice title="Another release is in progress for this reach">
              <p className="text-muted-foreground">
                A rollback re-releases the previous package, and Airborne allows one ongoing release per reach at a
                time. Nothing was changed.{" "}
                {failure.currentLiveReleaseId ? (
                  <>
                    Conclude or discard the ongoing release ({link(failure.currentLiveReleaseId)}) first, then roll
                    back.
                  </>
                ) : (
                  <>Conclude or discard the ongoing release first, then roll back.</>
                )}
              </p>
              {replacement}
              <ServerSaid message={failure.message} />
            </Notice>
          );
        case "missing_files":
          return (
            <Notice title="Files of the earlier package are missing or unreachable">
              <p className="text-muted-foreground">
                Before restoring, Airborne checks every file the earlier package needs (its index, important and lazy
                files, and resources) against the file records and the file host. At least one is missing, incomplete or
                not reachable, so restoring it would ship a broken bundle. Nothing was changed.
              </p>
              <p className="text-muted-foreground">
                Restore the missing files to the file host, or publish a reviewed replacement release instead.
              </p>
              <ServerSaid message={failure.message} />
            </Notice>
          );
        case "rollback_chain":
          return (
            <Notice title="This release is itself a rollback">
              <p className="text-muted-foreground">
                It was created by rolling back{" "}
                {failure.rollbackOf ? <>an earlier release ({link(failure.rollbackOf)})</> : "an earlier release"}.
                Rolling it back again would restore the release that was rejected, so Airborne refuses. Nothing was
                changed.
              </p>
              <p className="text-muted-foreground">
                To serve something else, create a new release with a reviewed package and config. If the earlier
                rollback did not finish, retry it from the rejected release instead.
              </p>
              <ServerSaid message={failure.message} />
            </Notice>
          );
        case "no_predecessor":
          return (
            <Notice title="There is no earlier release to roll back to">
              <p className="text-muted-foreground">
                No earlier live release exists for this reach, so there is no package to restore. Nothing was changed.
                If v{packageVersion} is faulty, publish a corrected release instead.
              </p>
              <ServerSaid message={failure.message} />
            </Notice>
          );
        case "artifact_verification_unknown":
          return (
            <Notice title="Could not verify the earlier package’s files">
              <p>Nothing changed. The file host may be temporarily unavailable. Check again to retry verification.</p>
              <ServerSaid message={failure.message} />
              {onCheckAgain && (
                <Button variant="outline" onClick={onCheckAgain} disabled={checkingAgain}>
                  Check again
                </Button>
              )}
            </Notice>
          );
        default:
          if (failure.finished) {
            return (
              <Notice title="This release can no longer be rolled back">
                <p className="text-muted-foreground">
                  It was discarded or rolled back since this page loaded, so there is nothing to roll back. Nothing was
                  changed. Close this and reload the release to see its current state.
                </p>
                <ServerSaid message={failure.message} />
              </Notice>
            );
          }
          return (
            <Notice title="The earlier package cannot be restored automatically">
              <p className="text-muted-foreground">
                {failure.replacementReleaseId ? "The replacement exists. " : "Nothing was created. "}Airborne will not
                guess at a configuration it cannot verify: someone who can review the registered config keys, their
                schemas and any validation functions has to resolve this, or a new release has to be published.
              </p>
              {replacement}
              <ServerSaid message={failure.message} />
            </Notice>
          );
      }
    }

    case "replacement_changed": {
      const id = failure.replacementReleaseId;
      return (
        <Notice title="The replacement release was changed outside this rollback">
          <p className="text-muted-foreground">
            {id === releaseId ? (
              <>The release being rolled back was changed after the rollback began. </>
            ) : id ? (
              <>
                The rollback of v{packageVersion} had already created a replacement release ({link(id)}), and someone
                has changed it since.{" "}
              </>
            ) : (
              <>
                The state of this reach changed after the rollback began (for example a newer or ongoing release
                appeared).{" "}
              </>
            )}
            Airborne will not resume it automatically, so there is no Retry here and nothing further was changed.
          </p>
          <p className="text-muted-foreground">
            Open {id && id !== releaseId ? "the replacement" : "the release"}, check its variants, rollout target,
            chosen variant and change history, then decide by hand what the reach should serve.
          </p>
          {failure.operationId && (
            <p className="text-xs text-muted-foreground">
              Rollback operation <span className="break-all font-mono">{failure.operationId}</span>
            </p>
          )}
          <ServerSaid message={failure.message} />
          <AbandonRollback org={org} app={app} releaseId={releaseId} />
        </Notice>
      );
    }

    case "unresolved":
      return (
        <UnresolvedNotice
          failure={failure}
          app={app}
          link={link}
          onCheckAgain={onCheckAgain}
          checkingAgain={checkingAgain}
        />
      );

    case "partial": {
      const id = failure.replacementReleaseId;
      return (
        <Notice title={`Rollback stopped at the “${failure.stage}” step`}>
          <p className="text-muted-foreground">
            {id ? (
              <>
                Replacement release ({link(id)}) exists, but the rollback is <strong>not complete</strong>: v
                {packageVersion} may still be served. Retrying resumes from the replacement instead of starting again.
              </>
            ) : (
              <>
                The rollback is <strong>not complete</strong> and no replacement release was recorded yet: one may or
                may not exist upstream. v{packageVersion} may still be served. Retrying looks for it by the
                operation&apos;s marker and resumes it, so it does not create a duplicate.
              </>
            )}
          </p>
          {failure.operationId && (
            <p className="text-xs text-muted-foreground">
              Rollback operation <span className="break-all font-mono">{failure.operationId}</span>
            </p>
          )}
          <ServerSaid message={failure.message} />
        </Notice>
      );
    }

    case "unknown":
      return (
        <Notice title="No clear answer from the server">
          <p className="text-muted-foreground">
            The rollback may or may not have been applied. Retrying is safe: if it already completed, the server returns
            the recorded result instead of rolling back again.
          </p>
          <ServerSaid message={failure.message} />
        </Notice>
      );

    default:
      return (
        <Notice title="Rollback refused">
          <p className="break-words text-muted-foreground">{failure.message}</p>
        </Notice>
      );
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="self-start text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-xs">{children}</dd>
    </>
  );
}

function stateText(status: string | null, traffic: number | null, chosen: string | null): string | null {
  const parts = [
    status,
    traffic !== null ? `target ${traffic}%` : null,
    chosen ? `chosen variant ${chosen}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Unknown upstream writes pause the app. Recovery is an audited org-admin
 * action in the Writes paused panel; SQL is never offered in this UI. */
function UnresolvedNotice({
  failure,
  app,
  link,
  onCheckAgain,
  checkingAgain,
}: {
  failure: Extract<RollbackFailure, { kind: "unresolved" }>;
  app: string;
  link: (id: string) => ReactNode;
  onCheckAgain?: () => void;
  checkingAgain?: boolean;
}) {
  const d = failure.details;
  const expected = stateText(d.expectedStatus, d.expectedTraffic, d.expectedChosenVariant);
  const before = stateText(d.beforeStatus, d.beforeTraffic, null);

  return (
    <Notice
      title={`${d.ownAttempt ? "This attempt" : "A change"} to ${app} has an unconfirmed outcome. Writes are paused.`}
    >
      <p className="text-muted-foreground">
        Airborne sent a change to Superposition and does not know whether it took effect (a timeout or a lost lock).
        Until the real state is confirmed, every release write for <strong>{app}</strong> is refused.{" "}
        {d.ownAttempt ? "This attempt may have changed upstream state." : "This refusal did not send another write."} Do
        not assume the change failed because time has passed.
      </p>

      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 rounded-md border bg-background/60 p-2">
        <Row label="Operation">{d.operationId ?? "not reported"}</Row>
        {d.workspace && <Row label="Workspace">{d.workspace}</Row>}
        {d.targetReleaseId && <Row label="Release">{link(d.targetReleaseId)}</Row>}
        {expected && <Row label="Expected">{expected}</Row>}
        {before && <Row label="Before">{before}</Row>}
        {d.marker && <Row label="Marker">{d.marker}</Row>}
        {failure.replacementReleaseId && <Row label="Replacement">{link(failure.replacementReleaseId)}</Row>}
      </dl>

      <div className="space-y-1">
        <p className="font-medium">What to check</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            In Superposition
            {d.workspace ? (
              <>
                {" "}
                (workspace <span className="font-mono text-xs">{d.workspace}</span>)
              </>
            ) : null}
            , open {d.targetReleaseId ? "that experiment" : "the experiment for this release"} and compare its current
            state and change history with the expected state above. Look for a change whose reason contains the marker.
          </li>
          <li>
            Check the original request in the server and proxy logs: did it reach Superposition, and has it finished?
          </li>
          <li>
            <strong>Expected state is present:</strong> the change was accepted. An organisation admin can verify and
            record acceptance in the Writes paused panel; retrying a write also reconciles marked upstream state.
          </li>
          <li>
            <strong>Not present:</strong> only once you are sure the original request has ended and will not run later,
            ask an organisation admin to review recovery in the Writes paused panel.
          </li>
        </ol>
      </div>

      {onCheckAgain && (
        <Button type="button" variant="outline" size="sm" onClick={onCheckAgain} disabled={checkingAgain}>
          {checkingAgain ? "Checking…" : "Check again"}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        An organisation admin can review this operation from the app&apos;s Writes paused panel. Recovery re-reads
        upstream and records the finding and reason in the audit timeline.
      </p>
      <p className="break-words text-xs text-muted-foreground">Server said: {failure.message}</p>
    </Notice>
  );
}

/** Page-level banner: an unresolved operation blocks every release write for the app. */
export function UnresolvedBanner({
  org,
  app,
  operationId,
  message,
}: {
  org: string;
  app: string;
  operationId: string | null;
  message: string;
}) {
  if (operationId) return <OperationRecovery org={org} app={app} operationId={operationId} />;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
      <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-red-800 dark:text-red-200">
          Release writes for {app} are paused: an earlier change has an unconfirmed outcome
        </p>
        <p className="text-muted-foreground">
          Ramp, make live, discard and roll back are refused until the real upstream state is confirmed.
          {operationId && (
            <>
              {" "}
              Operation <span className="break-all font-mono text-xs">{operationId}</span>.
            </>
          )}{" "}
          Nothing is shown as failed or applied. The next write you attempt re-reads upstream; if it is still
          unresolved, the refusal lists exactly what to check.
        </p>
        <p className="break-words text-xs text-muted-foreground">Server said: {message}</p>
      </div>
    </div>
  );
}

/** Keys that will change when the previous release is restored. Used before and after confirming. */
export function ReconciledNotice({
  keys,
  resultingVersion,
  done,
}: {
  keys: ReconciledKeys;
  /** The package being restored (a number once known). */
  resultingVersion: number | null;
  /** True once the rollback ran (past tense). */
  done?: boolean;
}) {
  const v = resultingVersion === null ? "the older package" : `v${resultingVersion}`;
  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        {done ? "Config keys were reconciled" : "Config keys will be reconciled"}
      </p>
      <p>
        <strong>This keeps the config valid, but it does not prove that {v} works with it.</strong>{" "}
        {done
          ? `Nothing has tested ${v} against these keys. Check it on a device before relying on this rollback.`
          : `Nothing has tested ${v} against these keys. Be ready to check it on a device after confirming.`}
      </p>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="uppercase tracking-wide text-muted-foreground">Kept current</dt>
        <dd>
          <KeyList keys={keys.kept_current} />
          <span className="block text-muted-foreground">Registered since {v}, so they keep today&apos;s value.</span>
        </dd>
        {keys.dropped.length > 0 && (
          <>
            <dt className="uppercase tracking-wide text-muted-foreground">Dropped</dt>
            <dd>
              <KeyList keys={keys.dropped} />
              <span className="block text-muted-foreground">No longer registered, so they are not restored.</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function KeyList({ keys }: { keys: string[] }) {
  if (keys.length === 0) return <span className="text-muted-foreground">none</span>;
  return (
    <ul className="space-y-0.5">
      {keys.map((k) => (
        <li key={k} className="break-all font-mono text-xs">
          {k}
        </li>
      ))}
    </ul>
  );
}
