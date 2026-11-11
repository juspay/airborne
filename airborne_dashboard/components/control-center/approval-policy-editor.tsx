"use client";

import { applyPolicyBatch } from "@/lib/control-center/policy-batch";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, ShieldCheck, Siren, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toastSuccess } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  describePolicyChange,
  isUnconfirmedWrite,
  validatePolicy,
  type PolicyProblem,
} from "@/lib/control-center/approval";
import {
  useApprovalActions,
  useApprovalPolicy,
  useAsyncAction,
  useDeploymentRequests,
  useMe,
  usePolicyCandidates,
} from "@/lib/control-center/hooks";
import { platformLabel } from "@/lib/control-center/format";
import {
  DEFAULT_APPROVAL_POLICY,
  type ApprovalPolicy,
  type GroupMember,
  type PolicyCandidate,
} from "@/lib/control-center/types";
import { ApprovalNotice } from "./approval-notices";
import { BlockSkeleton, ErrorState, Panel, PanelTitle } from "./states";

// ---------------------------------------------------------------------------
// The form. Pure: value in, value out. Used by the per-app page and the group dialog.
// ---------------------------------------------------------------------------

export function PolicyForm({
  value,
  onChange,
  candidates,
  candidatesLoading,
  candidatesError,
  me,
  disabled,
  problems,
  idPrefix = "cc-policy",
}: {
  value: ApprovalPolicy;
  onChange: (next: ApprovalPolicy) => void;
  candidates: PolicyCandidate[] | undefined;
  candidatesLoading: boolean;
  /** The user-list read failed: say so, and do not read the missing list as "nobody has access". */
  candidatesError?: Error;
  me: string | null;
  disabled?: boolean;
  problems: PolicyProblem[];
  idPrefix?: string;
}) {
  const [extra, setExtra] = useState("");
  // Everyone on the list, plus anyone already in the policy who is not among the candidates (keeps old members visible).
  const people = useMemo(() => {
    const known = new Map<string, PolicyCandidate>();
    for (const c of candidates ?? []) known.set(c.subject, c);
    for (const s of [...value.makers, ...value.checkers]) {
      if (!known.has(s)) known.set(s, { subject: s, username: s, email: null });
    }
    return [...known.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  }, [candidates, value.makers, value.checkers]);

  const toggle = (list: "makers" | "checkers", subject: string, on: boolean) => {
    const set = new Set(value[list]);
    if (on) set.add(subject);
    else set.delete(subject);
    onChange({ ...value, [list]: [...set].sort() });
  };

  const addExtra = () => {
    const s = extra.trim();
    if (!s) return;
    if (!value.makers.includes(s) && !value.checkers.includes(s)) {
      onChange({ ...value, checkers: [...value.checkers, s].sort() });
    }
    setExtra("");
  };

  const problemFor = (field: PolicyProblem["field"]) => problems.find((p) => p.field === field)?.message;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-md border p-3">
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-enabled`} className="text-sm font-medium">
            Require approval
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When on, creating a release, raising a target, making live, editing overrides and rolling back a live
            release need a request approved by a different checker. Lowering a target, discarding and rolling back a
            ramping release stay direct, unless the release is marked rollback-sensitive.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={value.enabled}
          onCheckedChange={(v) => onChange({ ...value, enabled: v })}
          disabled={disabled}
          aria-label="Require approval"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-medium">Makers and checkers</Label>
          <span className="text-xs text-muted-foreground">
            {value.makers.length} maker{value.makers.length === 1 ? "" : "s"} · {value.checkers.length} checker
            {value.checkers.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          A maker raises requests; a checker approves or rejects them. One person can be both, but nobody can approve
          their own request, so every maker needs a checker other than themselves. Members must already have access to
          the application; the server refuses anyone else.
        </p>
        {candidatesLoading && !candidates ? (
          <BlockSkeleton className="h-24" />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Person</th>
                  <th className="w-20 px-3 py-2 text-center font-semibold">Maker</th>
                  <th className="w-20 px-3 py-2 text-center font-semibold">Checker</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {candidatesError && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-xs text-amber-800 dark:text-amber-200">
                      Could not load the list of users with access ({candidatesError.message}). Current makers and
                      checkers are shown, but whether each still has access is unknown here; the server checks on save.
                    </td>
                  </tr>
                )}
                {people.length === 0 && !candidatesError && (
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-xs text-muted-foreground">
                      No users with access were listed. Add people by e-mail below.
                    </td>
                  </tr>
                )}
                {people.map((p) => {
                  const maker = value.makers.includes(p.subject);
                  const checker = value.checkers.includes(p.subject);
                  const unknown = !candidatesError && !candidates?.some((c) => c.subject === p.subject);
                  return (
                    <tr key={p.subject} className={cn((maker || checker) && "bg-violet-500/5")}>
                      <td className="min-w-0 px-3 py-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="break-all font-mono text-xs">{p.subject}</span>
                          {p.username !== p.subject && (
                            <span className="text-xs text-muted-foreground">{p.username}</span>
                          )}
                          {p.subject === me && <span className="text-[11px] text-muted-foreground">(you)</span>}
                          {unknown && (
                            <span
                              className="text-[11px] text-amber-700 dark:text-amber-300"
                              title="Not in the list of users with access; the server will refuse the policy unless this person has access."
                            >
                              not listed with access
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <Checkbox
                          checked={maker}
                          onCheckedChange={(v) => toggle("makers", p.subject, v === true)}
                          disabled={disabled}
                          aria-label={`${p.subject} is a maker`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <Checkbox
                          checked={checker}
                          onCheckedChange={(v) => toggle("checkers", p.subject, v === true)}
                          disabled={disabled}
                          aria-label={`${p.subject} is a checker`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!disabled && (
          <div className="flex items-center gap-2">
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExtra();
                }
              }}
              placeholder="Add a person by e-mail (added as checker)"
              className="h-8 text-sm"
              aria-label="Add a person by e-mail"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={addExtra}
              disabled={!extra.trim()}
            >
              <Plus /> Add
            </Button>
          </div>
        )}
        {(problemFor("makers") || problemFor("checkers") || problemFor("pairing")) && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            {problemFor("pairing") ?? problemFor("makers") ?? problemFor("checkers")}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-ttl`}>Requests expire after</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-ttl`}
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={value.request_ttl_hours}
              onChange={(e) => onChange({ ...value, request_ttl_hours: Number(e.target.value) })}
              disabled={disabled}
              className="h-8 w-24 font-mono"
            />
            <span className="text-sm text-muted-foreground">hours</span>
          </div>
          <p className="text-xs text-muted-foreground">
            An undecided request lapses after this and cannot be approved. Default 24.
          </p>
          {problemFor("request_ttl_hours") && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {problemFor("request_ttl_hours")}
            </p>
          )}
        </div>
        <div className="flex items-start justify-between gap-3 rounded-md border border-orange-500/40 bg-orange-500/5 p-3">
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-emergency`} className="flex items-center gap-1.5 text-sm font-medium">
              <Siren className="h-3.5 w-3.5 text-orange-700 dark:text-orange-300" aria-hidden /> Allow emergency
              rollback
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Requires two distinct checkers in the roster. One may restore the previous live release without approval,
              with a reason; the other acknowledges after success. It is flagged for review by a different checker
              afterwards. Default on.
            </p>
          </div>
          <Switch
            id={`${idPrefix}-emergency`}
            checked={value.emergency_rollback}
            onCheckedChange={(v) => onChange({ ...value, emergency_rollback: v })}
            disabled={disabled}
            aria-label="Allow emergency rollback"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation before a save that turns the policy off or removes people.
// ---------------------------------------------------------------------------

function PolicySaveConfirm({
  open,
  onOpenChange,
  apps,
  before,
  after,
  pendingCount,
  note,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apps: string[];
  before: ApprovalPolicy | null;
  after: ApprovalPolicy;
  /** Pending requests across `apps`, or null when unknown. */
  pendingCount: number | null;
  /** Extra sentence for a batch: who is removed where, or which policies could not be read. */
  note?: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  const disabling = Boolean(before?.enabled) && !after.enabled;
  const removed = [
    ...(before?.makers ?? []).filter((m) => !after.makers.includes(m)).map((m) => `${m} (maker)`),
    ...(before?.checkers ?? []).filter((c) => !after.checkers.includes(c)).map((c) => `${c} (checker)`),
  ];
  const appsLabel = apps.length === 1 ? apps[0] : `${apps.length} applications`;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {disabling ? `Turn off approval for ${appsLabel}?` : `Change the approval policy for ${appsLabel}?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {disabling && (
                <p>
                  <strong className="text-foreground">
                    {pendingCount === null
                      ? "Every pending request"
                      : `${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`}
                  </strong>{" "}
                  will be cancelled with the reason “Policy disabled” and will <strong>not</strong> be executed. Direct
                  actions resume at once for anyone with the release permissions.
                </p>
              )}
              {removed.length > 0 && (
                <p>
                  Removing <span className="font-mono text-xs">{removed.join(", ")}</span>. A pending request is judged
                  by the policy at the moment of approval: one raised by someone who is no longer a maker cannot be
                  approved, and one they were going to approve needs another checker.
                </p>
              )}
              {note && <p>{note}</p>}
              <p>The change is audited with the policy before and after.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep as is</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={disabling ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {pending ? "Saving…" : disabling ? "Turn off approval" : "Save policy"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Per-application editor (the policy page).
// ---------------------------------------------------------------------------

export function ApprovalPolicyEditor({ org, app, canEdit }: { org: string; app: string; canEdit: boolean }) {
  const me = useMe();
  const { policy, error, isLoading, refresh } = useApprovalPolicy(org, app);
  const {
    candidates,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = usePolicyCandidates(org, canEdit ? app : null);
  const { requests: pendingRequests } = useDeploymentRequests(org, app, "pending");
  const actions = useApprovalActions();
  const { pending, error: saveError, rawError: saveRawError, run, clearError } = useAsyncAction();
  const [draft, setDraft] = useState<ApprovalPolicy>(DEFAULT_APPROVAL_POLICY);
  const [confirming, setConfirming] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);

  const problems = validatePolicy(draft);
  const changes = policy ? describePolicyChange(policy, draft) : [];
  const dirty = changes.length > 0;
  const needsConfirm =
    Boolean(policy?.enabled && !draft.enabled) ||
    (policy?.makers ?? []).some((m) => !draft.makers.includes(m)) ||
    (policy?.checkers ?? []).some((c) => !draft.checkers.includes(c));

  const save = async () => {
    const ok = await run(async () => {
      try {
        const saved = await actions.putPolicy(org, app, draft);
        setDraft(saved);
        return true;
      } catch (e) {
        // A lost response or a 5xx may follow a commit (turning approval off also cancels pending requests): read the
        // policy back so the form shows what the server holds, not what we hoped it holds.
        if (isUnconfirmedWrite(e)) void refresh();
        throw e;
      }
    });
    // Close the confirmation either way: on a failure the message below it is what the person needs to read.
    setConfirming(false);
    if (ok) {
      setSavedAt(new Date());
      toastSuccess("Approval policy saved", app);
      void refresh();
    }
  };

  if (isLoading && !policy) return <BlockSkeleton className="h-72" />;
  if (error && !policy) {
    return <ErrorState title="Could not load the approval policy" message={error.message} onRetry={() => refresh()} />;
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <ApprovalNotice title="Read only">
          <p className="text-muted-foreground">
            Only organisation owners and admins can change the approval policy. Changes are audited, not prevented.
          </p>
        </ApprovalNotice>
      )}
      <PolicyForm
        value={draft}
        onChange={(v) => {
          clearError();
          setDraft(v);
        }}
        candidates={candidates}
        candidatesLoading={candidatesLoading}
        candidatesError={candidatesError}
        me={me}
        disabled={!canEdit || pending}
        problems={problems}
      />
      {saveError &&
        (isUnconfirmedWrite(saveRawError) ? (
          <ErrorState
            title="The outcome is not confirmed"
            message={`${saveError}. The policy may or may not have been saved. It is being read back: check the form against what the server holds before saving again.`}
          />
        ) : (
          <ErrorState title="The server refused the policy" message={saveError} />
        ))}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty ? (
              <>Unsaved: {changes.join(" · ")}.</>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Saved.
              </span>
            ) : (
              "No unsaved changes."
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (policy) setDraft(policy);
                clearError();
              }}
              disabled={!dirty || pending}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => (needsConfirm ? setConfirming(true) : void save())}
              disabled={!dirty || pending || problems.length > 0}
              title={problems.length > 0 ? problems.map((p) => p.message).join(" ") : undefined}
            >
              <ShieldCheck /> {pending ? "Saving…" : "Save policy"}
            </Button>
          </div>
        </div>
      )}
      <PolicySaveConfirm
        open={confirming}
        onOpenChange={setConfirming}
        apps={[app]}
        before={policy ?? null}
        after={draft}
        pendingCount={pendingRequests ? pendingRequests.length : null}
        onConfirm={() => void save()}
        pending={pending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group action: one policy written to every member application.
// ---------------------------------------------------------------------------

type ApplyOutcome = { app: string; ok: boolean; message: string };

export function ApplyPolicyToGroupDialog({
  open,
  onOpenChange,
  org,
  groupName,
  members,
  pendingByApp,
  policiesByApp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org: string;
  groupName: string;
  members: GroupMember[];
  /** Pending request counts from the overview, per application. */
  pendingByApp: Record<string, number>;
  /** Whether each member currently has approval on, from the overview. */
  policiesByApp: Record<string, boolean>;
}) {
  const me = useMe();
  const firstApp = members[0]?.application ?? null;
  // Members must have access to every application; the first app's list is a starting point, the server checks each.
  const {
    candidates,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = usePolicyCandidates(org, open ? firstApp : null);
  const { policy: firstPolicy } = useApprovalPolicy(org, open ? firstApp : null);
  const actions = useApprovalActions();
  const [draft, setDraft] = useState<ApprovalPolicy>(DEFAULT_APPROVAL_POLICY);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcomes, setOutcomes] = useState<ApplyOutcome[] | null>(null);
  // Every member's current policy, read when Apply is pressed: the draft replaces all of them, so the confirmation
  // has to name the people it removes from any of them, not only from the first member the form was seeded from.
  const [current, setCurrent] = useState<{ before: ApprovalPolicy; note: string | null } | null>(null);

  useEffect(() => {
    if (open) {
      setOutcomes(null);
      setConfirming(false);
      setCurrent(null);
    }
  }, [open]);
  useEffect(() => {
    if (open && firstPolicy) setDraft(firstPolicy);
  }, [open, firstPolicy]);

  const problems = validatePolicy(draft);
  const anyOn = members.some((m) => policiesByApp[m.application]);
  const pendingTotal = members.reduce((n, m) => n + (pendingByApp[m.application] ?? 0), 0);

  const review = async () => {
    setPending(true);
    const read = await Promise.allSettled(members.map((m) => actions.readPolicy(org, m.application)));
    const policies = read.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const unread = members.filter((_, i) => read[i].status === "rejected").map((m) => m.application);
    const union = (pick: (p: ApprovalPolicy) => string[]) => [...new Set(policies.flatMap(pick))];
    const before: ApprovalPolicy = {
      ...DEFAULT_APPROVAL_POLICY,
      enabled: anyOn || policies.some((p) => p.enabled),
      makers: union((p) => p.makers),
      checkers: union((p) => p.checkers),
    };
    const removes =
      before.makers.some((m) => !draft.makers.includes(m)) || before.checkers.some((c) => !draft.checkers.includes(c));
    const note =
      (unread.length > 0
        ? `Could not read the current policy of ${unread.join(", ")}, so people may be removed there too. `
        : "") +
      (removes || unread.length > 0
        ? "Each application's makers, checkers, expiry and emergency setting are replaced by the values in this form."
        : "");
    setPending(false);
    if ((before.enabled && !draft.enabled) || removes || unread.length > 0) {
      setCurrent({ before, note: note || null });
      setConfirming(true);
    } else {
      void apply();
    }
  };

  const apply = async () => {
    setPending(true);
    const results = await applyPolicyBatch(
      members.map((m) => m.application),
      (app) => actions.putPolicy(org, app, draft)
    );
    setOutcomes(results);
    setConfirming(false);
    setPending(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed === 0)
      toastSuccess(
        "Approval policy applied",
        `${results.length} application${results.length === 1 ? "" : "s"} in ${groupName}`
      );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply one approval policy to {groupName}</DialogTitle>
            <DialogDescription>
              This is a non-atomic batch. Earlier successful changes remain saved if a later application fails. Writes
              the same policy to each of the {members.length} member application
              {members.length === 1 ? "" : "s"}:{" "}
              {members.map((m) => `${platformLabel(m.platform)} (${m.application})`).join(", ")}. Each application keeps
              its own policy afterwards and can be changed on its own.
            </DialogDescription>
          </DialogHeader>

          {outcomes ? (
            <div className="space-y-3">
              <ul className="divide-y rounded-md border text-sm">
                {outcomes.map((o) => (
                  <li key={o.app} className="flex items-start gap-2 px-3 py-2">
                    {o.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-xs">{o.app}</span>
                      <p className="text-xs text-muted-foreground">{o.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {outcomes.some((o) => !o.ok) && (
                <p className="text-xs text-muted-foreground">
                  Successful applications above were saved. The failed application’s outcome may be unknown; later
                  applications were not attempted. Re-read policies and change only the applications still needing an
                  update. Reapplying this whole group can cancel requests on already changed apps.
                </p>
              )}
              <DialogFooter>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <PolicyForm
                value={draft}
                onChange={setDraft}
                candidates={candidates}
                candidatesLoading={candidatesLoading}
                candidatesError={candidatesError}
                me={me}
                disabled={pending}
                problems={problems}
                idPrefix="cc-group-policy"
              />
              {anyOn && !draft.enabled && (
                <ApprovalNotice title="This turns approval off" tone="warning" icon={UserMinus}>
                  <p className="text-muted-foreground">
                    {pendingTotal} pending request{pendingTotal === 1 ? "" : "s"} across the group will be cancelled and
                    not executed.
                  </p>
                </ApprovalNotice>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void review()}
                  disabled={pending || problems.length > 0 || members.length === 0}
                  title={problems.length > 0 ? problems.map((p) => p.message).join(" ") : undefined}
                >
                  <ShieldCheck />{" "}
                  {pending ? "Applying…" : `Apply to ${members.length} application${members.length === 1 ? "" : "s"}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <PolicySaveConfirm
        open={confirming}
        onOpenChange={setConfirming}
        apps={members.map((m) => m.application)}
        before={current?.before ?? { ...DEFAULT_APPROVAL_POLICY, enabled: anyOn }}
        after={draft}
        pendingCount={pendingTotal}
        note={current?.note ?? undefined}
        onConfirm={() => void apply()}
        pending={pending}
      />
    </>
  );
}

/** Compact read-only summary for a page sidebar. */
export function PolicySummary({ policy, className }: { policy: ApprovalPolicy; className?: string }) {
  return (
    <Panel className={cn("space-y-2 p-4", className)}>
      <PanelTitle>Approval policy</PanelTitle>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
        <dd>{policy.enabled ? "On" : "Off"}</dd>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Makers</dt>
        <dd className="break-all font-mono text-xs">{policy.makers.join(", ") || "—"}</dd>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Checkers</dt>
        <dd className="break-all font-mono text-xs">{policy.checkers.join(", ") || "—"}</dd>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Expiry</dt>
        <dd>{policy.request_ttl_hours}h</dd>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Emergency</dt>
        <dd>{policy.emergency_rollback ? "Allowed for checkers" : "Off"}</dd>
      </dl>
    </Panel>
  );
}
