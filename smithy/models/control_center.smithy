$version: "2.0"

namespace io.airborne.server

/// Supported application platforms for a Control Center group member.
enum ControlCenterPlatform {
    ANDROID = "android"
    IOS = "ios"
    WEB = "web"
    OTHER = "other"
}

/// A group member identifies an application and the platform label shown in Control Center.
structure ControlCenterGroupMember {
    @required
    application: String

    @required
    platform: ControlCenterPlatform
}

list ControlCenterGroupMemberList {
    member: ControlCenterGroupMember
}

/// Request body used to create or replace a group's name and complete member list.
structure ControlCenterGroupRequest {
    /// Group name; must contain a non-whitespace character.
    @required
    @length(min: 1)
    name: String

    /// Complete membership list. Updates replace the existing list.
    @required
    members: ControlCenterGroupMemberList
}

/// A configured application group.
structure ControlCenterGroup {
    /// UUID identifying the group.
    @required
    id: String

    @required
    name: String

    @required
    members: ControlCenterGroupMemberList
}

list ControlCenterGroupList {
    member: ControlCenterGroup
}

structure ListControlCenterGroupsResponse {
    @required
    groups: ControlCenterGroupList
}

/// A release that is currently live for one dimensions context.
structure ControlCenterLiveRelease {
    @required
    release_id: String

    @required
    package_version: Long

    @required
    config_version: String

    @required
    dimensions: Document

    /// RFC 3339 timestamp for the concluded live release.
    @required
    @timestampFormat("date-time")
    concluded_at: Timestamp
}

list ControlCenterLiveReleaseList {
    member: ControlCenterLiveRelease
}

/// A release that is created or currently in progress.
structure ControlCenterActiveRelease {
    @required
    release_id: String

    @required
    package_version: Long

    @required
    status: String

    @required
    traffic_percentage: Integer

    /// Exact variant identifier of the experimental variant; conclude requires this value.
    @required
    experimental_variant: String

    @required
    dimensions: Document

    @required
    @timestampFormat("date-time")
    created_at: Timestamp

    @required
    created_by: String
}

list ControlCenterActiveReleaseList {
    member: ControlCenterActiveRelease
}

/// Release state for one application, including per-application lookup failures.
structure ControlCenterAppStatus {
    /// Local auxiliary data unavailable or deadline exceeded; corresponding fields are null.
    auxiliary_error: String
    telemetry: Document
    cache_invalidation: Document
    /// Stored policy plus deployment force-on override.
    serving_policy: ServingPolicy

    @required
    application: String

    /// Platform label from the containing group; JSON null for an ungrouped application.
    @required
    platform: Document

    @required
    live: ControlCenterLiveReleaseList

    @required
    active: ControlCenterActiveReleaseList

    /// Unresolved upstream writes. While any item exists, writes are paused for this application.
    unresolved_operations: ControlCenterUnresolvedOperationList

    /// RFC 3339 timestamp, or JSON null when the application has no release activity.
    @required
    last_activity_at: Document

    /// Sanitized lookup failure message, or JSON null when lookup succeeded.
    @required
    error: Document

    /// Whether this application currently requires a separate checker for protected writes.
    approval_required: Boolean

    /// Number of pending requests. This count is not capped by the queue list limit.
    pending_requests: Integer

    /// Emergency rollbacks waiting for independent checker acknowledgement.
    emergency_needs_review: EmergencyReviewList

    /// Local rollback sensitivity markers for releases.
    release_protections: ReleaseProtectionList
}

/// An upstream write whose outcome has not been confirmed.
structure ControlCenterUnresolvedOperation {
    @required
    operation_id: String

    @required
    message: String



}

list ControlCenterUnresolvedOperationList {
    member: ControlCenterUnresolvedOperation
}

list ControlCenterAppStatusList {
    member: ControlCenterAppStatus
}

/// A group and its release status entries in the overview response.
structure ControlCenterOverviewGroup {
    @required
    id: String

    @required
    name: String

    @required
    members: ControlCenterAppStatusList
}

list ControlCenterOverviewGroupList {
    member: ControlCenterOverviewGroup
}

structure ControlCenterOrganisationOverview {
    @required
    name: String

    @required
    groups: ControlCenterOverviewGroupList

    @required
    ungrouped: ControlCenterAppStatusList
}

list ControlCenterOrganisationOverviewList {
    member: ControlCenterOrganisationOverview
}

structure GetControlCenterOverviewResponse {
    @required
    @timestampFormat("date-time")
    generated_at: Timestamp

    @required
    organisations: ControlCenterOrganisationOverviewList
}

/// A group UUID path parameter and the organisation whose group is being changed.
structure ControlCenterGroupPath {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String
}

/// Input for creating a group.
structure CreateControlCenterGroupInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @length(min: 1)
    name: String

    @required
    members: ControlCenterGroupMemberList
}

/// Input for replacing a group's name and members.
structure UpdateControlCenterGroupInput {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @length(min: 1)
    name: String

    @required
    members: ControlCenterGroupMemberList
}

structure DeleteControlCenterGroupResponse {
    @required
    success: Boolean
}

/// Release identifier, organisation, and application used to fetch a release timeline.
structure ControlCenterReleaseEventsInput {
    @required
    @httpLabel
    release_id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String
}

/// Recorded timeline action. The timeline can also include synthetic created/concluded/discarded entries.
enum ControlCenterReleaseEventAction {
    CREATED = "created"
    RAMPED = "ramped"
    CONCLUDED = "concluded"
    DISCARDED = "discarded"
    ROLLED_BACK = "rolled_back"
    OPERATION_RESOLVED = "operation_resolved"
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    STALE = "stale"
    EXECUTED = "executed"
    FAILED = "failed"
    EMERGENCY_ROLLBACK = "emergency_rollback"
    EMERGENCY_ACKNOWLEDGED = "emergency_acknowledged"
    POLICY_CHANGED = "policy_changed"
}

structure ControlCenterReleaseEvent {
    @required
    action: ControlCenterReleaseEventAction

    @required
    actor: String

    @required
    @timestampFormat("date-time")
    created_at: Timestamp

    @required
    payload: Document

    @required
    synthetic: Boolean
}

list ControlCenterReleaseEventList {
    member: ControlCenterReleaseEvent
}

/// Server-computed outcome of a release. Clients must use this value rather than infer it from the events.
enum ControlCenterReleaseOutcome {
    /// Created or in progress.
    ACTIVE = "active"
    /// Concluded on the experimental variant and still the latest live release for its dimensions.
    LIVE = "live"
    /// Concluded on the experimental variant but replaced by a later live release.
    SUPERSEDED = "superseded"
    /// Concluded with the control variant, so the experimental variant never went live.
    CONCLUDED_ON_CONTROL = "concluded_on_control"
    /// Discarded before it went live.
    DISCARDED = "discarded"
}

structure GetControlCenterReleaseEventsResponse {
    @required
    events: ControlCenterReleaseEventList

    @required
    outcome: ControlCenterReleaseOutcome
}

/// Rollback reason. Whitespace-only values are rejected. The reason must not contain the reserved, case-sensitive text `Airborne operation`: Airborne appends a generated suffix made of `[Airborne operation `, a canonical UUID and `]` to the reason it sends upstream, and the combined text must fit Superposition's 255-byte limit, so a reason is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
structure RollbackReleaseRequest {
    @required
    @length(min: 1)
    reason: String

    /// Use only for the constrained emergency rollback path.
    emergency: Boolean

    /// Required when the latest live source is marked rollback-sensitive.
    confirm_sensitive_risk: Boolean
}

/// Path, scope headers, and reason for a release rollback request.
structure RollbackReleaseInput {
    @required
    @httpLabel
    release_id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    /// The reason must not contain the reserved, case-sensitive text "Airborne operation": Airborne appends a generated suffix made of "[Airborne operation ", a canonical UUID and "]" to the reason it sends upstream, and the combined text must fit Superposition's 255-byte limit, so a reason is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    @required
    @length(min: 1)
    reason: String

    /// Use only for the constrained emergency rollback path.
    emergency: Boolean

    /// Required when the latest live source is marked rollback-sensitive.
    confirm_sensitive_risk: Boolean
}

enum RollbackReleaseAction {
    DISCARDED = "discarded"
    CONCLUDED_CONTROL = "concluded_control"
    RERELEASED = "rereleased"
}

/// How the configuration of a re-released rollback was reconciled with the currently registered keys.
structure ReconciledKeys {
    /// Keys registered after the historical release; they keep their current value.
    @required
    kept_current: StringList

    /// Keys in the historical release that are no longer registered; they are dropped.
    @required
    dropped: StringList
}

structure RollbackReleaseResponse {
    @required
    action: RollbackReleaseAction

    @required
    release_id: String

    /// Control package version, historical package version, or JSON null if unavailable.
    @required
    rolled_back_to_package_version: Document

    /// Replacement release identifier, or JSON null when rollback does not create one.
    @required
    new_release_id: Document

    /// Config reconciliation result, sorted. Both lists are empty when the rollback discards or concludes on control.
    @required
    reconciled_keys: ReconciledKeys

    /// Current live release in the same dimensions context, or JSON null.
    current_live_release_id: Document

    /// A later unrelated live release, or JSON null. Completed retries still report the recorded rollback as successful.
    later_release_id: Document
}

/// Read-authorized path and application scope for rollback preview.
structure RollbackPreviewInput {
    @required
    @httpLabel
    release_id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String
}

enum RollbackPreviewBlockedCode {
    SUPERSEDED = "superseded"
    ONGOING = "ongoing"
    NO_PREDECESSOR = "no_predecessor"
    INCOMPATIBLE = "incompatible"
    UNRESOLVED = "unresolved"
}

/// Why preview cannot safely proceed. Diagnostic identifiers are JSON null when they do not apply.
structure RollbackPreviewBlocked {
    @required
    code: RollbackPreviewBlockedCode

    @required
    message: String

    @required
    current_live_release_id: Document

    operation_id: Document

    replacement_release_id: Document
}

/// Side-effect-free rollback decision. Action, resulting package, reconciliation details and blocked are nullable when unavailable.
structure RollbackPreviewResponse {
    blocked_package_versions: StringList
    @required
    action: Document

    @required
    current_package_version: Document

    @required
    resulting_package_version: Document

    @required
    reconciled_keys: Document

    @required
    blocked: Document
}

/// Path and organisation header for listing groups.
structure ListControlCenterGroupsInput {
    @required
    @httpHeader("x-organisation")
    organisation: String
}

/// List unresolved write operations for one application. "status" is currently "unresolved".
structure ListControlCenterOperationsInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    @httpQuery("status")
    status: String
}

structure ControlCenterUnresolvedOperationDetails {
    @required
    code: String

    @required
    operation_id: String

    @required
    message: String




}

list ControlCenterUnresolvedOperationDetailsList {
    member: ControlCenterUnresolvedOperationDetails
}

structure ListControlCenterOperationsResponse {
    @required
    operations: ControlCenterUnresolvedOperationDetailsList
}

enum OperationRecoveryFinding {
    DID_NOT_APPLY = "did_not_apply"
    APPLIED = "applied"
}

structure ResolveControlCenterOperationInput {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    @required
    finding: OperationRecoveryFinding

    /// Required and non-blank; the operator's reason is recorded in the audit event. It must not contain the reserved text "Airborne operation"; such a reason returns 400.
    @required
    @length(min: 1)
    reason: String

    /// Must be true for did_not_apply. The operator confirms the original request cannot execute later.
    request_terminated: Boolean
}

enum ResolvedOperationState {
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
}

structure ResolveControlCenterOperationResponse {
    @required
    operation_id: String

    @required
    state: ResolvedOperationState

    @required
    finding: OperationRecoveryFinding
}

/// Overview is user-scoped and does not require organisation/application scope headers.
structure GetControlCenterOverviewInput {}

/// Create a group with a name and full member list. Requires Bearer authentication and an x-organisation header. Only organisation admins/owners can create groups.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/groups")
@requiresauth
operation CreateControlCenterGroup {
    input: CreateControlCenterGroupInput
    output: ControlCenterGroup
    errors: [Unauthorized ForbiddenError BadRequestError InternalServerError NotFoundError]
}

/// Delete a group by UUID. Requires Bearer authentication and x-organisation. Only organisation admins/owners can delete groups.
@tags(["Control Center"])
@http(method: "DELETE", uri: "/api/control-center/groups/{id}")
@requiresauth
operation DeleteControlCenterGroup {
    input: ControlCenterGroupPath
    output: DeleteControlCenterGroupResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError InternalServerError]
}

/// Return the authenticated user's release overview across accessible organisations and applications. No x-organisation or x-application header is required.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/overview")
@requiresauth
@readonly
operation GetControlCenterOverview {
    input: GetControlCenterOverviewInput
    output: GetControlCenterOverviewResponse
    errors: [Unauthorized InternalServerError BadRequestError NotFoundError ForbiddenError]
}

/// List groups for the organisation in x-organisation. Member applications are filtered to those the caller can read. Requires Bearer authentication.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/groups")
@requiresauth
@readonly
operation ListControlCenterGroups {
    input: ListControlCenterGroupsInput
    output: ListControlCenterGroupsResponse
    errors: [Unauthorized ForbiddenError BadRequestError InternalServerError NotFoundError]
}

/// List unresolved upstream write outcomes for an application. Requires Bearer authentication, scope headers, and release read access.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/operations")
@requiresauth
@readonly
operation ListControlCenterOperations {
    input: ListControlCenterOperationsInput
    output: ListControlCenterOperationsResponse
    errors: [Unauthorized ForbiddenError BadRequestError InternalServerError NotFoundError]
}

/// Resolve an unresolved operation after upstream verification. Only organisation owners/admins or super admins may recover. applied needs positive evidence of the expected change, matched through the operation's generated marker in current upstream state or its audit history. did_not_apply needs the experiment and the application's workspace configuration (defaults, contexts, overrides) to be unchanged from the values saved before the write, plus the operator's confirmation that the original request has terminated. A 409 names the changed config keys or contexts: restore them, or finish the intended change and resolve as applied. Operations created before this evidence was saved cannot be resolved as did_not_apply. The reason must not contain the reserved text "Airborne operation". Markers are not authenticated provenance: anyone who can write to Superposition directly can forge one, so restrict direct upstream write access to trusted operators.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/operations/{id}/resolve")
@requiresauth
operation ResolveControlCenterOperation {
    input: ResolveControlCenterOperationInput
    output: ResolveControlCenterOperationResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError InternalServerError]
}

/// Replace a group's name and complete member list. Requires Bearer authentication and x-organisation. Only organisation admins/owners can update groups.
@tags(["Control Center"])
@http(method: "PUT", uri: "/api/control-center/groups/{id}")
@requiresauth
operation UpdateControlCenterGroup {
    input: UpdateControlCenterGroupInput
    output: ControlCenterGroup
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError InternalServerError]
}

/// Return the ordered audit timeline for a release. Requires Bearer authentication plus x-organisation and x-application headers.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/releases/{release_id}/events")
@requiresauth
@readonly
operation GetControlCenterReleaseEvents {
    input: ControlCenterReleaseEventsInput
    output: GetControlCenterReleaseEventsResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError InternalServerError]
}

/// Compute the rollback decision and package/config reconciliation without persisting an operation or changing upstream, audit, journal, or cache state. Requires release read permission and organisation/application scope headers.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/releases/{release_id}/rollback-preview")
@requiresauth
@readonly
operation GetControlCenterRollbackPreview {
    input: RollbackPreviewInput
    output: RollbackPreviewResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError InternalServerError]
}

/// Roll back a release according to its lifecycle state. Writes are durable and retries of a completed operation return its recorded success, including later unrelated live-release diagnostics. Unknown upstream outcomes return 409 unresolved and require real-state/operator review; changed replacements return 409 replacement_changed and must not be resumed automatically. Re-release only works while the source is the latest live release for its dimensions. Requires Bearer authentication plus x-organisation and x-application; callers need release write/conclude permission.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases/{release_id}/rollback")
@requiresauth
operation RollbackRelease {
    input: RollbackReleaseInput
    output: RollbackReleaseResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError ReleaseSupersededError UnresolvedOperationError RollbackReplacementChangedError RollbackUnprocessableError InternalServerError RollbackPartialFailureError ApprovalRequiredError]
}
