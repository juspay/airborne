$version: "2.0"

namespace io.airborne.server

/// A declared reason a release must retain additional rollback protection.
enum RollbackSensitiveReason {
    SECURITY = "security"
    ONE_WAY_MIGRATION = "one_way_migration"
}

/// Complete application approval policy. PUT replaces the policy; omitted fields use server defaults.
structure ControlCenterApprovalPolicy {
    @required
    enabled: Boolean

    /// Sorted unique canonical identity subjects.
    @required
    makers: StringList

    /// Sorted unique canonical identity subjects.
    @required
    checkers: StringList

    /// Request lifetime in hours, from 1 through 720.
    @required
    @range(min: 1, max: 720)
    request_ttl_hours: Integer

    @required
    emergency_rollback: Boolean
}

structure GetControlCenterApprovalPolicyInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String
}

structure UpdateControlCenterApprovalPolicyInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    enabled: Boolean

    makers: StringList

    checkers: StringList

    @range(min: 1, max: 720)
    request_ttl_hours: Integer

    emergency_rollback: Boolean
}

/// Supported approved release mutation.
enum DeploymentRequestAction {
    CREATE = "create"
    UPDATE = "update"
    RAMP = "ramp"
    CONCLUDE = "conclude"
    DISCARD = "discard"
    ROLLBACK = "rollback"
    SET_STRICT_SERVING = "set_strict_serving"
    SET_ROLLBACK_SENSITIVE = "set_rollback_sensitive"
}

enum DeploymentRequestStatus {
    PENDING = "pending"
    EXECUTING = "executing"
    EXECUTED = "executed"
    FAILED = "failed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    STALE = "stale"
}

/// Request payload accepted from the maker. The body is action-specific and is frozen by the server.
structure DeploymentRequestInputPayload {
    body: Document
    release_id: String
}

/// Frozen action payload returned by the server, including its resolved immutable snapshot.
structure DeploymentRequestPayload {
    body: Document
    release_id: String
    snapshot: Document
}

/// Create a deployment request. The client may send only action, payload and reason; the server resolves requester, snapshot and base state.
structure CreateControlCenterDeploymentRequestInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    @required
    action: DeploymentRequestAction

    @required
    payload: DeploymentRequestInputPayload

    /// Nonblank maker explanation. Reserved "Airborne operation" text is refused.
    @required
    @length(min: 1)
    reason: String
}

/// Immutable deployment request and its latest decision/result.
structure ControlCenterDeploymentRequest {
    /// UUID.
    @required
    id: String

    @required
    org: String

    @required
    application: String

    @required
    action: DeploymentRequestAction

    @required
    payload: DeploymentRequestPayload

    /// Lowercase hexadecimal SHA-256 digest of the immutable approved content.
    @required
    payload_hash: String

    /// Snapshot of application release/config state at request creation. Keep as a document; it is not an editable approval body.
    @required
    base_state: Document

    @required
    requester: String

    @required
    reason: String

    @required
    status: DeploymentRequestStatus

    @required
    expires_at: Timestamp

    /// Subject of the latest decision, or JSON null.
    @required
    decided_by: Document

    /// Decision explanation, or JSON null.
    @required
    decision_reason: Document

    @required
    created_at: Timestamp

    @required
    updated_at: Timestamp

    /// Existing action execution result or JSON null.
    @required
    result: Document
}

list ControlCenterDeploymentRequestList {
    member: ControlCenterDeploymentRequest
}

structure ListControlCenterDeploymentRequestsResponse {
    @required
    requests: ControlCenterDeploymentRequestList
}

structure ListControlCenterDeploymentRequestsInput {
    @required
    @httpHeader("x-organisation")
    organisation: String

    /// Optional: omit x-application to list readable requests across the organisation. Filter is applied before the 1,000 newest-row cap.
    @httpHeader("x-application")
    application: String

    @httpQuery("status")
    status: DeploymentRequestStatus
}

structure GetControlCenterDeploymentRequestInput {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String
}

structure ApproveControlCenterDeploymentRequestInput {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    reason: String
}

structure RejectControlCenterDeploymentRequestInput {
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
    @length(min: 1)
    reason: String
}

structure CancelControlCenterDeploymentRequestInput {
    @required
    @httpLabel
    id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    reason: String
}

/// A pending emergency rollback awaiting an independent review.
structure EmergencyReview {
    /// Present for new successful emergencies; absent on legacy rows.
    rollback_finished: Boolean
    rolled_back_to_package_version: Document
    rollback_result: Document
    new_release_id: Document
    @required
    id: String

    @required
    release_id: String

    @required
    actor: String

    @required
    acknowledged_by: Document

    @required
    reason: String

    @required
    confirm_sensitive_risk: Boolean

    @required
    plan: Document

    @required
    created_at: Timestamp
}

list EmergencyReviewList {
    member: EmergencyReview
}

structure ReleaseProtection {
    @required
    release_id: String

    /// Explicitly cleared markers are represented as JSON null.
    @required
    rollback_sensitive: Document
}

list ReleaseProtectionList {
    member: ReleaseProtection
}

structure AcknowledgeEmergencyRollbackInput {
    @required
    @httpLabel
    release_id: String

    @required
    @httpHeader("x-organisation")
    organisation: String

    @required
    @httpHeader("x-application")
    application: String

    /// Independent review explanation; must be nonblank.
    @required
    @length(min: 1)
    reason: String
}

structure AcknowledgeEmergencyRollbackResponse {
    @required
    success: Boolean
}

/// Return the application's current approval policy. An absent row returns disabled, empty rosters, a 24-hour TTL and emergency rollback enabled.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/approval-policy")
@requiresauth
@readonly
operation GetControlCenterApprovalPolicy {
    input: GetControlCenterApprovalPolicyInput
    output: ControlCenterApprovalPolicy
    errors: [Unauthorized ForbiddenError BadRequestError InternalServerError]
}

/// Replace the application's approval policy. Only actual organisation owners/admins may edit it. Roster identities must be enabled Keycloak users with app access and ordinary release permissions. Enabling requires at least two distinct subjects and a different eligible checker for each maker. Returns 409 until the operator deployment readiness fence is attested after all old instances and writes are drained.
@tags(["Control Center"])
@http(method: "PUT", uri: "/api/control-center/approval-policy")
@requiresauth
operation UpdateControlCenterApprovalPolicy {
    input: UpdateControlCenterApprovalPolicyInput
    output: ControlCenterApprovalPolicy
    errors: [Unauthorized ForbiddenError BadRequestError ConflictError InternalServerError]
}

/// List the newest deployment requests. Status filtering precedes the 1,000-row cap. Omit x-application to list across the organisation, with per-application read filtering.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/deployment-requests")
@requiresauth
@readonly
operation ListControlCenterDeploymentRequests {
    input: ListControlCenterDeploymentRequestsInput
    output: ListControlCenterDeploymentRequestsResponse
    errors: [Unauthorized ForbiddenError BadRequestError InternalServerError]
}

/// Raise an immutable deployment request. The server resolves and freezes the snapshot, hashes it and records the authenticated subject as requester.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/deployment-requests")
@requiresauth
operation CreateControlCenterDeploymentRequest {
    input: CreateControlCenterDeploymentRequestInput
    output: ControlCenterDeploymentRequest
    errors: [Unauthorized ForbiddenError BadRequestError ConflictError InternalServerError]
}

/// Fetch one request by UUID independently of queue pagination. Both scope headers are required.
@tags(["Control Center"])
@http(method: "GET", uri: "/api/control-center/deployment-requests/{id}")
@requiresauth
@readonly
operation GetControlCenterDeploymentRequest {
    input: GetControlCenterDeploymentRequestInput
    output: ControlCenterDeploymentRequest
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError InternalServerError]
}

/// Approve and immediately execute a pending request. The checker must be currently eligible and different from the immutable requester.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/deployment-requests/{id}/approve")
@requiresauth
operation ApproveControlCenterDeploymentRequest {
    input: ApproveControlCenterDeploymentRequestInput
    output: ControlCenterDeploymentRequest
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError UnresolvedOperationError InternalServerError RollbackPartialFailureError RollbackUnprocessableError]
}

/// Reject a request. A checker may reject their own request; a reason is required.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/deployment-requests/{id}/reject")
@requiresauth
operation RejectControlCenterDeploymentRequest {
    input: RejectControlCenterDeploymentRequestInput
    output: ControlCenterDeploymentRequest
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError InternalServerError]
}

/// Cancel a request. Only its requester may cancel it.
@tags(["Control Center"])
@http(method: "POST", uri: "/api/control-center/deployment-requests/{id}/cancel")
@requiresauth
operation CancelControlCenterDeploymentRequest {
    input: CancelControlCenterDeploymentRequestInput
    output: ControlCenterDeploymentRequest
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError InternalServerError]
}

/// Independently acknowledge the emergency rollback for its source release. Only a different current checker may acknowledge it.
@tags(["Releases"])
@http(method: "POST", uri: "/api/releases/{release_id}/acknowledge-emergency")
@requiresauth
operation AcknowledgeEmergencyRollback {
    input: AcknowledgeEmergencyRollbackInput
    output: AcknowledgeEmergencyRollbackResponse
    errors: [Unauthorized ForbiddenError BadRequestError NotFoundError ConflictError InternalServerError]
}
