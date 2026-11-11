import { apiFetch } from "@/lib/api";
import { feedSearch } from "./deployments";
import type {
  AppGroup,
  ApprovalPolicy,
  ClientContext,
  ControlCenterClient,
  DeploymentFeedPage,
  DeploymentRequest,
  DeploymentRequestsResponse,
  GroupsResponse,
  Overview,
  PolicyCandidate,
  ReleaseDetail,
  ReleaseEventsResponse,
  RollbackPreview,
  RollbackResponse,
  ServingPolicy,
  ServingPreview,
  TelemetrySummary,
} from "./types";

interface OrganisationsList {
  organisations: { name: string; applications: { application: string }[] }[];
}

interface UsersList {
  users?: { username?: string; email?: string | null; user?: string }[];
}

/** Real client: every call goes through `apiFetch`, so auth and 401 handling match the rest of the dashboard. Write errors are shown inline in their dialogs, so the global error toast (which also mislabels HTTP errors as "Network Error") is off. */
export function createApiClient(ctx: ClientContext): ControlCenterClient {
  const base = { token: ctx.token, logout: ctx.logout };
  return {
    listOperations: (org, app) =>
      apiFetch("/control-center/operations?status=unresolved", { showErrorToast: false }, { ...base, org, app }),
    resolveOperation: async (org, app, id, finding, reason) => {
      await apiFetch(
        `/control-center/operations/${encodeURIComponent(id)}/resolve`,
        { method: "POST", body: { finding, reason, request_terminated: true }, showErrorToast: false },
        { ...base, org, app }
      );
    },
    getDeploymentFeed: (q) =>
      apiFetch<DeploymentFeedPage>(
        // `action` repeats, which the plain query helper cannot express: build the query string here.
        `/control-center/deployments${feedSearch(q)}`,
        { showErrorToast: false },
        base
      ),
    getOverview: (scope) =>
      apiFetch<Overview>(
        "/control-center/overview",
        { query: { org: scope?.org, group: scope?.group, app: scope?.app }, showErrorToast: false },
        base
      ),

    listGroups: (org) =>
      apiFetch<GroupsResponse>("/control-center/groups", { showErrorToast: false }, { ...base, org }),

    createGroup: (org, body) =>
      apiFetch<AppGroup>("/control-center/groups", { method: "POST", body, showErrorToast: false }, { ...base, org }),

    updateGroup: (org, id, body) =>
      apiFetch<AppGroup>(
        `/control-center/groups/${encodeURIComponent(id)}`,
        { method: "PUT", body, showErrorToast: false },
        { ...base, org }
      ),

    deleteGroup: async (org, id) => {
      await apiFetch<unknown>(
        `/control-center/groups/${encodeURIComponent(id)}`,
        { method: "DELETE", showErrorToast: false },
        { ...base, org }
      );
    },

    listApplications: async (org) => {
      const res = await apiFetch<OrganisationsList>("/organisations", { showErrorToast: false }, base);
      const found = res.organisations.find((o) => o.name === org);
      return (found?.applications ?? []).map((a) => ({ application: a.application }));
    },

    getRelease: (org, app, releaseId) =>
      apiFetch<ReleaseDetail>(
        `/releases/${encodeURIComponent(releaseId)}`,
        { showErrorToast: false },
        { ...base, org, app }
      ),

    getReleaseEvents: (org, app, releaseId) =>
      apiFetch<ReleaseEventsResponse>(
        `/control-center/releases/${encodeURIComponent(releaseId)}/events`,
        { showErrorToast: false },
        { ...base, org, app }
      ),

    rampRelease: async (org, app, releaseId, trafficPercentage) => {
      await apiFetch<unknown>(
        `/releases/${encodeURIComponent(releaseId)}/ramp`,
        { method: "POST", body: { traffic_percentage: trafficPercentage }, showErrorToast: false },
        { ...base, org, app }
      );
    },

    concludeRelease: async (org, app, releaseId, chosenVariant) => {
      await apiFetch<unknown>(
        `/releases/${encodeURIComponent(releaseId)}/conclude`,
        { method: "POST", body: { chosen_variant: chosenVariant }, showErrorToast: false },
        { ...base, org, app }
      );
    },

    getRollbackPreview: (org, app, releaseId) =>
      apiFetch<RollbackPreview>(
        `/control-center/releases/${encodeURIComponent(releaseId)}/rollback-preview`,
        { showErrorToast: false },
        { ...base, org, app }
      ),

    getTelemetry: (org, app) =>
      apiFetch<TelemetrySummary>("/control-center/telemetry", { showErrorToast: false }, { ...base, org, app }),

    rollbackRelease: (org, app, releaseId, reason, emergency) =>
      apiFetch<RollbackResponse>(
        `/releases/${encodeURIComponent(releaseId)}/rollback`,
        { method: "POST", body: { reason, ...(emergency ?? {}) }, showErrorToast: false },
        { ...base, org, app }
      ),

    getApprovalPolicy: (org, app) =>
      apiFetch<ApprovalPolicy>("/control-center/approval-policy", { showErrorToast: false }, { ...base, org, app }),

    putApprovalPolicy: (org, app, policy) =>
      apiFetch<ApprovalPolicy>(
        "/control-center/approval-policy",
        { method: "PUT", body: policy, showErrorToast: false },
        { ...base, org, app }
      ),

    listDeploymentRequests: (org, app, status) =>
      apiFetch<DeploymentRequestsResponse>(
        "/control-center/deployment-requests",
        { query: { status }, showErrorToast: false },
        { ...base, org, app: app ?? undefined }
      ),

    getDeploymentRequest: (org, app, id) =>
      apiFetch<DeploymentRequest>(
        `/control-center/deployment-requests/${encodeURIComponent(id)}`,
        { showErrorToast: false },
        { ...base, org, app }
      ),

    createDeploymentRequest: (org, app, body) =>
      apiFetch<DeploymentRequest>(
        "/control-center/deployment-requests",
        { method: "POST", body, showErrorToast: false },
        { ...base, org, app }
      ),

    decideDeploymentRequest: (org, app, id, decision, reason) =>
      apiFetch<DeploymentRequest>(
        `/control-center/deployment-requests/${encodeURIComponent(id)}/${decision}`,
        { method: "POST", body: { reason }, showErrorToast: false },
        { ...base, org, app }
      ),

    acknowledgeEmergency: async (org, app, releaseId, reason) => {
      await apiFetch<unknown>(
        `/releases/${encodeURIComponent(releaseId)}/acknowledge-emergency`,
        { method: "POST", body: { reason }, showErrorToast: false },
        { ...base, org, app }
      );
    },

    listPolicyCandidates: async (org, app) => {
      // Organisation members plus application members: the server accepts either as a policy member. Either read
      // failing is an error, not an empty list: half a list would flag real members as "not listed with access".
      const [orgUsers, appUsers] = await Promise.all([
        apiFetch<UsersList>("/organisations/user/list", { showErrorToast: false }, { ...base, org }),
        apiFetch<UsersList>("/organisations/applications/user/list", { showErrorToast: false }, { ...base, org, app }),
      ]);
      const seen = new Map<string, PolicyCandidate>();
      for (const u of [...(orgUsers.users ?? []), ...(appUsers.users ?? [])]) {
        const username = u.username ?? u.user ?? "";
        const email = u.email ?? null;
        // The server's canonical subject is the e-mail; fall back to the username when none is known.
        const subject = email || username;
        if (!subject || seen.has(subject)) continue;
        seen.set(subject, { subject, username: username || subject, email });
      }
      return [...seen.values()].sort((a, b) => a.subject.localeCompare(b.subject));
    },

    getServingPolicy: (org, app) =>
      apiFetch<ServingPolicy>("/control-center/serving-policy", { showErrorToast: false }, { ...base, org, app }),

    putServingPolicy: (org, app, strict) =>
      apiFetch<ServingPolicy>(
        "/control-center/serving-policy",
        { method: "PUT", body: { strict }, showErrorToast: false },
        { ...base, org, app }
      ),

    previewServing: (org, app, context, toss) =>
      apiFetch<ServingPreview>(
        "/control-center/serving-policy/preview",
        { method: "POST", body: { context, toss }, showErrorToast: false },
        { ...base, org, app }
      ),

    retryCacheInvalidation: async (org, app) => {
      await apiFetch<unknown>(
        "/control-center/cache-invalidation/retry",
        { method: "POST", body: {}, showErrorToast: false },
        { ...base, org, app }
      );
    },
  };
}
