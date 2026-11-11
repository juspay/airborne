// Shared contract for the Control Center: the shapes the /control-center routes in airborne_server return
// (airborne_server/src/control_center.rs and airborne_server/src/release/). Keep them in step by hand.
// The rollout number on every screen is the rollout *target* (traffic %); device counts are unverified reports.

export type ISO8601 = string;

export type Platform = "android" | "ios" | "web" | "other";

export type ReleaseStatus = "CREATED" | "INPROGRESS" | "CONCLUDED" | "DISCARDED";

export type DimensionContext = Record<string, string | number | boolean | null>;

export interface LiveRelease {
  release_id: string;
  package_version: number;
  config_version: string;
  dimensions: DimensionContext;
  concluded_at: ISO8601 | null;
}

export interface ActiveRelease {
  release_id: string;
  package_version: number;
  status: Extract<ReleaseStatus, "CREATED" | "INPROGRESS">;
  /** Rollout target. Never an adoption figure. */
  traffic_percentage: number;
  dimensions: DimensionContext;
  created_at: ISO8601;
  created_by: string;
  /** The exact variant id that conclude requires. */
  experimental_variant: string;
}

export interface PendingOperation {
  operation_id: string;
  message: string;
  code?: string;
}

/** Per-application serving policy, from `/control-center/serving-policy` and each overview member. */
export interface ServingPolicy {
  /** The stored policy. */
  strict: boolean;
  /** `STRICT_RELEASE_APPLICATIONS` forces strict on for this app; it cannot be turned off here. */
  deployment_override: boolean;
  /** What the serving endpoints actually apply: `strict || deployment_override`. */
  effective_strict: boolean;
}

/** One device's answer from `POST /control-center/serving-policy/preview`. A sample, never a population estimate. */
export interface ServingPreview {
  serving_policy: ServingPolicy;
  context: Record<string, string>;
  toss: string;
  /** The config version the device resolves today; `"0.0.0"` means only the workspace default matched. */
  config_version: string | null;
  package_version: number | string | null;
  /** A release targeted at this device's dimensions matched. */
  targeted: boolean;
  /** With strict serving on, this device would get no OTA release (404, bundled code). */
  would_stop_serving: boolean;
  /** The HTTP status strict serving would answer: 200 or 404. */
  strict_status: 200 | 404 | number;
  scope: string;
}

/** The latest CDN invalidation outcome for an app, from the overview. `null` when none was ever recorded. */
export interface CacheInvalidation {
  status: "ok" | "failed" | "not_applicable";
  at?: ISO8601;
  /** `failed` only: the CDN paths that could not be invalidated after every attempt. */
  failed_paths?: string[];
  attempts_per_path?: number;
}

export interface AppStatus {
  /** Auxiliary lookup failed; null metadata must not be interpreted as safe. */
  auxiliary_error?: string | null;
  unresolved_operations?: PendingOperation[] | null;
  /** Absent on a server without the stored policy. */
  serving_policy?: ServingPolicy;
  cache_invalidation?: CacheInvalidation | null;
  /** Maker-checker, from `/overview`. Absent on a server without the feature. */
  approval_required?: boolean;
  pending_requests?: number;
  emergency_needs_review?: EmergencyReview[];
  release_protections?: ReleaseProtection[];
  /**
   * Anonymous device reports for this app over the last seven days, from `/overview`. Absent on a server
   * without telemetry (and on a failed lookup); `{ error }` when aggregation failed. Advice only: the server
   * never acts on it.
   */
  telemetry?: AppTelemetry;
  application: string;
  platform: Platform | null;
  live: LiveRelease[];
  active: ActiveRelease[];
  last_activity_at: ISO8601 | null;
  /** Set when this app's lookup failed; live/active are then empty. */
  error: string | null;
}

export interface GroupMember {
  application: string;
  platform: Platform;
}

export interface AppGroup {
  id: string;
  name: string;
  members: GroupMember[];
}

export interface OverviewGroup {
  id: string;
  name: string;
  members: AppStatus[];
}

export interface OverviewOrganisation {
  name: string;
  groups: OverviewGroup[];
  ungrouped: AppStatus[];
}

export interface Overview {
  generated_at: ISO8601;
  organisations: OverviewOrganisation[];
}

export interface GroupsResponse {
  groups: AppGroup[];
}

export interface GroupRequest {
  name: string;
  members: GroupMember[];
}

export type ReleaseEventAction =
  | "created"
  | "ramped"
  | "concluded"
  | "discarded"
  | "rolled_back"
  | "operation_resolved"
  // Maker-checker. The payload of a request event is the request itself (both people are in it).
  | "requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "stale"
  | "executed"
  | "failed"
  | "emergency_rollback"
  | "emergency_acknowledged"
  | "policy_changed"
  // App-wide, actor `system:cache`: recorded after every release write and after a cache-only retry.
  | "cache_invalidated"
  | "cache_invalidation_failed";

export interface ReleaseEvent {
  action: ReleaseEventAction;
  actor: string;
  created_at: ISO8601;
  payload: Record<string, unknown>;
  synthetic: boolean;
}

/** Computed by the server. The UI must never infer it. */
export type ReleaseOutcome = "active" | "live" | "superseded" | "concluded_on_control" | "discarded";

export interface ReleaseEventsResponse {
  events: ReleaseEvent[];
  outcome: ReleaseOutcome;
}

export type RollbackAction = "discarded" | "concluded_control" | "rereleased";

/** Config keys changed while re-releasing the previous package (rollback of a live release only). */
export interface ReconciledKeys {
  /** Registered since the previous release: they keep their current value. */
  kept_current: string[];
  /** No longer registered: dropped from the restored config. */
  dropped: string[];
}

export interface RollbackResponse {
  action: RollbackAction;
  release_id: string;
  rolled_back_to_package_version: number | null;
  new_release_id: string | null;
  reconciled_keys?: ReconciledKeys;
  /**
   * Present ONLY when the server is returning the recorded result of a rollback that had already
   * completed (a repeat after a lost response). Its absence means this call did the work.
   */
  current_live_release_id?: string | null;
  /** On a recorded result: a later release, unrelated to this rollback, that is live now. */
  later_release_id?: string | null;
}

/**
 * Why a rollback cannot proceed. `unresolved` is app-wide; `missing_files` means the earlier package's artifacts
 * are not all reachable; `rollback_chain` means this release is itself a rollback replacement. The others concern
 * this release's position in its reach.
 */
export type RollbackBlockedCode =
  | "superseded"
  | "ongoing"
  | "no_predecessor"
  | "incompatible"
  | "unresolved"
  | "artifact_verification_unknown"
  | "missing_files"
  | "rollback_chain";

export interface RollbackBlocked {
  code: RollbackBlockedCode;
  message: string;
  current_live_release_id?: string | null;
  /** `unresolved`: the upstream write whose outcome is not confirmed. */
  operation_id?: string | null;
  /** `incompatible` with this set means "replacement_changed" (the preview enum has no such code). */
  replacement_release_id?: string | null;
}

/** `GET /control-center/releases/{id}/rollback-preview`. Read-only. */
export interface RollbackPreview {
  /** Null when no rollback action exists (terminal release). */
  action: RollbackAction | null;
  current_package_version: number | null;
  /** Null when blocked before it could be worked out. */
  resulting_package_version: number | null;
  /** Null when it could not be worked out; never assume empty arrays. */
  reconciled_keys: ReconciledKeys | null;
  blocked: RollbackBlocked | null;
  /** Set when this release was created by rolling back another one: that release's id (`rollback_chain`). */
  rollback_of?: string | null;
  /**
   * Package versions security-excluded on devices (see `TelemetrySummary.blocked_package_versions`). The
   * server still serves an excluded package after a rollback; upgraded SDKs refuse to run it. `null` when the
   * lookup failed; absent on an older server.
   */
  blocked_package_versions?: string[] | null;
}

/** Error thrown by clients for a non-2xx response. `body` is the parsed JSON error body, if any. */
export interface ApiError extends Error {
  status?: number;
  body?: Record<string, unknown>;
}

/** Subset of `GET /releases/{id}` the Control Center reads. */
export interface ReleaseDetail {
  id: string;
  created_at: ISO8601;
  /** Server warnings about targeting, returned by create, update and list. Not on the detail read. */
  warnings?: string[];
  config: { boot_timeout?: number; release_config_timeout?: number; properties?: Record<string, unknown> };
  package: { version: number; properties?: Record<string, unknown> };
  experiment: {
    experiment_id: string;
    experiment_variants: { control: string; experimentals: string[] };
    package_version: number;
    config_version: string;
    created_at: ISO8601;
    traffic_percentage: number;
    status: ReleaseStatus | (string & {});
  };
  dimensions: DimensionContext;
}

export interface OrgApplication {
  application: string;
}

/** Everything the UI needs from the server. Implemented by the API client. */
export interface ControlCenterClient {
  listOperations(org: string, app: string): Promise<{ operations: PendingOperation[] }>;
  resolveOperation(
    org: string,
    app: string,
    id: string,
    finding: "applied" | "did_not_apply",
    reason: string
  ): Promise<void>;
  getOverview(): Promise<Overview>;
  listGroups(org: string): Promise<GroupsResponse>;
  createGroup(org: string, body: GroupRequest): Promise<AppGroup>;
  updateGroup(org: string, id: string, body: GroupRequest): Promise<AppGroup>;
  deleteGroup(org: string, id: string): Promise<void>;
  listApplications(org: string): Promise<OrgApplication[]>;
  getRelease(org: string, app: string, releaseId: string): Promise<ReleaseDetail>;
  getReleaseEvents(org: string, app: string, releaseId: string): Promise<ReleaseEventsResponse>;
  rampRelease(org: string, app: string, releaseId: string, trafficPercentage: number): Promise<void>;
  concludeRelease(org: string, app: string, releaseId: string, chosenVariant: string): Promise<void>;
  getRollbackPreview(org: string, app: string, releaseId: string): Promise<RollbackPreview>;
  /** Read-only seven-day device report summary; the same object `/overview` embeds per app, read fresh. */
  getTelemetry(org: string, app: string): Promise<TelemetrySummary>;
  rollbackRelease(
    org: string,
    app: string,
    releaseId: string,
    reason: string,
    emergency?: EmergencyRollbackOptions
  ): Promise<RollbackResponse>;

  // Maker-checker. Every rule is enforced by the server; these calls only mirror its answers.
  getApprovalPolicy(org: string, app: string): Promise<ApprovalPolicy>;
  putApprovalPolicy(org: string, app: string, policy: ApprovalPolicy): Promise<ApprovalPolicy>;
  /** `app` null lists the whole organisation (the queue). */
  listDeploymentRequests(
    org: string,
    app: string | null,
    status?: DeploymentRequestStatus
  ): Promise<DeploymentRequestsResponse>;
  getDeploymentRequest(org: string, app: string, id: string): Promise<DeploymentRequest>;
  createDeploymentRequest(org: string, app: string, body: RaiseDeploymentRequest): Promise<DeploymentRequest>;
  decideDeploymentRequest(
    org: string,
    app: string,
    id: string,
    decision: RequestDecision,
    reason: string
  ): Promise<DeploymentRequest>;
  acknowledgeEmergency(org: string, app: string, releaseId: string, reason: string): Promise<void>;
  /** Users who could be makers or checkers: everyone with access to the application. */
  listPolicyCandidates(org: string, app: string): Promise<PolicyCandidate[]>;

  // Strict serving. Read-only preview; the PUT is refused with 403 approval_required under maker-checker.
  getServingPolicy(org: string, app: string): Promise<ServingPolicy>;
  putServingPolicy(org: string, app: string, strict: boolean): Promise<ServingPolicy>;
  previewServing(org: string, app: string, context: Record<string, string>, toss: string): Promise<ServingPreview>;
  /** Cache-only: repeats the CDN invalidation without repeating the deployment. */
  retryCacheInvalidation(org: string, app: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Anonymous device telemetry. Mirrors `airborne_docs/docs/server/control-center.md`
// ("Anonymous device telemetry") exactly. Every number is a count of distinct reporting installs
// in a seven-day window; none is verified, and none drives any server action.
// ---------------------------------------------------------------------------

export type TelemetryStatus = "seems_bad" | "suspicious_reports" | "no_signal" | "observed_only" | "insufficient_data";

export type TelemetryPlatform = "ios" | "android" | "web";

/** The server's verdict for one release row against its baseline. Pure advice. */
export interface TelemetrySignal {
  status: TelemetryStatus;
  /** The previous reported release for the same native version and platform; null means no baseline. */
  baseline_release_id: string | null;
  // Evidence. Absent when there is no baseline.
  crashes_up?: boolean;
  successes_down?: boolean;
  /** Booting devices needed on both sides before `seems_bad` is possible. */
  minimum_boot_devices?: number;
  boot_success_rate?: number;
  boot_failure_rate?: number;
  baseline_success_rate?: number;
  baseline_failure_rate?: number;
  automatic_action?: "none";
}

/** One release × native version × platform. Each count is distinct installs, so retries never inflate it. */
export interface TelemetryRelease {
  release_id: string;
  /** A string on the wire. */
  package_version: string;
  native_version: string;
  platform: TelemetryPlatform;
  /** Unix seconds. */
  release_created: number;
  reporting_devices: number;
  package_downloaded: number;
  boot_started: number;
  boot_success: number;
  boot_failed: number;
  rollback: number;
  blocked_package: number;
  /** Always 0 in v1 (there is no attestation), and a server may leave it out. Nothing displays it. */
  verified_reports?: number;
  unverified_reports: number;
  signal: TelemetrySignal;
}

export interface TelemetrySummary {
  window_days: number;
  verification: "unverified";
  automatic_action: "none";
  adoption_definition: string;
  /**
   * Package versions excluded on devices by a `security` marker, as strings, app-wide and monotonic. Only on the
   * dedicated `/control-center/telemetry` read, not in what `/overview` embeds. `null` when the lookup failed;
   * absent on an older server. Bundled code can never be in this list.
   */
  blocked_package_versions?: string[] | null;
  releases: TelemetryRelease[];
  release_totals?: TelemetryRelease[];
}

/** What `/overview` embeds per app: the summary, or why it could not be produced. */
export type AppTelemetry = TelemetrySummary | { error: string };

// ---------------------------------------------------------------------------
// Maker-checker. Mirrors MAKER-CHECKER-SPEC.md and the server's `maker_checker` module.
// ---------------------------------------------------------------------------

export type RollbackSensitiveReason = "security" | "one_way_migration";

/** Per application. Members are user subjects (emails), never display names. */
export interface ApprovalPolicy {
  enabled: boolean;
  makers: string[];
  checkers: string[];
  request_ttl_hours: number;
  emergency_rollback: boolean;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  enabled: false,
  makers: [],
  checkers: [],
  request_ttl_hours: 24,
  emergency_rollback: true,
};

export type DeploymentAction =
  | "create"
  | "ramp"
  | "conclude"
  | "update"
  | "rollback"
  | "discard"
  | "set_rollback_sensitive"
  /** Both directions of a strict-serving change; payload `{ body: { strict } }` with no release id. */
  | "set_strict_serving";

export type DeploymentRequestStatus =
  | "pending"
  | "executing"
  | "executed"
  | "failed"
  | "rejected"
  | "cancelled"
  | "expired"
  | "stale";

export type RequestDecision = "approve" | "reject" | "cancel";

/** The immutable payload. `body` is the exact request body the action would be made with. */
export interface DeploymentRequestPayload {
  release_id?: string;
  body?: Record<string, unknown>;
  /** Resolved by the server when the request was raised (overrides, files, package; or the rollback plan). */
  snapshot?: Record<string, unknown> | null;
}

/** One release as captured in `base_state.releases` when the request was raised. */
export interface BaseStateRelease {
  id: string;
  status?: string;
  traffic_percentage?: number;
  package_version?: number;
  config_version?: string;
  dimensions?: DimensionContext;
  [key: string]: unknown;
}

export interface DeploymentRequest {
  id: string;
  org: string;
  application: string;
  action: DeploymentAction;
  payload: DeploymentRequestPayload;
  payload_hash: string;
  /** What was live and active when the request was raised. Approval is refused if this has changed. */
  base_state: { releases?: BaseStateRelease[]; [key: string]: unknown } | null;
  requester: string;
  reason: string;
  status: DeploymentRequestStatus;
  expires_at: ISO8601;
  decided_by: string | null;
  decision_reason: string | null;
  created_at: ISO8601;
  updated_at: ISO8601;
  /** The executed action's response, or `{ error, recovery }` after a failed execution. */
  result: Record<string, unknown> | null;
  /** The package the request concerns: the bound release's, or the proposed one for create and update. */
  package_version?: number | null;
  /** The bound release's config version. Null for create (assigned on creation) and strict-serving changes. */
  config_version?: string | null;
}

export interface DeploymentRequestsResponse {
  requests: DeploymentRequest[];
}

export interface RaiseDeploymentRequest {
  action: DeploymentAction;
  payload: { release_id?: string; body?: Record<string, unknown> };
  reason: string;
}

/** An emergency rollback awaiting acknowledgement by a different checker. From `/overview`. */
export interface EmergencyReview {
  id: string;
  release_id: string;
  actor: string;
  acknowledged_by: string | null;
  reason?: string;
  created_at?: ISO8601;
  /** The replacement release the rollback created, once it exists. */
  new_release_id?: string | null;
  /** The rolled-back release's package and config, recorded when the emergency was raised. */
  package_version?: number | null;
  config_version?: string | null;
  /** True when the server wrote this review after the rollback finished. Absent on rows from older servers: outcome unknown. */
  rollback_finished?: boolean;
  rolled_back_to_package_version?: number | null;
  /** The complete rollback result, present with `rollback_finished`. */
  rollback_result?: Record<string, unknown> | null;
  /** The server's rollback plan: what was intended, not evidence of what happened. */
  plan?: { current_package_version?: number | null; resulting_package_version?: number | null } | null;
  confirm_sensitive_risk?: boolean;
  [key: string]: unknown;
}

export interface ReleaseProtection {
  release_id: string;
  rollback_sensitive: RollbackSensitiveReason | null;
}

export interface EmergencyRollbackOptions {
  emergency: true;
  /** Required by the server when the release is rollback-sensitive. */
  confirm_sensitive_risk?: boolean;
}

export interface PolicyCandidate {
  /** The subject the policy stores. */
  subject: string;
  username: string;
  email: string | null;
}

export interface ClientContext {
  token: string | null;
  logout?: () => void;
}
