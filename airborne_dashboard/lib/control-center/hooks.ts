"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useAppContext } from "@/providers/app-context";
import { enforcePermissionsBatch } from "@/lib/authz";
import { getControlCenterClient } from "./data";
import { hasActiveReleases } from "./format";
import type {
  ApprovalPolicy,
  ClientContext,
  ControlCenterClient,
  DeploymentRequest,
  DeploymentRequestStatus,
  DeploymentRequestsResponse,
  EmergencyRollbackOptions,
  GroupRequest,
  GroupsResponse,
  OrgApplication,
  Overview,
  PolicyCandidate,
  RaiseDeploymentRequest,
  ReleaseDetail,
  ReleaseEventsResponse,
  ReleaseOutcome,
  RequestDecision,
  RollbackPreview,
  PendingOperation,
  RollbackResponse,
  ServingPolicy,
  ServingPreview,
  TelemetrySummary,
} from "./types";

export const POLL_ACTIVE_MS = 15_000;
export const POLL_IDLE_MS = 60_000;

const KEY_PREFIX = "control-center";

function useClientContext(): ClientContext {
  const { token, logout } = useAppContext();
  return useMemo(() => ({ token, logout }), [token, logout]);
}

async function withClient<T>(ctx: ClientContext, fn: (c: ControlCenterClient) => Promise<T>): Promise<T> {
  const client = await getControlCenterClient(ctx);
  return fn(client);
}

/** Revalidate every Control Center query (after a mutation). */
export function refreshControlCenter(): Promise<unknown> {
  return globalMutate((key) => Array.isArray(key) && key[0] === KEY_PREFIX, undefined, { revalidate: true });
}

// Polling note: `refreshInterval` is a plain number held in state and set from each successful response.
// SWR re-arms its timer when the value changes (a release that finishes moves from 15s to 60s at once),
// and it does not poll before the first data arrives. A function-valued interval is wrong here: SWR
// calls it once before any data exists and re-arms on every render when its identity changes.

export function useOverview() {
  const ctx = useClientContext();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const swr = useSWR<Overview>(
    ctx.token ? [KEY_PREFIX, "overview", ctx.token] : null,
    () => withClient(ctx, (c) => c.getOverview()),
    {
      refreshInterval: pollMs,
      revalidateOnFocus: true,
      keepPreviousData: true,
      onSuccess: (data) => {
        setPollMs(pollIntervalFor(hasActiveReleases(data)));
        setLastUpdatedAt(new Date());
      },
    }
  );
  return {
    overview: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    lastUpdatedAt,
    pollMs: pollMs || POLL_ACTIVE_MS,
    refresh: () => swr.mutate(),
  };
}

export function useGroups(org: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<GroupsResponse>(
    ctx.token && org ? [KEY_PREFIX, "groups", org, ctx.token] : null,
    () => withClient(ctx, (c) => c.listGroups(org as string)),
    { keepPreviousData: true }
  );
  return {
    groups: swr.data?.groups,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    refresh: swr.mutate,
  };
}

export function useOrgApplications(org: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<OrgApplication[]>(ctx.token && org ? [KEY_PREFIX, "applications", org, ctx.token] : null, () =>
    withClient(ctx, (c) => c.listApplications(org as string))
  );
  return { applications: swr.data, error: swr.error as Error | undefined, isLoading: swr.isLoading };
}

/** The spec's rule: 15s while a release is active, 60s otherwise. */
export function pollIntervalFor(active: boolean): number {
  return active ? POLL_ACTIVE_MS : POLL_IDLE_MS;
}

export function isOngoingStatus(status: string | undefined): boolean {
  return status === "CREATED" || status === "INPROGRESS";
}

export function useRelease(org: string | null, app: string | null, releaseId: string | null) {
  const ctx = useClientContext();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const swr = useSWR<ReleaseDetail>(
    ctx.token && org && app && releaseId ? [KEY_PREFIX, "release", org, app, releaseId, ctx.token] : null,
    () => withClient(ctx, (c) => c.getRelease(org as string, app as string, releaseId as string)),
    {
      refreshInterval: pollMs,
      keepPreviousData: true,
      onSuccess: (data) => {
        setPollMs(pollIntervalFor(isOngoingStatus(data.experiment.status)));
        setLastUpdatedAt(new Date());
      },
    }
  );
  return {
    release: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    lastUpdatedAt,
    /** The interval the release is actually refetched at; show exactly this. */
    pollMs: pollMs || POLL_ACTIVE_MS,
    refresh: swr.mutate,
  };
}

export function useReleaseEvents(org: string | null, app: string | null, releaseId: string | null, poll: boolean) {
  const ctx = useClientContext();
  const swr = useSWR<ReleaseEventsResponse>(
    ctx.token && org && app && releaseId ? [KEY_PREFIX, "events", org, app, releaseId, ctx.token] : null,
    () => withClient(ctx, (c) => c.getReleaseEvents(org as string, app as string, releaseId as string)),
    { refreshInterval: pollIntervalFor(poll), keepPreviousData: true }
  );
  return {
    events: swr.data?.events,
    /** Server-computed. `undefined` means unknown (loading or the request failed); never infer it. */
    outcome: swr.error || swr.isLoading ? undefined : (swr.data?.outcome as ReleaseOutcome | undefined),
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    refresh: swr.mutate,
  };
}

export type PreviewState =
  | { status: "loading" }
  | { status: "ready"; preview: RollbackPreview }
  | { status: "error"; error: Error };

/**
 * The rollback preview for the confirmation dialog. It is fetched afresh every time the dialog opens
 * (never from a shared cache: the point is to show the server's answer now) and `reload` fetches it again.
 * While it loads or after it fails there is no preview, so nothing downstream can be confirmed.
 */
export function useRollbackPreview(open: boolean, org: string, app: string, releaseId: string) {
  const ctx = useClientContext();
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ status: "loading" });
    withClient(ctx, (c) => c.getRollbackPreview(org, app, releaseId)).then(
      (preview) => !cancelled && setState({ status: "ready", preview }),
      (e) => !cancelled && setState({ status: "error", error: e instanceof Error ? e : new Error(String(e)) })
    );
    return () => {
      cancelled = true;
    };
  }, [open, ctx, org, app, releaseId, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}

export interface UnresolvedOperation {
  operationId: string | null;
  message: string;
}

/** Read the operation journal directly, including on completed rollback pages. */
export function useUnresolvedOperation(
  org: string | null,
  app: string | null,
  releaseId: string | null,
  pollMs: number
) {
  const ctx = useClientContext();
  const swr = useSWR<{ operations: PendingOperation[] }>(
    ctx.token && org && app ? [KEY_PREFIX, "operations", org, app, ctx.token] : null,
    () => withClient(ctx, (c) => c.listOperations(org as string, app as string)),
    { refreshInterval: pollMs, keepPreviousData: false }
  );
  // A failed read must not erase a pause we already know about, and must not read as "nothing is paused" either.
  const op = swr.data?.operations[0];
  const refresh = useCallback(() => void swr.mutate(), [swr]);
  return {
    unresolved: op ? { operationId: op.operation_id, message: op.message } : undefined,
    /** The last read failed: whether writes are paused is not known from it. */
    checkFailed: Boolean(swr.error),
    refresh,
  };
}

const RELEASE_AUTHZ = [
  { resource: "release", action: "read", scope: "app" },
  { resource: "release", action: "ramp", scope: "app" },
  { resource: "release", action: "conclude", scope: "app" },
  { resource: "release", action: "update", scope: "app" },
  { resource: "release", action: "create", scope: "app" },
  { resource: "release", action: "discard", scope: "app" },
] as const;

export interface ReleasePermissionSet {
  read: boolean;
  ramp: boolean;
  /** Also gates rollback and discard: the server uses the conclude permission for them. */
  conclude: boolean;
  /** Gates the strict-serving control: the server uses the release update permission for it. */
  update: boolean;
  /** Gates approving a "create" request. */
  create: boolean;
  /** Gates deciding a "discard" request. */
  discard: boolean;
  /** False until the check for this exact app has answered. Nothing is offered before that. */
  isReady: boolean;
}

/**
 * The same specific checks the server enforces, for one explicit application. Group page columns and
 * the release page both use this, so a user is never offered an action the server would refuse.
 * (usePagePermissions is bound to the app in context, which is wrong for a page showing several apps.)
 */
export function useReleasePermissions(org: string | null, app: string | null): ReleasePermissionSet {
  const { token } = useAppContext();
  const swr = useSWR(token && org && app ? ["cc-release-permissions", token, org, app] : null, () =>
    enforcePermissionsBatch({ token, org, app }, [...RELEASE_AUTHZ])
  );
  const results = swr.data?.results;
  return {
    read: results?.[0]?.allowed ?? false,
    ramp: results?.[1]?.allowed ?? false,
    conclude: results?.[2]?.allowed ?? false,
    update: results?.[3]?.allowed ?? false,
    create: results?.[4]?.allowed ?? false,
    discard: results?.[5]?.allowed ?? false,
    isReady: Boolean(swr.data) || Boolean(swr.error),
  };
}

// ---------------------------------------------------------------------------
// Device telemetry (read-only)
// ---------------------------------------------------------------------------

/**
 * The seven-day device report summary for one app, read fresh from its own route. The overview embeds the
 * same object per app and is what the chips use; this read also carries the security exclusions and is what
 * the detail panels show. Polled on the idle interval: reports arrive in batches, not per second.
 */
export function useTelemetry(org: string | null, app: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<TelemetrySummary>(
    ctx.token && org && app ? [KEY_PREFIX, "telemetry", org, app, ctx.token] : null,
    () => withClient(ctx, (c) => c.getTelemetry(org as string, app as string)),
    { keepPreviousData: true, refreshInterval: POLL_IDLE_MS, revalidateOnFocus: true }
  );
  return {
    telemetry: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    refresh: swr.mutate,
  };
}

// ---------------------------------------------------------------------------
// Strict serving and CDN cache
// ---------------------------------------------------------------------------

export function useServingPolicy(org: string | null, app: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<ServingPolicy>(
    ctx.token && org && app ? [KEY_PREFIX, "serving-policy", org, app, ctx.token] : null,
    () => withClient(ctx, (c) => c.getServingPolicy(org as string, app as string)),
    { keepPreviousData: true }
  );
  return {
    policy: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    refresh: swr.mutate,
  };
}

export interface ServingActions {
  setStrict: (org: string, app: string, strict: boolean) => Promise<ServingPolicy>;
  /** Read-only: one device's answer for the supplied dimensions and toss. */
  preview: (org: string, app: string, context: Record<string, string>, toss: string) => Promise<ServingPreview>;
  retryCacheInvalidation: (org: string, app: string) => Promise<void>;
}

export function useServingActions(): ServingActions {
  const ctx = useClientContext();
  return useMemo<ServingActions>(
    () => ({
      setStrict: async (org, app, strict) => {
        const res = await withClient(ctx, (c) => c.putServingPolicy(org, app, strict));
        await refreshControlCenter();
        return res;
      },
      preview: (org, app, context, toss) => withClient(ctx, (c) => c.previewServing(org, app, context, toss)),
      retryCacheInvalidation: async (org, app) => {
        try {
          await withClient(ctx, (c) => c.retryCacheInvalidation(org, app));
        } finally {
          // The attempt is recorded either way; re-read the overview and timelines.
          await refreshControlCenter();
        }
      },
    }),
    [ctx]
  );
}

export interface ReleaseActions {
  ramp: (org: string, app: string, releaseId: string, target: number) => Promise<void>;
  conclude: (org: string, app: string, releaseId: string, chosenVariant: string) => Promise<void>;
  rollback: (
    org: string,
    app: string,
    releaseId: string,
    reason: string,
    emergency?: EmergencyRollbackOptions
  ) => Promise<RollbackResponse>;
}

export function useReleaseActions(): ReleaseActions {
  const ctx = useClientContext();
  return useMemo<ReleaseActions>(
    () => ({
      ramp: async (org, app, id, target) => {
        await withClient(ctx, (c) => c.rampRelease(org, app, id, target));
        await refreshControlCenter();
      },
      conclude: async (org, app, id, variant) => {
        await withClient(ctx, (c) => c.concludeRelease(org, app, id, variant));
        await refreshControlCenter();
      },
      rollback: async (org, app, id, reason, emergency) => {
        const res = await withClient(ctx, (c) => c.rollbackRelease(org, app, id, reason, emergency));
        await refreshControlCenter();
        return res;
      },
    }),
    [ctx]
  );
}

// ---------------------------------------------------------------------------
// Maker-checker
// ---------------------------------------------------------------------------

/**
 * The signed-in user's subject, as the server knows it (`AuthResponse.sub`, returned by login as `user_id`).
 * Used only to label things ("you raised this"); the server checks identity itself on every write.
 */
export function useMe(): string | null {
  const { user } = useAppContext();
  return user?.user_id ?? user?.name ?? null;
}

export function useApprovalPolicy(org: string | null, app: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<ApprovalPolicy>(
    ctx.token && org && app ? [KEY_PREFIX, "approval-policy", org, app, ctx.token] : null,
    () => withClient(ctx, (c) => c.getApprovalPolicy(org as string, app as string)),
    { keepPreviousData: true }
  );
  return {
    policy: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    /** True once the server has answered (either way). Nothing is labelled "Request …" before that. */
    isReady: Boolean(swr.data) && !swr.error,
    refresh: swr.mutate,
  };
}

export function usePolicyCandidates(org: string | null, app: string | null) {
  const ctx = useClientContext();
  const swr = useSWR<PolicyCandidate[]>(
    ctx.token && org && app ? [KEY_PREFIX, "policy-candidates", org, app, ctx.token] : null,
    () => withClient(ctx, (c) => c.listPolicyCandidates(org as string, app as string))
  );
  return { candidates: swr.data, error: swr.error as Error | undefined, isLoading: swr.isLoading };
}

/** Requests for one application, or (app null) for the whole organisation. Polls while any is open. */
export function useDeploymentRequests(org: string | null, app: string | null, status?: DeploymentRequestStatus) {
  const ctx = useClientContext();
  const [pollMs, setPollMs] = useState(0);
  const swr = useSWR<DeploymentRequestsResponse>(
    ctx.token && org ? [KEY_PREFIX, "requests", org, app ?? "", status ?? "", ctx.token] : null,
    () => withClient(ctx, (c) => c.listDeploymentRequests(org as string, app, status)),
    {
      keepPreviousData: true,
      refreshInterval: pollMs,
      revalidateOnFocus: true,
      onSuccess: (data) =>
        setPollMs(pollIntervalFor(data.requests.some((r) => r.status === "pending" || r.status === "executing"))),
    }
  );
  return {
    requests: swr.data?.requests,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    refresh: swr.mutate,
  };
}

export function useDeploymentRequest(org: string | null, app: string | null, id: string | null) {
  const ctx = useClientContext();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const swr = useSWR<DeploymentRequest>(
    ctx.token && org && app && id ? [KEY_PREFIX, "request", org, app, id, ctx.token] : null,
    () => withClient(ctx, (c) => c.getDeploymentRequest(org as string, app as string, id as string)),
    {
      keepPreviousData: true,
      refreshInterval: pollMs,
      onSuccess: (data) => {
        setPollMs(pollIntervalFor(data.status === "pending" || data.status === "executing"));
        setLastUpdatedAt(new Date());
      },
    }
  );
  return {
    request: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    lastUpdatedAt,
    pollMs: pollMs || POLL_ACTIVE_MS,
    refresh: swr.mutate,
  };
}

export interface ApprovalActions {
  raise: (org: string, app: string, body: RaiseDeploymentRequest) => Promise<DeploymentRequest>;
  decide: (
    org: string,
    app: string,
    id: string,
    decision: RequestDecision,
    reason: string
  ) => Promise<DeploymentRequest>;
  putPolicy: (org: string, app: string, policy: ApprovalPolicy) => Promise<ApprovalPolicy>;
  /** A fresh read, not the cache: used before a write that replaces what is stored. */
  readPolicy: (org: string, app: string) => Promise<ApprovalPolicy>;
  acknowledgeEmergency: (org: string, app: string, releaseId: string, reason: string) => Promise<void>;
}

export function useApprovalActions(): ApprovalActions {
  const ctx = useClientContext();
  return useMemo<ApprovalActions>(
    () => ({
      raise: async (org, app, body) => {
        const res = await withClient(ctx, (c) => c.createDeploymentRequest(org, app, body));
        await refreshControlCenter();
        return res;
      },
      decide: async (org, app, id, decision, reason) => {
        try {
          return await withClient(ctx, (c) => c.decideDeploymentRequest(org, app, id, decision, reason));
        } finally {
          // A refusal also changes state (stale, expired, failed): always re-read.
          await refreshControlCenter();
        }
      },
      putPolicy: async (org, app, policy) => {
        const res = await withClient(ctx, (c) => c.putApprovalPolicy(org, app, policy));
        await refreshControlCenter();
        return res;
      },
      readPolicy: (org, app) => withClient(ctx, (c) => c.getApprovalPolicy(org, app)),
      acknowledgeEmergency: async (org, app, releaseId, reason) => {
        await withClient(ctx, (c) => c.acknowledgeEmergency(org, app, releaseId, reason));
        await refreshControlCenter();
      },
    }),
    [ctx]
  );
}

export interface GroupActions {
  create: (org: string, body: GroupRequest) => Promise<void>;
  update: (org: string, id: string, body: GroupRequest) => Promise<void>;
  remove: (org: string, id: string) => Promise<void>;
}

export function useGroupActions(): GroupActions {
  const ctx = useClientContext();
  return useMemo<GroupActions>(
    () => ({
      create: async (org, body) => {
        await withClient(ctx, (c) => c.createGroup(org, body));
        await refreshControlCenter();
      },
      update: async (org, id, body) => {
        await withClient(ctx, (c) => c.updateGroup(org, id, body));
        await refreshControlCenter();
      },
      remove: async (org, id) => {
        await withClient(ctx, (c) => c.deleteGroup(org, id));
        await refreshControlCenter();
      },
    }),
    [ctx]
  );
}

/** A clock that ticks so relative timestamps ("2m ago") stay honest without refetching. */
export function useNow(tickMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

/**
 * Tracks an async action's pending state and surfaces its error. A second call while one is in
 * flight is ignored, so a double click can never submit twice.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<unknown>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    setError(null);
    setRawError(null);
    try {
      return await fn();
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : String(e));
        setRawError(e);
      }
      return undefined;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);
  const clearError = useCallback(() => {
    setError(null);
    setRawError(null);
  }, []);
  return { pending, error, rawError, run, clearError };
}
