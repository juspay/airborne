"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Search,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toastSuccess } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { platformApp, servingState, type ServingState } from "@/lib/control-center/format";
import { useApprovalActions, useAsyncAction, useServingActions } from "@/lib/control-center/hooks";
import { classifyApprovalError, isMaker, type ApprovalFailure } from "@/lib/control-center/approval";
import { classifyCacheError } from "@/lib/control-center/rollback-error";
import type {
  ApprovalPolicy,
  DeploymentRequest,
  LiveRelease,
  Platform,
  ServingPolicy,
  ServingPreview,
} from "@/lib/control-center/types";
import { ApprovalProblem, RequestRaised } from "./approval-notices";
import { CacheFailureAfterWrite } from "./cache-notice";
import { Pkg } from "./version";
import { ErrorState } from "./states";
import { StateChip, TONE_TEXT } from "./status-badge";
import { describeContext } from "@/lib/control-center/format";

// ---------------------------------------------------------------------------
// Words. One short label per state, and one sentence that says what devices get.
// ---------------------------------------------------------------------------

const LABEL: Record<ServingState, string> = {
  strict: "Strict serving",
  forced: "Strict serving · forced",
  fallback: "Strict serving off",
};

/** The state as the first word of a sentence, where the chip is already in the page title. */
const STATE_WORD: Record<ServingState, string> = {
  strict: "On",
  forced: "Forced on by the deployment",
  fallback: "Off",
};

/** What a device with no release targeted at its version receives. */
export function servingExplanation(state: ServingState): string {
  switch (state) {
    case "strict":
      return "Devices get only releases targeted at their version. A device with no targeted release gets no update and keeps the code it shipped with.";
    case "forced":
      return "Devices get only releases targeted at their version, and the server's STRICT_RELEASE_APPLICATIONS setting keeps it that way: it cannot be turned off from here.";
    case "fallback":
      return "A device with no release targeted at its version is served the untargeted default release. A new binary can therefore receive JavaScript built for an older one.";
  }
}

export function ServingChip({
  policy,
  variant,
  className,
  href,
}: {
  policy: ServingPolicy | undefined;
  variant?: "badge" | "inline";
  className?: string;
  /** When set, the chip links to the app page where the policy is explained and changed. */
  href?: string;
}) {
  const state = servingState(policy);
  if (!state) return null;
  const chip = (
    <StateChip
      tone={state === "fallback" ? "muted" : "strict"}
      icon={state === "fallback" ? ShieldOff : ShieldCheck}
      variant={variant}
      className={className}
      title={servingExplanation(state)}
    >
      {LABEL[state]}
    </StateChip>
  );
  return href ? (
    <Link href={href} className="hover:underline">
      {chip}
    </Link>
  ) : (
    chip
  );
}

// ---------------------------------------------------------------------------
// Preview: one device's answer. Never a population estimate.
// ---------------------------------------------------------------------------

function parseExtra(text: string): { context: Record<string, string>; error: string | null } {
  const context: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) return { context, error: `"${line}" is not key=value` };
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key || !value) return { context, error: `"${line}" is not key=value` };
    context[key] = value;
  }
  return { context, error: null };
}

export interface PreviewRun {
  id: number;
  context: Record<string, string>;
  toss: string;
  result: ServingPreview;
}

/**
 * The three answers a preview can give, in the operator's words. `today` is what the device gets under the
 * policy in force; `other` is the opposite setting. `stops` marks a device that loses its update under strict.
 */
function describePreview(
  r: ServingPreview,
  strictNow: boolean
): { today: ReactNode; other: ReactNode; stops: boolean } {
  const nothing = r.config_version === null || r.config_version === "0.0.0";
  const pkg = r.package_version === null || r.package_version === undefined ? null : Number(r.package_version);
  const served = (
    <span className="inline-flex items-baseline gap-1.5">
      {pkg !== null && Number.isFinite(pkg) ? (
        <Pkg version={pkg} title={r.config_version ? `config ${r.config_version}` : undefined} />
      ) : (
        <span>a release</span>
      )}
    </span>
  );
  if (nothing) {
    const none = <span className="text-muted-foreground">nothing: no release matches</span>;
    return { today: none, other: <span className="text-muted-foreground">nothing either way</span>, stops: false };
  }
  if (r.targeted) {
    return {
      today: (
        <>
          {served} <span className="text-xs text-muted-foreground">targeted at this device</span>
        </>
      ),
      other: (
        <>
          {served} <span className="text-xs text-muted-foreground">unchanged</span>
        </>
      ),
      stops: false,
    };
  }
  // The default release is the risk: it is not targeted at this device and may be JavaScript built for another
  // binary. Staying on the bundled code is the safe outcome, so it is never drawn as an alarm.
  const fallback = (
    <span className="text-amber-800 dark:text-amber-300">
      <TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      {served} <span className="text-xs">untargeted default release: may not match this app build</span>
    </span>
  );
  const noUpdate = (
    <span title={`The server answers ${r.strict_status}: there is nothing to download.`}>
      <ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" aria-hidden />
      keeps its bundled code <span className="text-xs text-muted-foreground">no update is sent</span>
    </span>
  );
  return strictNow
    ? { today: noUpdate, other: fallback, stops: !strictNow }
    : { today: fallback, other: noUpdate, stops: !strictNow };
}

export function PreviewResult({ run, strictNow }: { run: PreviewRun; strictNow: boolean }) {
  const d = describePreview(run.result, strictNow);
  return (
    <li className={cn("rounded-md border p-2.5 text-sm", d.stops && "border-amber-500/50")}>
      <p className="text-xs text-muted-foreground">
        {describeContext(run.context)} · rollout number {run.toss}
      </p>
      <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Today</dt>
        <dd className="min-w-0">{d.today}</dd>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{strictNow ? "If off" : "If strict"}</dt>
        <dd className="min-w-0">{d.other}</dd>
      </dl>
    </li>
  );
}

/**
 * Form + results. `onRun` lets a dialog know a preview happened. Results are kept in the caller's
 * state so they survive re-renders of the form.
 */
export function ServingPreviewForm({
  org,
  app,
  runs,
  onRuns,
  strictNow,
  idPrefix = "sp",
}: {
  org: string;
  app: string;
  runs: PreviewRun[];
  onRuns: (runs: PreviewRun[]) => void;
  strictNow: boolean;
  /** Distinct per form on a page: the dialog's form must not share ids with the panel's. */
  idPrefix?: string;
}) {
  const actions = useServingActions();
  const { pending, error, run, clearError } = useAsyncAction();
  const [appVersion, setAppVersion] = useState("");
  const [extra, setExtra] = useState("");
  const [toss, setToss] = useState("42");
  const parsed = parseExtra(extra);
  const context = { ...(appVersion.trim() ? { app_version: appVersion.trim() } : {}), ...parsed.context };
  const ready = Object.keys(context).length > 0 && toss.trim().length > 0 && !parsed.error;

  const submit = async () => {
    clearError();
    const result = await run(() => actions.preview(org, app, context, toss.trim()));
    if (result) onRuns([{ id: Date.now(), context, toss: toss.trim(), result }, ...runs].slice(0, 8));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-version-${app}`}>App version</Label>
          <Input
            id={`${idPrefix}-version-${app}`}
            value={appVersion}
            onChange={(e) => setAppVersion(e.target.value)}
            placeholder="e.g. 2.0.0"
            className="font-mono"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 sm:row-start-2">
          <Label htmlFor={`${idPrefix}-extra-${app}`}>Other device properties (optional, one key=value per line)</Label>
          <Textarea
            id={`${idPrefix}-extra-${app}`}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={"locale=kn\ncity=bengaluru"}
            rows={2}
            className="font-mono text-xs"
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-toss-${app}`}>Rollout number</Label>
          <Input
            id={`${idPrefix}-toss-${app}`}
            value={toss}
            onChange={(e) => setToss(e.target.value)}
            className="font-mono"
            disabled={pending}
            title="Each device has a rollout number. It decides which side of a rollout target the device lands on, so different numbers can get different releases."
          />
        </div>
      </div>
      {parsed.error && <p className="text-xs text-red-700 dark:text-red-300">{parsed.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={submit} disabled={!ready || pending}>
          <Search /> {pending ? "Asking the server…" : "Preview this device"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Read-only. One device at a time; this is not a count of affected devices.
        </span>
      </div>
      {error && <ErrorState title="Preview failed" message={error} />}
      {runs.length > 0 && (
        <ul className="space-y-2" aria-label="Preview results">
          {runs.map((r) => (
            <PreviewResult key={r.id} run={r} strictNow={strictNow} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The change itself: a dialog for either direction, direct or as a request.
// ---------------------------------------------------------------------------

export function StrictServingDialog({
  open,
  onOpenChange,
  org,
  app,
  platform,
  policy: policyNow,
  live,
  next: nextNow,
  asRequest,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: string;
  app: string;
  platform: Platform | null;
  policy: ServingPolicy;
  live: LiveRelease[];
  /** The value being set. */
  next: boolean;
  /** Maker-checker is on: raise a `set_strict_serving` request instead of writing. */
  asRequest: boolean;
  onChanged?: () => void;
}) {
  const actions = useServingActions();
  const approvals = useApprovalActions();
  const { pending, error, rawError, run, clearError } = useAsyncAction();
  const [runs, setRuns] = useState<PreviewRun[]>([]);
  const [reason, setReason] = useState("");
  const [raised, setRaised] = useState<DeploymentRequest | null>(null);
  const [forceRequest, setForceRequest] = useState(false);
  // The direction and the policy are frozen while the dialog is open. After a change commits, the page
  // refreshes the policy, and the open dialog must keep describing the change that was made.
  const [next, setNext] = useState(nextNow);
  const [policy, setPolicy] = useState(policyNow);
  const request = asRequest || forceRequest;

  useEffect(() => {
    if (open) {
      setNext(nextNow);
      setPolicy(policyNow);
      setRuns([]);
      setReason("");
      setRaised(null);
      setForceRequest(false);
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const turningOn = next;
  const title = `${request ? "Request strict serving" : "Turn strict serving"} ${turningOn ? "on" : "off"} · ${app}`;
  const stops = runs.filter(
    (r) => !r.result.targeted && r.result.config_version && r.result.config_version !== "0.0.0"
  );
  const approvalFailure: ApprovalFailure | null = rawError
    ? classifyApprovalError(rawError, request ? "raise" : "direct")
    : null;
  // A policy change also clears the CDN's cached release answers. When that part fails the policy is
  // still saved: the server says so, and the dialog must not invite a repeat.
  const cacheFailure = classifyCacheError(rawError);
  // Turning on needs at least one preview: the operator must see what stops being served.
  const needsPreview = turningOn && runs.length === 0;

  const submit = async () => {
    if (request) {
      const req = await run(() =>
        approvals.raise(org, app, {
          action: "set_strict_serving",
          payload: { body: { strict: next } },
          reason: reason.trim(),
        })
      );
      if (req) {
        setRaised(req);
        toastSuccess("Request raised", `Strict serving ${next ? "on" : "off"} · ${app}`);
        onChanged?.();
      }
      return;
    }
    const ok = await run(async () => {
      try {
        await actions.setStrict(org, app, next);
      } catch (e) {
        if (classifyCacheError(e)) onChanged?.();
        throw e;
      }
      return true;
    });
    if (ok) {
      toastSuccess(`Strict serving ${next ? "on" : "off"}`, platformApp(platform, app));
      onOpenChange(false);
      onChanged?.();
    }
  };

  if (raised) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Strict serving change requested · {app}</DialogTitle>
            <DialogDescription>
              Serving stays {policy.effective_strict ? "strict" : "with fallback"} until a different checker approves.
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {turningOn
              ? "Devices with no release targeted at their version stop getting OTA updates and keep their bundled code. Devices that have a targeted release are not affected."
              : "Devices with no release targeted at their version start receiving the untargeted default release again. That can be JavaScript built for a different binary."}
            {request && " Nothing changes until a different checker approves."}
          </DialogDescription>
        </DialogHeader>

        {/* The outcome of the write goes first: a long dialog must not hide "saved" below the fold. */}
        {error && cacheFailure && (
          <CacheFailureAfterWrite
            failure={cacheFailure}
            org={org}
            app={app}
            what={`Strict serving ${turningOn ? "on" : "off"}`}
          />
        )}

        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
          <dt className="self-center text-xs uppercase tracking-wide text-muted-foreground">Platform</dt>
          <dd>{platformApp(platform, app)}</dd>
          <dt className="self-start text-xs uppercase tracking-wide text-muted-foreground">Live today</dt>
          <dd className="min-w-0">
            {live.length === 0 ? (
              <span className="text-muted-foreground">nothing live</span>
            ) : (
              <ul className="space-y-0.5">
                {live.map((l) => (
                  <li key={l.release_id} className="flex flex-wrap items-baseline gap-x-2">
                    <Pkg version={l.package_version} />
                    <span className="font-mono text-xs text-muted-foreground">{describeContext(l.dimensions)}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
          <dt className="self-center text-xs uppercase tracking-wide text-muted-foreground">After</dt>
          <dd className="font-medium">
            {turningOn ? "only targeted releases are served" : "default release serves as fallback"}
          </dd>
        </dl>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {turningOn ? "What would stop being served" : "What would start being served"}
          </p>
          <p className="text-xs text-muted-foreground">
            {turningOn
              ? "Enter the dimensions a real device sends, starting with a version you have shipped but have no targeted release for. Devices that would keep their bundled code are safe; ones that get the untargeted default release are outlined in amber."
              : "Enter a version with no targeted release to see the default release it would start receiving."}
          </p>
          <ServingPreviewForm
            org={org}
            app={app}
            runs={runs}
            onRuns={setRuns}
            strictNow={policy.effective_strict}
            idPrefix="sp-dialog"
          />
          {runs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {stops.length === 0
                ? `Every previewed device ${turningOn ? "keeps its release" : "is unaffected"}. Other versions may still be affected: this only answers for the contexts you tried.`
                : `${stops.length} of ${runs.length} previewed device${runs.length === 1 ? "" : "s"} would ${turningOn ? "stop being sent the untargeted default release and keep their bundled code" : "start getting the untargeted default release"}. Other versions may be affected too.`}
            </p>
          )}
        </div>

        {request && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Approval is on for this application. Both directions change who is served, so a checker other than you
              must approve. Approval applies the change immediately.
            </p>
            <Label htmlFor="sp-reason">Reason (required, shown to the checker)</Label>
            <Textarea
              id="sp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={pending}
              placeholder={
                turningOn
                  ? "e.g. 3.0.0 ships a new native module; it must not receive 2.x JavaScript"
                  : "e.g. 2.4.x has no targeted release yet and must keep getting the default bundle"
              }
            />
          </div>
        )}

        {error &&
          !cacheFailure &&
          (approvalFailure && approvalFailure.kind !== "other" ? (
            <ApprovalProblem
              failure={approvalFailure}
              org={org}
              app={app}
              action="serving change"
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
            <ErrorState
              title={request ? "Could not raise the request" : "Could not change strict serving"}
              message={error}
            />
          ))}

        {!cacheFailure && (needsPreview || (request && reason.trim().length === 0)) && (
          <p role="status" className="text-xs text-muted-foreground">
            {needsPreview
              ? "Confirm is disabled until you preview at least one device: see what stops being served first."
              : "Confirm is disabled until you give a reason."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cacheFailure ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={submit}
            variant={turningOn || request ? "default" : "destructive"}
            disabled={pending || needsPreview || (request && reason.trim().length === 0) || Boolean(cacheFailure)}
            className={cn(cacheFailure && "hidden")}
          >
            {pending
              ? request
                ? "Raising request…"
                : "Applying…"
              : request
                ? `Request strict serving ${turningOn ? "on" : "off"}`
                : `Turn strict serving ${turningOn ? "on" : "off"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// The panel on the app page: state, the one control, and a standing preview.
// ---------------------------------------------------------------------------

export function ServingPolicyPanel({
  org,
  app,
  platform,
  policy,
  live,
  permissions,
  approval,
  onChanged,
}: {
  org: string;
  app: string;
  platform: Platform | null;
  policy: ServingPolicy | undefined;
  live: LiveRelease[];
  permissions: { ready: boolean; update: boolean };
  approval: { ready: boolean; policy: ApprovalPolicy | undefined; me: string | null };
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [runs, setRuns] = useState<PreviewRun[]>([]);
  const state = servingState(policy);
  const policyOn = approval.ready && Boolean(approval.policy?.enabled);
  const maker = isMaker(approval.policy, approval.me);
  const next = !(policy?.strict ?? false);

  if (!policy || !state) {
    return (
      <p className="text-sm text-muted-foreground">
        The server did not report a serving policy for this application, so its state is unknown.
      </p>
    );
  }

  if (!approval.ready)
    return (
      <p className="text-sm text-muted-foreground">Approval state unknown. Refresh before changing serving policy.</p>
    );

  const control = (() => {
    if (state === "forced")
      return { disabled: true, title: "Forced on by the deployment; it cannot be turned off here." };
    if (!permissions.ready) return { disabled: true, title: "Checking permissions…" };
    if (!permissions.update)
      return { disabled: true, title: `You do not have permission to update releases in ${app}.` };
    if (policyOn && !maker)
      return { disabled: true, title: `You are not a maker for ${app}, so you cannot raise requests here.` };
    return { disabled: false, title: undefined };
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className={cn("font-medium", state === "fallback" ? "text-foreground" : TONE_TEXT.strict)}>
            {STATE_WORD[state]}.
          </span>{" "}
          {servingExplanation(state)}
        </p>
        <Button
          size="sm"
          variant={next ? "default" : "outline"}
          onClick={() => setOpen(true)}
          disabled={control.disabled}
          title={control.title}
          className={cn(policyOn && !control.disabled && "border-violet-500/40")}
        >
          {control.disabled ? <Lock /> : policyOn ? <UserCheck /> : next ? <ShieldCheck /> : <ShieldOff />}
          {policyOn ? `Request strict serving ${next ? "on" : "off"}` : `Turn strict serving ${next ? "on" : "off"}`}
        </Button>
      </div>

      <div className="border-t pt-3">
        <button
          type="button"
          onClick={() => setCheckOpen((o) => !o)}
          aria-expanded={checkOpen}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {checkOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Check one device
        </button>
        {checkOpen && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Enter what a device sends and see which release it gets today, and what it would get with strict serving{" "}
              {policy.effective_strict ? "off" : "on"}.
            </p>
            <ServingPreviewForm org={org} app={app} runs={runs} onRuns={setRuns} strictNow={policy.effective_strict} />
          </div>
        )}
      </div>

      <StrictServingDialog
        open={open}
        onOpenChange={setOpen}
        org={org}
        app={app}
        platform={platform}
        policy={policy}
        live={live}
        next={next}
        asRequest={policyOn}
        onChanged={onChanged}
      />
    </div>
  );
}
