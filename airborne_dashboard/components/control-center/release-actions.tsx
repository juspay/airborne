"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Lock, ShieldAlert, Siren, TrendingDown, TrendingUp, Undo2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toastSuccess } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MAX_RAMP_TARGET, platformApp } from "@/lib/control-center/format";
import { isExcluded, type ReleaseFlag } from "@/lib/control-center/telemetry";
import { useApprovalActions, useAsyncAction, useReleaseActions, useRollbackPreview } from "@/lib/control-center/hooks";
import {
  DEVICE_BOOT_UNCONFIRMED,
  reasonFromFlag,
  reasonPlaceholder,
  rollbackActionLabel,
  rollbackDirectBody,
  rollbackHeadline,
  rollbackRequestBody,
  serverNowServes,
} from "@/lib/control-center/rollback-copy";
import {
  classifyCacheError,
  classifyRollbackError,
  failureFromBlocked,
  isTerminalFailure,
} from "@/lib/control-center/rollback-error";
import {
  classifyApprovalError,
  everyRampTargetNeedsRequest,
  isChecker,
  canOfferEmergency,
  isEmergencyReviewPending,
  isMaker,
  needsApproval,
  requestButtonLabel,
  sensitivityConsequence,
  sensitivityLabel,
  type ApprovalFailure,
  requiresEmergencyRiskAcceptance,
} from "@/lib/control-center/approval";
import type {
  ApprovalPolicy,
  DeploymentAction,
  DeploymentRequest,
  DimensionContext,
  LiveRelease,
  Platform,
  ReleaseOutcome,
  ReleaseStatus,
  RollbackResponse,
  RollbackSensitiveReason,
} from "@/lib/control-center/types";
import { Pkg } from "./version";
import { Reach } from "./reach-card";
import { ErrorState } from "./states";
import { ReconciledNotice, RollbackProblem } from "./rollback-notices";
import {
  ApprovalNotice,
  ApprovalProblem,
  EmergencyExplainer,
  RequestRaised,
  SensitiveNotice,
} from "./approval-notices";
import { CacheFailureAfterWrite } from "./cache-notice";
import { LocaleExceptionsNotice } from "./locale-notice";
import { ExcludedPackageNotice, ExclusionsUnknownNotice, FlagAcknowledge } from "./telemetry";
import { APPROVALS_PATH, appPath, classicNewReleasePath, releasePath } from "./paths";
import { RollbackSensitiveChip } from "./status-badge";
import { RollbackMarkerSelect } from "./marker-select";

export interface ReleaseSummary {
  releaseId: string;
  status: ReleaseStatus | string;
  packageVersion: number;
  trafficPercentage: number;
  dimensions: DimensionContext;
  /** The exact variant id conclude requires. `undefined` when the server did not report it: Make live is then blocked. */
  experimentalVariant: string | undefined;
  /** The server's verdict on this release. `undefined` means unknown, and nothing that depends on it is offered. */
  outcome: ReleaseOutcome | undefined;
}

export interface ReleasePermissions {
  /** False until the permission check has answered; nothing is offered before that. */
  ready: boolean;
  ramp: boolean;
  conclude: boolean;
  /** Rollback uses the conclude permission on the server. */
  rollback: boolean;
  /** Changing the rollback-sensitive marker is a release update on the server. */
  update: boolean;
}

/**
 * Maker-checker, as read from the server. Labels and dialogs follow it; every rule is still enforced
 * server-side, and a refused direct action offers to raise a request instead.
 */
export interface ApprovalContext {
  /** False until the policy has been read. Buttons keep their direct labels until then. */
  ready: boolean;
  policy: ApprovalPolicy | undefined;
  /** This release's `rollback_sensitive` marker, from the overview. */
  sensitive: RollbackSensitiveReason | null | undefined;
  /** The signed-in subject, for "you raised this" and the emergency button. */
  me: string | null;
}

interface BarProps {
  org: string;
  app: string;
  platform: Platform | null;
  release: ReleaseSummary;
  /** What is live for the same dimension context right now (may be this very release). */
  liveNow: LiveRelease | undefined;
  /** Another release ongoing for the same reach, when the overview knows one. Only used to link it. */
  otherOngoing?: { release_id: string; package_version: number } | undefined;
  /** Live locale-targeted releases this general release does not replace (see `localeExceptions`). */
  localeExceptions?: LiveRelease[];
  permissions: ReleasePermissions;
  approval?: ApprovalContext;
  /**
   * The telemetry flag on this release, when there is one. It changes emphasis and wording only: with
   * "seems bad", Roll back leads and Make live is demoted. Every control still works; a person decides.
   */
  flag?: ReleaseFlag;
  size?: "sm" | "default";
  className?: string;
  onChanged?: () => void;
  /**
   * Where the buttons are drawn. The bar itself, with every dialog and its in-flight state, stays where it is mounted,
   * so moving the buttons (into the incident card when a flag appears, back out when it clears) cannot close a dialog,
   * clear a typed reason or drop a rollback's result. `null` = the target is not in the page yet: nothing is drawn.
   * Leave it undefined to draw the buttons in place.
   */
  slot?: HTMLElement | null;
}

type DialogKind = "ramp" | "conclude" | "rollback" | "emergency" | "marker" | null;

const NO_APPROVAL: ApprovalContext = { ready: true, policy: undefined, sensitive: null, me: null };

/** How a confirmation dialog submits: straight to the action, as a deployment request, or as an emergency rollback. */
type SubmitMode = "direct" | "request" | "emergency";

/** The reason box every request and every rollback uses. */
function ReasonField({
  id,
  value,
  onChange,
  disabled,
  label,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={disabled}
      />
    </div>
  );
}

/** Why a request is needed here, in one line under the facts. */
function WhyRequest({
  action,
  sensitive,
  lowering,
}: {
  action: DeploymentAction;
  sensitive: RollbackSensitiveReason | null;
  lowering?: boolean;
}) {
  if (sensitive && (action === "rollback" || lowering)) {
    return (
      <p className="text-xs text-muted-foreground">
        Approval is on and this release is rollback-sensitive ({sensitivityLabel(sensitive)}): moving users off it{" "}
        {sensitivityConsequence(sensitive)}. A different checker must approve.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Approval is on for this application and this change adds exposure, so it is raised as a request. A checker other
      than you approves it, and approval executes it immediately.
    </p>
  );
}

/** A fact row used by every confirmation so the operator sees the same shape each time. */
function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground self-center">{r.label}</dt>
          <dd className="min-w-0">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PkgLine({ version, note }: { version: number | undefined; note?: string }) {
  if (version === undefined) return <span className="text-muted-foreground">Live state not verified</span>;
  return (
    <span className="inline-flex items-baseline gap-2">
      <Pkg version={version} />
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </span>
  );
}

export function ReleaseActionBar({
  org,
  app,
  platform,
  release,
  liveNow,
  otherOngoing,
  localeExceptions = [],
  permissions,
  approval = NO_APPROVAL,
  flag,
  size = "default",
  className,
  onChanged,
  slot,
}: BarProps) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  // Set when the ramp dialog is opened to lower the target; it then starts at 0%, not at the next step up.
  const [rampStart, setRampStart] = useState<number | undefined>(undefined);
  const openRamp = (start?: number) => {
    setRampStart(start);
    setDialog("ramp");
  };
  const setTargetToZero = () => openRamp(0);
  // Draws the visible part of the bar in the slot the page chose, or here when it chose none.
  const place = (node: ReactNode) => (slot === undefined ? node : slot ? createPortal(node, slot) : null);
  const status = release.status;
  const isOngoing = status === "CREATED" || status === "INPROGRESS";
  // Only the server's outcome says a concluded release is the live one.
  const isLive = status === "CONCLUDED" && release.outcome === "live";
  const canRollback = isOngoing || isLive;
  // An incident: the server's detector says this release seems bad. Roll back leads; Make live steps back.
  const incident = flag?.status === "seems_bad" && (isOngoing || isLive);

  // Maker-checker, mirrored from the policy the server returned. Unknown policy = direct labels.
  const policyOn = approval.ready && Boolean(approval.policy?.enabled);
  // The marker is a fact about the release and is warned about whether or not approval is on;
  // only the gating (request instead of direct) depends on the policy.
  const marker = approval.sensitive;
  const sensitive = policyOn ? marker : null;
  const maker = isMaker(approval.policy, approval.me);
  const checker = isChecker(approval.policy, approval.me);
  // Which actions the server would send to the queue (the table in the spec).
  // In an incident the target button lowers it: that reduces exposure, so only a sensitive release asks for approval.
  const lowersTarget = incident && release.trafficPercentage > 0;
  const rampNeedsRequest =
    policyOn && needsApproval("ramp", status, release.trafficPercentage, lowersTarget ? 0 : 100, Boolean(sensitive));
  // The button label follows the likely change (raising), but whether a non-maker can use it follows every target the
  // dialog allows: lowering a non-sensitive release is direct on the server, with no maker check, whatever the
  // detector has said. Only when every target needs a request (a start, or a sensitive release) is it locked.
  const everyTargetNeedsRequest = everyRampTargetNeedsRequest(policyOn, status, Boolean(sensitive));
  const concludeNeedsRequest = policyOn;
  const rollbackNeedsRequest =
    policyOn && needsApproval("rollback", status, release.trafficPercentage, 0, Boolean(sensitive));
  const emergencyOffered = policyOn && isLive && canOfferEmergency(approval.policy, approval.me);
  const notMaker = policyOn && !maker;
  const notMakerHint = `You are not a maker for ${app}, so you cannot raise requests here.`;

  // Keep the bar mounted while a dialog is open: a successful rollback flips the status, and the
  // result panel (outcome, link to the new release) must not vanish with it.
  if (!isOngoing && !canRollback && dialog === null) {
    return place(
      <p className={cn("text-xs text-muted-foreground", className)}>
        {status === "DISCARDED"
          ? "Discarded. No action is possible."
          : release.outcome === "superseded"
            ? "Superseded by a newer release. Nothing to ramp or roll back here; act on the live release."
            : release.outcome === "concluded_on_control"
              ? "Stopped before it went live: devices stayed on the previous release. Nothing to ramp or roll back."
              : "State unknown: the server did not report this release's outcome, so no actions are offered."}
      </p>
    );
  }

  if (!approval.ready) {
    return place(
      <p className="text-sm text-muted-foreground">Approval state unknown. Refresh before making release changes.</p>
    );
  }

  const denied = (what: string) =>
    permissions.ready ? `You do not have permission to ${what} releases in ${app}.` : "Checking permissions…";

  // A request button is enabled for makers with the underlying permission; a direct one for the permission alone.
  const gate = (allowed: boolean, needsRequest: boolean, what: string) => {
    if (!allowed) return { disabled: true, title: denied(what) };
    if (needsRequest && notMaker) return { disabled: true, title: notMakerHint };
    return { disabled: false, title: undefined };
  };
  const ramp = gate(permissions.ramp, everyTargetNeedsRequest, "ramp");
  const conclude = gate(permissions.conclude, concludeNeedsRequest, "conclude");
  const rollback = gate(permissions.rollback, rollbackNeedsRequest, "roll back");
  // The exit a blocked rollback offers when it can be taken: stop offering this release to anyone.
  const canZero = status === "INPROGRESS" && release.trafficPercentage > 0 && !ramp.disabled;
  const emergencyTitle = !permissions.rollback
    ? denied("roll back")
    : !checker
      ? `Only a checker for ${app} can perform an emergency rollback.`
      : undefined;

  const dialogProps = {
    org,
    app,
    platform,
    release,
    liveNow,
    onChanged,
    sensitive,
    marker,
    markerUnknown: marker === undefined,
    me: approval.me,
    localeExceptions,
    notMaker,
  };

  // Direct rollback of a live release is the destructive primary. In an incident it is also the primary when it
  // has to be requested, so the label stays "Request rollback" and the button stays filled.
  const rollbackButton = canRollback && (
    <Button
      size={size}
      variant={
        isLive && !rollbackNeedsRequest
          ? "destructive"
          : incident
            ? rollbackNeedsRequest
              ? "default"
              : "destructive"
            : "outline"
      }
      onClick={() => setDialog("rollback")}
      disabled={rollback.disabled}
      title={rollback.title}
      className={
        rollbackNeedsRequest
          ? incident
            ? "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:text-black dark:hover:bg-violet-400"
            : "border-violet-500/40"
          : !isLive && !incident
            ? "text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
            : undefined
      }
    >
      {rollback.disabled ? <Lock /> : rollbackNeedsRequest ? <UserCheck /> : <Undo2 />}
      {rollbackNeedsRequest ? requestButtonLabel("rollback") : status === "CREATED" ? "Discard" : "Roll back"}
    </Button>
  );

  const buttons = (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {incident && rollbackButton}
        {isOngoing && (
          <Button
            size={size}
            variant="outline"
            onClick={() => openRamp(lowersTarget ? 0 : undefined)}
            disabled={ramp.disabled}
            title={ramp.title}
            className={rampNeedsRequest ? "border-violet-500/40" : undefined}
          >
            {ramp.disabled ? (
              <Lock />
            ) : rampNeedsRequest ? (
              <UserCheck />
            ) : lowersTarget ? (
              <TrendingDown />
            ) : (
              <TrendingUp />
            )}
            {rampNeedsRequest
              ? requestButtonLabel("ramp", status)
              : status === "CREATED"
                ? "Start rollout"
                : lowersTarget
                  ? "Lower target"
                  : "Change target"}
          </Button>
        )}
        {!incident && rollbackButton}
        {/* In an incident a locked Make live is a dead button in a fire: it is left out rather than shown disabled. */}
        {status === "INPROGRESS" && !(incident && conclude.disabled) && (
          <Button
            size={size}
            onClick={() => setDialog("conclude")}
            disabled={conclude.disabled}
            title={conclude.title}
            variant={concludeNeedsRequest || incident ? "outline" : "default"}
            className={concludeNeedsRequest ? "border-violet-500/40" : undefined}
          >
            {conclude.disabled ? <Lock /> : concludeNeedsRequest ? <UserCheck /> : <CheckCircle2 />}
            {concludeNeedsRequest ? requestButtonLabel("conclude") : "Make live"}
          </Button>
        )}
        {emergencyOffered && (
          <Button
            size={size}
            variant="outline"
            onClick={() => setDialog("emergency")}
            disabled={Boolean(emergencyTitle)}
            title={emergencyTitle ?? "Skips approval. Reviewed afterwards by a different checker."}
            className="border-orange-500/60 bg-orange-500/10 text-orange-800 hover:bg-orange-500/20 hover:text-orange-900 dark:text-orange-200 dark:hover:text-orange-100"
          >
            {emergencyTitle ? <Lock /> : <Siren />}
            Emergency rollback
          </Button>
        )}
        {policyOn && (isOngoing || isLive) && !(incident && (notMaker || !permissions.update)) && (
          <Button
            size={size}
            variant="ghost"
            onClick={() => setDialog("marker")}
            disabled={notMaker || !permissions.update}
            title={
              !permissions.update
                ? denied("change the marker of")
                : notMaker
                  ? notMakerHint
                  : "Declare or clear whether moving users off this release is unsafe"
            }
            className="text-muted-foreground"
          >
            {notMaker || !permissions.update ? <Lock /> : <ShieldAlert />}
            {sensitive ? "Change marker" : "Mark rollback-sensitive"}
          </Button>
        )}
        {marker && (isLive || status === "INPROGRESS") && (
          <RollbackSensitiveChip reason={marker} variant="inline" className="ml-1" />
        )}
      </div>
      {marker && (isLive || status === "INPROGRESS") && (
        <SensitiveNotice reason={marker} packageVersion={release.packageVersion} />
      )}
    </div>
  );

  return (
    <>
      {place(buttons)}
      <RampDialog
        open={dialog === "ramp"}
        onOpenChange={(o) => !o && setDialog(null)}
        policyOn={policyOn}
        startAt={rampStart}
        {...dialogProps}
      />
      <ConcludeDialog
        open={dialog === "conclude"}
        onOpenChange={(o) => !o && setDialog(null)}
        policyOn={policyOn}
        flag={flag}
        {...dialogProps}
      />
      <RollbackDialog
        open={dialog === "rollback"}
        onOpenChange={(o) => !o && setDialog(null)}
        mode={rollbackNeedsRequest ? "request" : "direct"}
        {...dialogProps}
        flag={flag}
        otherOngoing={otherOngoing}
        onSetTargetZero={canZero ? setTargetToZero : undefined}
      />
      <MarkerDialog open={dialog === "marker"} onOpenChange={(o) => !o && setDialog(null)} {...dialogProps} />
      <RollbackDialog
        open={dialog === "emergency"}
        onOpenChange={(o) => !o && setDialog(null)}
        mode="emergency"
        {...dialogProps}
        flag={flag}
        otherOngoing={otherOngoing}
        onSetTargetZero={canZero ? setTargetToZero : undefined}
      />
    </>
  );
}

interface DialogProps {
  markerUnknown?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: string;
  app: string;
  platform: Platform | null;
  release: ReleaseSummary;
  liveNow: LiveRelease | undefined;
  otherOngoing?: { release_id: string; package_version: number } | undefined;
  onChanged?: () => void;
  /** Maker-checker is on for this application (server's policy). */
  policyOn?: boolean;
  /** The marker as it gates actions: set only while approval is on. */
  sensitive?: RollbackSensitiveReason | null;
  /** The marker as a fact, whether or not approval is on. Warned about on every downgrade. */
  marker?: RollbackSensitiveReason | null;
  me?: string | null;
  localeExceptions?: LiveRelease[];
  /** Approval is on and the signed-in user is not a maker: they cannot raise a request. */
  notMaker?: boolean;
}

/**
 * Submits either the direct action or a deployment request, and keeps the two outcomes apart:
 * `raised` is a request that now waits for a checker; the action itself has not happened.
 */
function useRequestOrDirect() {
  const approvals = useApprovalActions();
  const [raised, setRaised] = useState<DeploymentRequest | null>(null);
  // Set when a direct call came back 403 approval_required: the dialog then offers request mode.
  const [forceRequest, setForceRequest] = useState(false);
  const reset = () => {
    setRaised(null);
    setForceRequest(false);
  };
  return { approvals, raised, setRaised, forceRequest, setForceRequest, reset };
}

/** Why the server refuses a target above 50%: the two arms of the rollout experiment share traffic equally. */
export const RAMP_CAP_WHY = `A target stops at ${MAX_RAMP_TARGET}% because a rollout splits traffic between the new release and the live one, and the server refuses a larger share. Make live is the step that reaches everyone.`;

// 0 is a valid target: the server accepts a ramp down to nothing, which stops offering the release to anyone.
const PRESETS = [0, 5, 10, 25, 50];

/** A write refused because an earlier upstream outcome is unconfirmed gets the full explanation; anything else stays a plain message. */
function WriteError({
  title,
  error,
  rawError,
  org,
  app,
  release,
  onNavigate,
  what,
}: {
  title: string;
  error: string;
  rawError: unknown;
  org: string;
  app: string;
  release: ReleaseSummary;
  onNavigate: () => void;
  /** The change that was sent, for the CDN failure notice, e.g. "The new target". */
  what?: string;
}) {
  const cache = classifyCacheError(rawError);
  if (cache) return <CacheFailureAfterWrite failure={cache} org={org} app={app} what={what ?? "The change"} />;
  const failure = classifyRollbackError(rawError);
  if (failure?.kind === "unresolved") {
    return (
      <RollbackProblem
        failure={failure}
        {...{ org, app, onNavigate }}
        releaseId={release.releaseId}
        packageVersion={release.packageVersion}
      />
    );
  }
  return <ErrorState title={title} message={error} />;
}

function RampDialog({
  open,
  onOpenChange,
  org,
  app,
  platform,
  release,
  liveNow,
  onChanged,
  policyOn = false,
  sensitive = null,
  marker = null,
  startAt,
  notMaker = false,
}: DialogProps & { startAt?: number }) {
  const actions = useReleaseActions();
  const { approvals, raised, setRaised, forceRequest, setForceRequest, reset } = useRequestOrDirect();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const current = release.trafficPercentage;
  const [target, setTarget] = useState(current);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setTarget(
        startAt !== undefined
          ? startAt
          : Math.min(MAX_RAMP_TARGET, Math.max(current, PRESETS.find((p) => p > current) ?? current))
      );
      setReason("");
      reset();
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clamped = Math.max(0, Math.min(MAX_RAMP_TARGET, Math.round(Number.isFinite(target) ? target : 0)));
  const unchanged = clamped === current;
  const lowering = clamped < current;
  const replaces = liveNow && liveNow.release_id !== release.releaseId ? liveNow.package_version : undefined;
  // The spec's rule: raising adds exposure; lowering is direct unless the release is sensitive.
  const asRequest =
    forceRequest || (policyOn && needsApproval("ramp", release.status, current, clamped, Boolean(sensitive)));
  const approvalFailure: ApprovalFailure | null = rawError
    ? classifyApprovalError(rawError, asRequest ? "raise" : "direct")
    : null;
  // This target needs a request and the person cannot raise one: say so now, and let them pick a lower target.
  const cannotRaise = asRequest && notMaker;

  const submit = async () => {
    if (cannotRaise) return;
    if (asRequest) {
      const req = await run(() =>
        approvals.raise(org, app, {
          action: "ramp",
          payload: { release_id: release.releaseId, body: { traffic_percentage: clamped } },
          reason: reason.trim(),
        })
      );
      if (req) {
        setRaised(req);
        toastSuccess("Request raised", `Target change to ${clamped}% for ${app} · v${release.packageVersion}`);
        onChanged?.();
      }
      return;
    }
    const ok = await run(async () => {
      try {
        await actions.ramp(org, app, release.releaseId, clamped);
      } catch (e) {
        // A CDN failure after the write means the target may be saved: show the server's state.
        if (classifyCacheError(e)) onChanged?.();
        throw e;
      }
      return true;
    });
    if (ok) {
      toastSuccess(`Rollout target set to ${clamped}%`, `${app} · v${release.packageVersion}`);
      onOpenChange(false);
      onChanged?.();
    }
  };

  if (raised) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Target change requested · v{release.packageVersion}</DialogTitle>
            <DialogDescription>
              The target stays at {current}% until a checker approves {clamped}%.
            </DialogDescription>
          </DialogHeader>
          <RequestRaised
            org={org}
            app={app}
            requestId={raised.id}
            expiresAt={raised.expires_at}
            onNavigate={() => onOpenChange(false)}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {asRequest
              ? requestButtonLabel("ramp", release.status)
              : release.status === "CREATED"
                ? "Start rollout"
                : "Change rollout target"}{" "}
            · v{release.packageVersion}
          </DialogTitle>
          <DialogDescription>
            The target is the share of traffic served v{release.packageVersion}. It is not a measure of adoption.
            {asRequest && " Nothing changes until a different checker approves."}
          </DialogDescription>
        </DialogHeader>

        <Facts
          rows={[
            { label: "Platform", value: platformApp(platform, app) },
            { label: "Rolling out", value: <PkgLine version={release.packageVersion} /> },
            {
              label: "Live today",
              value: <PkgLine version={replaces} note={replaces ? "stays live for the rest" : undefined} />,
            },
            { label: "Reach", value: <Reach dimensions={release.dimensions} compact /> },
          ]}
        />

        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <Label htmlFor="cc-target">New target</Label>
            <span className="text-xs text-muted-foreground">
              now {current}% · 0 to {MAX_RAMP_TARGET}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Slider
              value={[clamped]}
              min={0}
              max={MAX_RAMP_TARGET}
              step={1}
              onValueChange={(v) => setTarget(v[0] ?? 0)}
              aria-label="Rollout target"
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              <Input
                id="cc-target"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_RAMP_TARGET}
                value={clamped}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="h-8 w-16 text-right font-mono"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={clamped === p ? "secondary" : "outline"}
                className="h-7 px-2 font-mono text-xs"
                onClick={() => setTarget(p)}
              >
                {p}%
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {lowering
              ? `Lowering from ${current}% to ${clamped}%. Devices that fall outside the new target are offered ${replaces !== undefined ? `v${replaces}` : "the live package"} on their next update check, so this can move a device from v${release.packageVersion} back to ${replaces !== undefined ? `v${replaces}` : "it"}. Whether an installed app applies that downgrade depends on its SDK and local state.`
              : unchanged
                ? `The target is ${current}%. To reach 100%, make the release live when you are ready.`
                : `Raising from ${current}% to ${clamped}%. To reach 100%, make the release live when you are ready.`}
          </p>
          {!lowering && <p className="text-xs text-muted-foreground">{RAMP_CAP_WHY}</p>}
          {lowering && marker && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-800 dark:text-red-200"
            >
              v{release.packageVersion} is marked rollback-sensitive ({sensitivityLabel(marker)}): moving devices off it{" "}
              {sensitivityConsequence(marker)}.
            </p>
          )}
          {policyOn && !asRequest && !unchanged && (
            <p className="text-xs text-muted-foreground">
              Lowering reduces exposure, so it is applied directly without approval.
            </p>
          )}
        </div>

        {cannotRaise && (
          <p
            role="alert"
            className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-200"
          >
            This target needs a request, and you are not a maker for {app}, so you cannot raise one. Pick a lower target
            than {current}% (that is applied directly), or ask a maker.
          </p>
        )}
        {asRequest && (
          <>
            <WhyRequest action="ramp" sensitive={sensitive} lowering={lowering} />
            <ReasonField
              id="cc-ramp-reason"
              value={reason}
              onChange={setReason}
              disabled={pending}
              label="Reason (required, shown to the checker)"
              placeholder="e.g. crash-free for 24h at 10%, widening to 25% per the rollout plan"
            />
          </>
        )}

        {error &&
          (approvalFailure && approvalFailure.kind !== "other" ? (
            <ApprovalProblem
              failure={approvalFailure}
              {...{ org, app }}
              releaseId={release.releaseId}
              packageVersion={release.packageVersion}
              action="target change"
              onNavigate={() => onOpenChange(false)}
              onRaiseInstead={
                approvalFailure.kind === "approval_required"
                  ? () => {
                      clearError();
                      setForceRequest(true);
                    }
                  : undefined
              }
            />
          ) : (
            <WriteError
              title={asRequest ? "Could not raise the request" : "Could not set target"}
              {...{ error, rawError, org, app, release }}
              what={`The ${clamped}% target`}
              onNavigate={() => onOpenChange(false)}
            />
          ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || unchanged || cannotRaise || (asRequest && reason.trim().length === 0)}
          >
            {pending
              ? asRequest
                ? "Raising request…"
                : "Applying…"
              : asRequest
                ? `Request target change to ${clamped}%`
                : `Set target to ${clamped}%`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConcludeDialog({
  open,
  onOpenChange,
  org,
  app,
  platform,
  release,
  liveNow,
  onChanged,
  policyOn = false,
  sensitive = null,
  localeExceptions = [],
  flag,
}: DialogProps & { flag?: ReleaseFlag }) {
  const actions = useReleaseActions();
  const { approvals, raised, setRaised, forceRequest, setForceRequest, reset } = useRequestOrDirect();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const [reason, setReason] = useState("");
  const [acceptFlag, setAcceptFlag] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("");
      setAcceptFlag(false);
      reset();
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const replaces = liveNow && liveNow.release_id !== release.releaseId ? liveNow.package_version : undefined;

  const variant = release.experimentalVariant;
  const asRequest = forceRequest || policyOn;
  // A flag never blocks Make live. It makes the person read the failure rate before sending this to everyone.
  const flagged = flag?.row && (flag.status === "seems_bad" || flag.status === "suspicious_reports");
  const needsFlagAck = Boolean(flagged) && !acceptFlag;
  // After a direct conclude whose CDN step failed, the page re-reads the release as concluded while this dialog stays
  // open with its cache notice. A second click would conclude a concluded release and contradict that notice.
  const alreadyConcluded = !asRequest && release.status !== "INPROGRESS";
  const approvalFailure: ApprovalFailure | null = rawError
    ? classifyApprovalError(rawError, asRequest ? "raise" : "direct")
    : null;

  const submit = async () => {
    if (!variant) return;
    if (asRequest) {
      const req = await run(() =>
        approvals.raise(org, app, {
          action: "conclude",
          payload: { release_id: release.releaseId, body: { chosen_variant: variant } },
          reason: reason.trim(),
        })
      );
      if (req) {
        setRaised(req);
        toastSuccess("Request raised", `Make live v${release.packageVersion} · ${app}`);
        onChanged?.();
      }
      return;
    }
    const ok = await run(async () => {
      try {
        await actions.conclude(org, app, release.releaseId, variant);
      } catch (e) {
        if (classifyCacheError(e)) onChanged?.();
        throw e;
      }
      return true;
    });
    if (ok) {
      toastSuccess(`v${release.packageVersion} is live`, platformApp(platform, app));
      onOpenChange(false);
      onChanged?.();
    }
  };

  if (raised) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make live requested · v{release.packageVersion}</DialogTitle>
            <DialogDescription>
              v{release.packageVersion} stays at its {release.trafficPercentage}% target until a checker approves.
            </DialogDescription>
          </DialogHeader>
          <RequestRaised
            org={org}
            app={app}
            requestId={raised.id}
            expiresAt={raised.expires_at}
            onNavigate={() => onOpenChange(false)}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {asRequest ? `Request make live · v${release.packageVersion}` : `Make v${release.packageVersion} live`}
          </DialogTitle>
          <DialogDescription>
            The rollout target becomes 100% and the release concludes. This cannot be re-ramped; to go back afterwards
            you roll back, which re-releases the previous package.
            {asRequest && " Nothing changes until a different checker approves."}
          </DialogDescription>
        </DialogHeader>
        <Facts
          rows={[
            { label: "Platform", value: platformApp(platform, app) },
            {
              label: "Becomes live",
              value: <PkgLine version={release.packageVersion} note={`from a ${release.trafficPercentage}% target`} />,
            },
            {
              label: "Replaces",
              value: <PkgLine version={replaces} note={replaces ? "no longer served" : undefined} />,
            },
            { label: "Reach", value: <Reach dimensions={release.dimensions} compact /> },
          ]}
        />
        {flag && flagged && (
          <FlagAcknowledge
            flag={flag}
            packageVersion={release.packageVersion}
            consequence="Making it live sends it to everyone in reach."
            checked={acceptFlag}
            onCheckedChange={setAcceptFlag}
            disabled={pending}
            ariaLabel="Make this release live despite the flag"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Devices pick up v{release.packageVersion} on their next update check. How many did is on the release page,
          from unverified device reports.
        </p>
        <LocaleExceptionsNotice org={org} app={app} exceptions={localeExceptions} dense />
        {asRequest && (
          <>
            <WhyRequest action="conclude" sensitive={sensitive} />
            <ReasonField
              id="cc-conclude-reason"
              value={reason}
              onChange={setReason}
              disabled={pending}
              label="Reason (required, shown to the checker)"
              placeholder="e.g. 50% for 48h with no regression in crash rate or payment success"
            />
          </>
        )}
        {!variant && (
          <ErrorState
            title="Cannot make this release live"
            message="The server did not report which variant to choose for this release, and guessing could conclude the wrong one. Reload the page; if this persists, open the full release page."
          />
        )}
        {error &&
          (approvalFailure && approvalFailure.kind !== "other" ? (
            <ApprovalProblem
              failure={approvalFailure}
              {...{ org, app }}
              releaseId={release.releaseId}
              packageVersion={release.packageVersion}
              action="make live"
              onNavigate={() => onOpenChange(false)}
              onRaiseInstead={
                approvalFailure.kind === "approval_required"
                  ? () => {
                      clearError();
                      setForceRequest(true);
                    }
                  : undefined
              }
            />
          ) : (
            <WriteError
              title={asRequest ? "Could not raise the request" : "Could not conclude release"}
              {...{ error, rawError, org, app, release }}
              what="Make live"
              onNavigate={() => onOpenChange(false)}
            />
          ))}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending || !variant || needsFlagAck || alreadyConcluded || (asRequest && reason.trim().length === 0)
            }
            variant={flagged ? "outline" : "default"}
          >
            {alreadyConcluded
              ? "Already concluded"
              : pending
                ? asRequest
                  ? "Raising request…"
                  : "Concluding…"
                : asRequest
                  ? `Request make live v${release.packageVersion}`
                  : `Make v${release.packageVersion} live`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Raises a request to set or clear the rollback-sensitive marker. Both directions need approval. */
function MarkerDialog({ open, onOpenChange, org, app, platform, release, onChanged, sensitive = null }: DialogProps) {
  const { approvals, raised, setRaised, reset } = useRequestOrDirect();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const [next, setNext] = useState<RollbackSensitiveReason | null>(sensitive);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setNext(sensitive);
      setReason("");
      reset();
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unchanged = next === sensitive;
  const clearing = sensitive !== null && next === null;
  const approvalFailure: ApprovalFailure | null = rawError ? classifyApprovalError(rawError, "raise") : null;
  const label = (m: RollbackSensitiveReason | null) => (m ? sensitivityLabel(m) : "not marked");

  const submit = async () => {
    const req = await run(() =>
      approvals.raise(org, app, {
        action: "set_rollback_sensitive",
        payload: { release_id: release.releaseId, body: { rollback_sensitive: next } },
        reason: reason.trim(),
      })
    );
    if (req) {
      setRaised(req);
      toastSuccess("Request raised", `Marker change for v${release.packageVersion} · ${app}`);
      onChanged?.();
    }
  };

  if (raised) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marker change requested · v{release.packageVersion}</DialogTitle>
            <DialogDescription>The marker stays {label(sensitive)} until a checker approves.</DialogDescription>
          </DialogHeader>
          <RequestRaised
            org={org}
            app={app}
            requestId={raised.id}
            expiresAt={raised.expires_at}
            onNavigate={() => onOpenChange(false)}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request marker change · v{release.packageVersion}</DialogTitle>
          <DialogDescription>
            The marker changes what approvals protect, so setting or clearing it is a request too. Nothing changes until
            a different checker approves.
          </DialogDescription>
        </DialogHeader>
        <Facts
          rows={[
            { label: "Platform", value: platformApp(platform, app) },
            { label: "Release", value: <PkgLine version={release.packageVersion} /> },
            { label: "Marker now", value: label(sensitive) },
            { label: "Marker after", value: label(next) },
          ]}
        />
        <RollbackMarkerSelect value={next} onChange={setNext} disabled={pending} idPrefix="cc-marker-dialog" />
        {clearing && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
            Clearing the marker removes the protection: lowering the target or rolling back v{release.packageVersion}{" "}
            becomes a direct action again once this is approved.
          </p>
        )}
        <ReasonField
          id="cc-marker-reason"
          value={reason}
          onChange={setReason}
          disabled={pending}
          label="Reason (required, shown to the checker)"
          placeholder="e.g. v5 patches CVE-2026-1234; older builds must not come back"
        />
        {error &&
          (approvalFailure && approvalFailure.kind !== "other" ? (
            <ApprovalProblem
              failure={approvalFailure}
              {...{ org, app }}
              releaseId={release.releaseId}
              packageVersion={release.packageVersion}
              action="marker change"
              onNavigate={() => onOpenChange(false)}
            />
          ) : (
            <WriteError
              title="Could not raise the request"
              {...{ error, rawError, org, app, release }}
              onNavigate={() => onOpenChange(false)}
            />
          ))}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || unchanged || reason.trim().length === 0}>
            {pending ? "Raising request…" : "Request marker change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The way out of a refused rollback, so the dialog never ends in a lone Close. Each is a real next step the
 * person can take; none of them acts on its own.
 */
function BlockedExits({
  failure,
  org,
  app,
  releaseId,
  onClose,
  onReload,
  onSetTargetZero,
}: {
  failure: ReturnType<typeof classifyRollbackError>;
  org: string;
  app: string;
  releaseId: string;
  onClose: () => void;
  onReload?: () => void;
  onSetTargetZero?: () => void;
}) {
  if (!failure) return null;
  const open = (label: string, id: string) => (
    <Button asChild>
      <Link href={releasePath(org, app, id)} onClick={onClose}>
        {label}
      </Link>
    </Button>
  );
  const publish = (
    <Button asChild>
      <Link href={classicNewReleasePath(org, app)} onClick={onClose}>
        Publish replacement release
      </Link>
    </Button>
  );
  const zero = onSetTargetZero && (
    <Button variant="outline" onClick={onSetTargetZero}>
      Set target to 0%
    </Button>
  );
  const reload = (
    <Button
      onClick={() => {
        onReload?.();
        onClose();
      }}
    >
      Reload release
    </Button>
  );
  if (failure.kind === "replacement_changed") {
    return failure.replacementReleaseId && failure.replacementReleaseId !== releaseId
      ? open("Open the replacement", failure.replacementReleaseId)
      : reload;
  }
  if (failure.kind !== "blocked") return null;
  switch (failure.code) {
    case "superseded":
      return failure.currentLiveReleaseId ? (
        open("Open the live release", failure.currentLiveReleaseId)
      ) : (
        <Button asChild>
          <Link href={appPath(org, app)} onClick={onClose}>
            Open the app to find the live release
          </Link>
        </Button>
      );
    case "ongoing":
      return failure.currentLiveReleaseId ? (
        open("Open the ongoing release", failure.currentLiveReleaseId)
      ) : (
        <Button asChild>
          <Link href={appPath(org, app)} onClick={onClose}>
            Open the app to find the ongoing release
          </Link>
        </Button>
      );
    default:
      return failure.finished ? (
        reload
      ) : (
        <>
          {zero}
          {publish}
        </>
      );
  }
}

/**
 * What a finished rollback did, kept in three separate facts: what the server serves now, whether any device has
 * confirmed it, and (for an emergency rollback) that it still needs a second person. Server change is not recovery.
 */
function RollbackOutcome({
  served,
  emergency,
  reportsHref,
  onNavigate,
}: {
  served: number | null;
  emergency: boolean;
  /** The release page that carries the device reports, or null for this page. */
  reportsHref: string | null;
  onNavigate: () => void;
}) {
  return (
    <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
      <p className="font-medium">{serverNowServes(served)}</p>
      <p>
        <span className="font-medium">{DEVICE_BOOT_UNCONFIRMED}</span>{" "}
        <span className="text-muted-foreground">
          Airborne has not seen a device confirm it yet; devices pick it up on their next update check.
        </span>{" "}
        <Link href={reportsHref ?? "#device-reports"} className="underline" onClick={onNavigate}>
          See device reports
        </Link>
      </p>
      {emergency && (
        <p className="border-t pt-2">
          <span className="font-medium text-orange-800 dark:text-orange-200">Needs review.</span>{" "}
          <span className="text-muted-foreground">
            This rollback skipped approval. A checker other than you must acknowledge it from the release page or the
            approval queue; until then it stays flagged there.
          </span>
        </p>
      )}
    </div>
  );
}

function RollbackDialog({
  open,
  onOpenChange,
  org,
  app,
  platform,
  release,
  liveNow,
  otherOngoing,
  onChanged,
  mode = "direct",
  markerUnknown = false,
  sensitive = null,
  marker = null,
  onSetTargetZero,
  flag,
}: DialogProps & { mode: SubmitMode; onSetTargetZero?: () => void; flag?: ReleaseFlag }) {
  const actions = useReleaseActions();
  const { approvals, raised, setRaised, forceRequest, setForceRequest, reset } = useRequestOrDirect();
  const { pending, rawError, run, clearError } = useAsyncAction();
  const { state: previewState, reload } = useRollbackPreview(open, org, app, release.releaseId);
  const [reason, setReason] = useState("");
  const [confirmRisk, setConfirmRisk] = useState(false);
  const [result, setResult] = useState<RollbackResponse | null>(null);

  useEffect(() => {
    if (open) {
      // A flagged release already says why: start from that, and let the person change it.
      setReason(flag ? reasonFromFlag(flag) : "");
      setConfirmRisk(false);
      setResult(null);
      reset();
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const status = release.status;
  const isLive = status === "CONCLUDED";
  const stays = liveNow && liveNow.release_id !== release.releaseId ? liveNow.package_version : undefined;
  const asRequest = mode === "request" || forceRequest;
  const emergency = mode === "emergency" && !forceRequest;
  const riskRequiresAcceptance = requiresEmergencyRiskAcceptance(markerUnknown ? undefined : sensitive);

  const preview = previewState.status === "ready" ? previewState.preview : null;
  // The preview's own "blocked" and a refused POST are explained by the same component.
  const previewFailure = failureFromBlocked(preview?.blocked, preview?.action ?? null, preview?.rollback_of);
  // A CDN failure after the rollback ran: the rollback is recorded, only the cache is stale.
  const cacheFailure = classifyCacheError(rawError);
  // Approval refusals (403 approval_required, maker checks) are explained in their own shape.
  const approvalFailure: ApprovalFailure | null = rawError
    ? classifyApprovalError(rawError, asRequest ? "raise" : "direct")
    : null;
  const approvalRefused = Boolean(
    approvalFailure && approvalFailure.kind !== "other" && approvalFailure.kind !== "unresolved"
  );
  const postFailure = approvalRefused || cacheFailure ? null : classifyRollbackError(rawError);
  const failure = postFailure ?? previewFailure;
  // Only a successful rollback records a review. Partial/unknown attempts can be resumed.
  const emergencyBlocked = emergency && isEmergencyReviewPending(rawError);
  const emergencyRecorded = emergency && cacheFailure !== null;
  const emergencyLocked = emergencyBlocked || emergencyRecorded;
  // After a refused POST there is nothing to retry; a blocked preview keeps the button, disabled.
  const noRetry = isTerminalFailure(postFailure);
  const shownFailure =
    failure?.kind === "blocked" && failure.code === "ongoing" && !failure.currentLiveReleaseId && otherOngoing
      ? { ...failure, currentLiveReleaseId: otherOngoing.release_id }
      : failure;

  // What will happen comes from the server's preview; before it arrives only the status is known.
  const action = preview?.action ?? null;
  const discarding = action ? action === "discarded" : status === "CREATED";
  const verb = discarding ? "Discard" : "Roll back";

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    if (asRequest) {
      const req = await run(() =>
        approvals.raise(org, app, {
          action: "rollback",
          payload: { release_id: release.releaseId, body: {} },
          reason: trimmed,
        })
      );
      if (req) {
        setRaised(req);
        toastSuccess("Rollback requested", `v${release.packageVersion} · ${app}`);
        onChanged?.();
      }
      return;
    }
    const res = await run(async () => {
      try {
        return await actions.rollback(
          org,
          app,
          release.releaseId,
          trimmed,
          emergency
            ? { emergency: true, ...(riskRequiresAcceptance ? { confirm_sensitive_risk: true } : {}) }
            : undefined
        );
      } catch (e) {
        // A refusal or a partial failure means the server's state differs from what is shown: refresh.
        if (classifyRollbackError(e)?.kind !== "other") onChanged?.();
        throw e;
      }
    });
    if (res) {
      // No toast: the dialog stays open and carries the result, and on a narrow screen a toast covers its title.
      setResult(res);
      onChanged?.();
    }
  };

  const reconciled = result?.reconciled_keys;
  const hasReconciled = Boolean(reconciled && (reconciled.kept_current.length > 0 || reconciled.dropped.length > 0));
  // Present only when the server returned the record of an earlier, completed rollback.
  const recorded = result !== null && result.current_live_release_id !== undefined;

  const previewKeys = preview?.reconciled_keys ?? null;
  const previewReconciles = Boolean(
    previewKeys && (previewKeys.kept_current.length > 0 || previewKeys.dropped.length > 0)
  );
  const resulting = preview?.resulting_package_version ?? null;
  // Security exclusions apply on devices, not in what the server serves: a restored package may be refused.
  const exclusions = preview?.blocked_package_versions;
  const resultExcluded = isExcluded(exclusions, resulting);
  const doneExcluded = isExcluded(exclusions, result?.rolled_back_to_package_version ?? null);

  // Why confirm is not available, stated next to the button.
  const blockedReason: string | null =
    previewState.status === "loading"
      ? "Confirm is disabled until the rollback preview has loaded."
      : previewState.status === "error"
        ? "Confirm is disabled because the preview could not be loaded. Nothing has been changed."
        : previewFailure
          ? "Confirm is disabled: the server reports that this rollback is blocked (see above)."
          : null;
  const needsReason = !blockedReason && reason.trim().length === 0;
  const needsRiskConfirmation = emergency && riskRequiresAcceptance && !confirmRisk;

  const title = result
    ? recorded
      ? `Already rolled back v${release.packageVersion}`
      : result.action === "discarded"
        ? `Discarded v${release.packageVersion}`
        : `Server now serves v${result.rolled_back_to_package_version ?? "unknown"}`
    : postFailure?.kind === "partial"
      ? `Rollback of v${release.packageVersion} did not finish`
      : asRequest
        ? `Request rollback of v${release.packageVersion}`
        : emergency
          ? `Emergency rollback of v${release.packageVersion}`
          : `${verb} v${release.packageVersion}`;

  // Who ends up on what: the preview names the package; before it loads the live release is the best guess.
  const returnsTo = resulting ?? stays ?? null;
  const restoredVersion = result?.rolled_back_to_package_version ?? null;

  const description = result
    ? recorded
      ? "This rollback had already completed. The server returned its recorded result; nothing was run again."
      : result.action === "discarded"
        ? "The release was discarded before it started. Nothing changed for devices."
        : emergency
          ? "Applied without approval. It stays flagged until a different checker acknowledges it."
          : "Applied and recorded in the timeline."
    : postFailure?.kind === "partial"
      ? "The rollback stopped part-way. It is not complete."
      : previewState.status === "loading"
        ? "Asking the server exactly what this rollback will do…"
        : previewFailure
          ? "This rollback is blocked. Inspect the details below before continuing."
          : previewState.status === "error"
            ? "The preview is what tells you the resulting package, so nothing can be confirmed without it."
            : asRequest
              ? rollbackRequestBody(action, returnsTo)
              : action === null
                ? "This rollback is blocked. Inspect the details below before continuing."
                : emergency
                  ? `Restore ${returnsTo === null ? "the previous package" : `v${returnsTo}`}. Devices receive it on their next update check; boot remains unconfirmed.`
                  : `${rollbackHeadline(action, returnsTo)} ${rollbackDirectBody(action, release.packageVersion, returnsTo)}`.trim();

  const resultRow =
    previewState.status === "loading" ? (
      <Skeleton className="h-5 w-40" aria-label="Loading" />
    ) : previewState.status === "error" ? (
      <span className="text-muted-foreground">unknown: the preview did not load</span>
    ) : resulting === 0 ? (
      <span>Bundled code returns to 100%</span>
    ) : resulting !== null ? (
      <PkgLine
        version={resulting}
        note={
          previewFailure
            ? "would be restored, but this rollback is blocked"
            : action === "rereleased"
              ? "re-released as a new release"
              : action === "concluded_control"
                ? "returns to 100%"
                : "stays live, unchanged"
        }
      />
    ) : action === "discarded" || action === "concluded_control" ? (
      <PkgLine
        version={stays}
        note={
          stays
            ? action === "discarded"
              ? "stays live, unchanged"
              : "returns to 100%"
            : "nothing live for this reach; devices keep what they have"
        }
      />
    ) : (
      <span className="text-muted-foreground">not available: this rollback is blocked</span>
    );

  if (raised) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rollback requested · v{release.packageVersion}</DialogTitle>
            <DialogDescription>v{release.packageVersion} stays as it is until a checker approves.</DialogDescription>
          </DialogHeader>
          <RequestRaised
            org={org}
            app={app}
            requestId={raised.id}
            expiresAt={raised.expires_at}
            onNavigate={() => onOpenChange(false)}
          />
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent
        className={cn(
          "w-[calc(100%-2rem)] max-h-[92vh] overflow-y-auto sm:w-full sm:max-w-lg [&_[data-slot=dialog-footer]]:sticky [&_[data-slot=dialog-footer]]:bottom-[-1.5rem] [&_[data-slot=dialog-footer]]:bg-background [&_[data-slot=dialog-footer]]:py-3",
          emergency && !result && "border-orange-500/60 ring-4 ring-orange-500/15"
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn("flex items-center gap-2", emergency && !result && "text-orange-800 dark:text-orange-200")}
          >
            {emergency && <Siren className="h-5 w-5" aria-hidden />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {emergency && !result && <EmergencyExplainer />}

        {result ? (
          <div className="space-y-3">
            {result.action !== "discarded" && !recorded && (
              <RollbackOutcome
                served={restoredVersion}
                emergency={emergency}
                reportsHref={
                  result.new_release_id ? `${releasePath(org, app, result.new_release_id)}#device-reports` : null
                }
                onNavigate={() => onOpenChange(false)}
              />
            )}
            <Facts
              rows={[
                {
                  label: "What happened",
                  value: <span className="text-sm">{rollbackActionLabel(result.action)}</span>,
                },
                {
                  label: result.later_release_id ? "Restored to" : "Live now",
                  value: <PkgLine version={result.rolled_back_to_package_version ?? undefined} />,
                },
                ...(result.new_release_id
                  ? [
                      {
                        label: "New release",
                        value: (
                          <Link
                            href={releasePath(org, app, result.new_release_id)}
                            className="underline"
                            title={`release ${result.new_release_id}`}
                            onClick={() => onOpenChange(false)}
                          >
                            Open the new release
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(result.later_release_id
                  ? [
                      {
                        label: "Later release",
                        value: (
                          <Link
                            href={releasePath(org, app, result.later_release_id)}
                            className="underline"
                            title={`release ${result.later_release_id}`}
                            onClick={() => onOpenChange(false)}
                          >
                            Open the later release
                          </Link>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {result.later_release_id && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                <strong>A later release is live now.</strong> It is unrelated to this rollback and was not touched. This
                rollback&apos;s recorded result is unchanged, and no new rollback was started. Act on the later release
                if you need to change what is served.
              </p>
            )}
            {hasReconciled && reconciled && (
              <ReconciledNotice keys={reconciled} resultingVersion={result.rolled_back_to_package_version} done />
            )}
            {doneExcluded && result.rolled_back_to_package_version != null && (
              <ExcludedPackageNotice version={result.rolled_back_to_package_version} phase="done" />
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Facts
              rows={[
                { label: "Platform", value: platformApp(platform, app) },
                {
                  label: isLive ? "Live now" : "Current",
                  value: (
                    <PkgLine
                      version={preview?.current_package_version ?? release.packageVersion}
                      note={
                        status === "INPROGRESS"
                          ? `at a ${release.trafficPercentage}% target`
                          : isLive
                            ? previewFailure
                              ? "stays live: rollback blocked"
                              : "will be replaced"
                            : "not started"
                      }
                    />
                  ),
                },
                { label: "Result", value: resultRow },
                { label: "Reach", value: <Reach dimensions={release.dimensions} compact /> },
              ]}
            />

            {previewState.status === "loading" && (
              <p role="status" aria-busy className="text-xs text-muted-foreground">
                Loading the rollback preview from the server. Nothing is changed by looking.
              </p>
            )}
            {previewState.status === "error" && (
              <ErrorState
                title="Could not load the rollback preview"
                message={previewState.error.message}
                onRetry={reload}
              />
            )}

            {preview && !previewFailure && action === "rereleased" && resulting !== null && (
              <>
                {resultExcluded && <ExcludedPackageNotice version={resulting} phase="preview" />}
                {exclusions === null && <ExclusionsUnknownNotice />}
              </>
            )}

            {preview &&
              !previewFailure &&
              action === "rereleased" &&
              previewKeys &&
              (previewReconciles ? (
                <ReconciledNotice keys={previewKeys} resultingVersion={resulting} />
              ) : (
                <p className="rounded-md border p-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">No config keys change.</strong> Every key registered today has a
                  value in the earlier release, and none registered then has been removed. Airborne has still not tested
                  v{resulting ?? "the earlier package"} against today&apos;s server config.
                </p>
              ))}

            {cacheFailure && <CacheFailureAfterWrite failure={cacheFailure} org={org} app={app} what="The rollback" />}
            {failure && (
              <RollbackProblem
                failure={shownFailure ?? failure}
                {...{ org, app }}
                releaseId={release.releaseId}
                packageVersion={release.packageVersion}
                onNavigate={() => onOpenChange(false)}
                onCheckAgain={
                  failure.kind === "unresolved" ||
                  (failure.kind === "blocked" && failure.code === "artifact_verification_unknown")
                    ? () => {
                        clearError();
                        reload();
                      }
                    : undefined
                }
                checkingAgain={previewState.status === "loading"}
              />
            )}
            {emergencyLocked && (
              <ApprovalNotice
                title={
                  emergencyBlocked
                    ? "An earlier emergency rollback still needs review"
                    : "This emergency rollback may already be recorded"
                }
                tone="emergency"
                icon={Siren}
                role="alert"
              >
                <p className="text-muted-foreground">
                  {emergencyBlocked
                    ? "The server refuses a new emergency rollback until a different checker acknowledges the earlier one. Nothing was run by this attempt."
                    : "The rollback completed and its review was recorded; cache invalidation failed. A different checker must acknowledge the review before another emergency rollback."}{" "}
                  Ask another checker to acknowledge it from the approval queue or this release page, or use a normal
                  rollback request. Reload to see where things stand.
                </p>
                <Link
                  href={APPROVALS_PATH}
                  className="text-xs font-medium underline"
                  onClick={() => onOpenChange(false)}
                >
                  Open the approval queue
                </Link>
              </ApprovalNotice>
            )}
            {approvalRefused && approvalFailure && (
              <ApprovalProblem
                failure={approvalFailure}
                {...{ org, app }}
                releaseId={release.releaseId}
                packageVersion={release.packageVersion}
                action="rollback"
                onNavigate={() => onOpenChange(false)}
                onRaiseInstead={
                  approvalFailure.kind === "approval_required"
                    ? () => {
                        clearError();
                        setForceRequest(true);
                      }
                    : undefined
                }
              />
            )}

            {asRequest && <WhyRequest action="rollback" sensitive={sensitive} />}
            {marker && !asRequest && !result && (
              <SensitiveNotice reason={marker} packageVersion={release.packageVersion} />
            )}

            {!previewFailure && (
              <div className="space-y-1.5">
                <Label htmlFor="cc-rollback-reason">
                  {asRequest
                    ? "Reason (required, shown to the checker)"
                    : emergency
                      ? "Reason (required, recorded as an emergency in the timeline)"
                      : "Reason (required, recorded in the timeline)"}
                </Label>
                <Textarea
                  id="cc-rollback-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={reasonPlaceholder(platform, emergency)}
                  rows={3}
                  autoFocus
                  disabled={pending}
                />
                {flag && (
                  <p className="text-xs text-muted-foreground">
                    Started from the flag on this release. Edit it, or say more.
                  </p>
                )}
              </div>
            )}

            {emergency && riskRequiresAcceptance && (
              <label className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-2 text-sm">
                <Checkbox
                  checked={confirmRisk}
                  onCheckedChange={(v) => setConfirmRisk(v === true)}
                  disabled={pending}
                  aria-label="Confirm the risk of rolling back a rollback-sensitive release"
                  className="mt-0.5"
                />
                <span>
                  {sensitive ? (
                    <>
                      I understand v{release.packageVersion} is marked <strong>{sensitivityLabel(sensitive)}</strong>{" "}
                      and rolling it back {sensitivityConsequence(sensitive)}. I accept that risk.
                    </>
                  ) : (
                    <>
                      The rollback-sensitive marker was not reported. Moving users off this release may be unsafe. I
                      accept that unknown risk.
                    </>
                  )}
                </span>
              </label>
            )}

            {!noRetry &&
              !previewFailure &&
              !emergencyLocked &&
              (blockedReason || needsReason || needsRiskConfirmation) && (
                <p role="status" className="text-xs text-muted-foreground">
                  {blockedReason ??
                    (needsReason
                      ? "Confirm is disabled until you give a reason."
                      : "Confirm is disabled until you confirm the risk above.")}
                </p>
              )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                {noRetry || previewFailure ? "Close" : "Cancel"}
              </Button>
              {emergencyLocked && !noRetry && !previewFailure && (
                <Button variant="outline" onClick={() => onChanged?.()}>
                  Reload
                </Button>
              )}
              {(noRetry || previewFailure) && (
                <BlockedExits
                  failure={shownFailure}
                  org={org}
                  app={app}
                  releaseId={release.releaseId}
                  onClose={() => onOpenChange(false)}
                  onReload={onChanged}
                  onSetTargetZero={
                    onSetTargetZero
                      ? () => {
                          onOpenChange(false);
                          onSetTargetZero();
                        }
                      : undefined
                  }
                />
              )}
              {!noRetry && !previewFailure && !emergencyLocked && (
                <Button
                  variant={asRequest ? "default" : "destructive"}
                  onClick={submit}
                  disabled={pending || Boolean(blockedReason) || reason.trim().length === 0 || needsRiskConfirmation}
                  className={cn(
                    emergency &&
                      "bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:text-black dark:hover:bg-orange-400"
                  )}
                >
                  {pending
                    ? asRequest
                      ? "Raising request…"
                      : "Rolling back…"
                    : postFailure?.kind === "partial" || postFailure?.kind === "unknown"
                      ? "Retry rollback"
                      : asRequest
                        ? `Request rollback of v${release.packageVersion}`
                        : emergency
                          ? `Emergency rollback v${release.packageVersion} now`
                          : `${verb} v${release.packageVersion}`}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
