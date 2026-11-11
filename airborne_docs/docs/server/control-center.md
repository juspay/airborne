---
title: Control Center API
description: Server routes, access requirements, and data used by Airborne Control Center.
---

The Control Center API provides a user-wide release overview, organisation-owned application groups, per-release event history, release rollback, recovery for upstream writes with unknown outcomes, and per-application maker-checker policy and request workflows. All routes require an `Authorization` header with a Bearer token. JSON request bodies use `Content-Type: application/json`.

## Routes and access

| Method and route | Scope headers | Access |
| --- | --- | --- |
| `GET /api/control-center/overview` | None | Any authenticated user; results include only organisations and applications the user can read. |
| `GET /api/control-center/groups` | `x-organisation` | Organisation scope required; each member application is filtered by release read access. |
| `POST /api/control-center/groups` | `x-organisation` | Organisation owner or admin. |
| `PUT /api/control-center/groups/{id}` | `x-organisation` | Organisation owner or admin. Replaces the entire member list. |
| `DELETE /api/control-center/groups/{id}` | `x-organisation` | Organisation owner or admin. |
| `GET /api/control-center/releases/{release_id}/events` | `x-organisation`, `x-application` | Release read access in the selected application. |
| `GET /api/control-center/releases/{release_id}/rollback-preview` | `x-organisation`, `x-application` | Release read access in the selected application; read-only preview. |
| `GET /api/control-center/operations?status=unresolved` | `x-organisation`, `x-application` | Release read access in the selected application; lists unresolved write outcomes. |
| `POST /api/control-center/operations/{id}/resolve` | `x-organisation`, `x-application` | Organisation owner/admin or super admin; verifies and audits a recovery finding. |
| `POST /api/releases/{release_id}/rollback` | `x-organisation`, `x-application` | Release write/conclude access in the selected application. |
| `GET /api/control-center/approval-policy` | `x-organisation`, `x-application` | Authenticated caller with scope access. |
| `PUT /api/control-center/approval-policy` | `x-organisation`, `x-application` | Actual organisation owner/admin; maker-checker deployment fence must be attested before enabling. |
| `GET /api/control-center/deployment-requests?status=pending` | `x-organisation`; optional `x-application` | Read access to each listed application. Without application scope, lists readable requests across the organisation. |
| `POST /api/control-center/deployment-requests` | `x-organisation`, `x-application` | Eligible maker and ordinary release permissions. |
| `GET /api/control-center/deployment-requests/{id}` | `x-organisation`, `x-application` | Read access; independently scoped by UUID, not limited by queue pagination. |
| `POST /api/control-center/deployment-requests/{id}/approve` | `x-organisation`, `x-application` | Current eligible checker other than immutable requester; ordinary execution permissions also apply. |
| `POST /api/control-center/deployment-requests/{id}/reject` | `x-organisation`, `x-application` | Current checker; a checker may reject their own request. Reason required. |
| `POST /api/control-center/deployment-requests/{id}/cancel` | `x-organisation`, `x-application` | Requester only. |
| `POST /api/releases/{source_release_id}/acknowledge-emergency` | `x-organisation`, `x-application` | A different current checker with an independent review reason. |

`{id}` is a group UUID. `release_id` is the Superposition experiment/release identifier. The overview route uses the authenticated user's access inventory and does not take organisation or application scope headers.

## Group request and response

Create and update accept a group name and the full membership list. An update replaces all existing members. `platform` must be `android`, `ios`, `web`, or `other`; every application must already exist in the selected organisation. Names must contain a non-whitespace character.

```json
{
  "name": "Mobile apps",
  "members": [
    { "application": "sample-android", "platform": "android" },
    { "application": "sample-ios", "platform": "ios" }
  ]
}
```

Create and update return the group shape; delete returns `{ "success": true }`. Group-list responses are `{ "groups": [...] }`. The group member list contains `application` and `platform`; it does not embed release status. Overview responses include status entries under each group's `members`.

## Maker-checker policy and requests

Policies are per application. An absent policy returns:

```json
{"enabled":false,"makers":[],"checkers":[],"request_ttl_hours":24,"emergency_rollback":true}
```

`PUT /api/control-center/approval-policy` replaces the complete object. Omitted properties take defaults. `makers` and `checkers` are sorted unique canonical subjects; `request_ttl_hours` is an integer from 1 through 720. Unknown properties return `400`. Only an actual organisation owner/admin may change it, including when the actor is a super admin. Members must be enabled Keycloak users with application access and ordinary release create/ramp/conclude/update permissions. Other AuthN providers fail closed until they have an identity-directory adapter. Enabling needs at least two distinct subjects and a different eligible checker for each maker. Invalid rosters/TTL return `400`, authority or identity failures return `403`, and the deployment fence returns `409`. Both before and after policy values are audited.

The authenticated canonical subject is immutable requester identity. No user can approve their own request, including owners, admins and super admins. An API token acts as its owner. A checker can reject their own request because rejection makes no change. A requester may cancel their own request. Removing a roster member takes effect on the next decision; immutable requester identity is not rewritten. Disabling cancels pending work in the same transaction as the policy audit.

Create a request with only `action`, `payload`, and `reason`; unknown top-level or payload properties are refused. `reason` must be nonblank and cannot contain reserved `Airborne operation` text. For `create`, payload has `body`; for every other action it has `release_id` and `body`. Actions are `create`, `update`, `ramp`, `conclude`, `discard`, `rollback`, and `set_rollback_sensitive`. Bodies match the existing create-release input, the action-specific traffic/chosen variant/reason fields, an empty object for rollback, or the nullable marker field for marker changes. The server resolves the snapshot. Clients cannot send `snapshot`, `payload_hash`, `requester`, or base state.

Responses preserve `payload.snapshot` and `base_state` as JSON documents; clients should display them as frozen evidence and must not reserialize them as an editable approval body. The response includes a 64-character lowercase SHA-256 payload hash, canonical requester, expiry, decision fields, timestamps, status, and result. Approval revalidates current membership, ordinary permissions, expiry and freshness, then executes immediately. Competing decisions return `409`. Expired/stale approval returns `409` and records the terminal status. Failed requests may be approved again only after recovery and all current-state/eligibility checks; an interrupted `executing` request is never automatically replayed.

Freshness is app-wide and includes release/config/protection revisions, so unrelated app changes can make a request stale. Queue status filtering runs before its 1,000 newest-row limit. Omit `x-application` to list across the organisation, with per-app read filtering. Overview pending counts are not capped by the list limit. UUID lookup requires both scope headers and is independent of pagination. Wrong org/app is `404`; a caller without the header scope is `403`.

## Emergency rollback controls

The existing rollback body accepts optional booleans `emergency` and `confirm_sensitive_risk`, both defaulting to `false`, alongside the required `reason`. Emergency mode requires enabled policy, enabled emergency rollback, current checker membership, ordinary release permission, a nonblank reason, and the latest live source. It restores only the compatible predecessor; clients cannot choose a target. A sensitive source additionally requires `confirm_sensitive_risk: true`. The existing rollback response is unchanged.

Emergency rollback records a needs-review item after a successful rollback. A different current checker must independently acknowledge it with `POST /api/releases/{source_release_id}/acknowledge-emergency` and `{"reason":"Independent incident review"}`. The path ID is the source release, not its replacement. A missing review returns `404`; same operator/non-checker returns `403`; an unresolved earlier review prevents another emergency (`409`). Failed or interrupted attempts create no review; inspect and resume through the operation journal.

Direct calls that would require approval return `403`:

```json
{"code":"approval_required","application":"app","message":"Approval required for app. Raise a request with POST /api/control-center/deployment-requests"}
```

Normal `400`, `401`, `403`, `404`, and `409` errors remain; rollback may also return its existing `422`, `502`, unresolved, or partial-operation details.

## Overview response

`GET /api/control-center/overview` returns `{ "generated_at": "<RFC3339>", "organisations": [...] }`. Each organisation has `name`, `groups`, and `ungrouped`. A group contains `id`, `name`, and `members`; `ungrouped` contains applications that are not assigned to a group.

An application status entry has these fields:

| Field | Meaning |
| --- | --- |
| `application` | Application name. |
| `platform` | Group platform label, or `null` for an ungrouped app. |
| `live` | Latest experimental-chosen concluded release for each dimensions context. Each item has `release_id`, `package_version`, `config_version`, `dimensions`, and `concluded_at`. |
| `active` | Releases in `CREATED` or `INPROGRESS`, with `release_id`, `package_version`, `status`, `traffic_percentage`, `experimental_variant`, `dimensions`, `created_at`, and `created_by`. `experimental_variant` is the exact variant ID of the release's experimental variant; use it verbatim when concluding the release. |
| `unresolved_operations` | Unresolved upstream write outcomes for this app. Each item has `operation_id`, optional `code`, and `message`. Any item means all release writes for this app are paused. `null` means the journal could not be read, never no pending operations. |
| `auxiliary_error` | Approval, policy, cache or journal metadata is unreadable. Valid Live and Active panels remain available. |
| `last_activity_at` | Most recent release modification time, or `null` when no activity exists. |
| `error` | Sanitized message if that application's lookup fails, times out or does not finish before the overview deadline, otherwise `null`. A failed app has empty `live` and `active` arrays. |
| `approval_required` | `true` when protected writes require an approved request. |
| `pending_requests` | Current pending count; not capped by the queue limit. |
| `emergency_needs_review` | Array of emergency review records, not a count or boolean. Each includes the review UUID, source release ID, actor, acknowledgement subject or `null`, reason, sensitive-risk confirmation, rollback plan, and creation time. |
| `release_protections` | Array of local release marker records. An explicitly cleared marker may be `null`. |

The overview loads each accessible app independently; an app lookup failure is represented in that app's `error` field and does not remove other app results. Release lifecycle state is read from Superposition.

The whole request has a single five-second deadline that covers the access summary, group metadata and every release lookup. Each lookup also has its own two-second limit, and lookups for all organisations share one pool of eight, queued round-robin so one slow organisation cannot starve the others. Every accessible app starts as a failed lookup and is replaced when its lookup completes. When the deadline passes, apps that have not finished (or were still queued) stay in the response with a non-null `error` and empty `live` and `active` arrays, so a response is never missing an app the caller can read. The unresolved-operation list is loaded separately from durable Airborne state and remains available if the Superposition overview lookup fails. If the access summary itself cannot be completed within the deadline, the request fails with `500` instead of guessing what the caller may see.

Group metadata is only returned to callers who may read groups in the organisation. A caller who can read an app but not the organisation's groups still sees that app, listed under `ungrouped` with `platform: null` and no group name or ID.

## Release history and persistence

`GET /api/control-center/releases/{release_id}/events` returns `{ "events": [...], "outcome": "..." }`. Events have `action`, `actor`, `created_at`, `payload`, and `synthetic`. Existing actions include `created`, `ramped`, `concluded`, `discarded`, `rolled_back`, and `operation_resolved`; maker-checker adds `requested`, `approved`, `rejected`, `cancelled`, `expired`, `stale`, `executed`, `failed`, `emergency_rollback`, `emergency_acknowledged`, and `policy_changed`. Request and policy events use the same audit table, but may have an empty release ID, so inspect request and queue endpoints for request history rather than expecting every policy event on a release timeline. Policy event payloads contain `before` and `after`; decision events contain the request object. Recovery event payloads include the operation ID, finding, reason, request-termination attestation, and upstream verification. The server may synthesize missing `created` or terminal events for older releases that predate the audit log; those entries have `synthetic: true`.

`outcome` is computed by the server from the release's real state; clients should display it and not infer it from the events. It is one of:

| `outcome` | Meaning |
| --- | --- |
| `active` | The release is `CREATED` or `INPROGRESS`. |
| `live` | The release concluded on its experimental variant and is still the latest live release for its dimensions. |
| `superseded` | The release concluded on its experimental variant, but a later release is now live for the same dimensions. |
| `concluded_on_control` | The release concluded on its control variant, so it never went live. |
| `discarded` | The release was discarded. |

If the request fails, no outcome is known; do not show one.

Superposition is the source of truth for release state and variants. Airborne's Postgres `release_events` table is the best-effort audit trail used for history, not the source of live release state. Durable rollback and write-recovery state lives in `release_operations`; maker-checker policies, requests, protections, and emergency reviews are persisted in Airborne's database. No environment variables were added for Control Center or maker-checker.

## Rollback preview and confirmation

Before a rollback, fetch `GET /api/control-center/releases/{release_id}/rollback-preview` with `x-organisation` and `x-application`. It requires release-read permission and is side-effect free: it does not write an operation, resolve an unresolved journal entry, change Superposition or audit state, or populate a cold Redis workspace cache. POST recalculates the same plan under the application lock, so the preview is not a reservation.

The response has `action`, `current_package_version`, `resulting_package_version`, `reconciled_keys`, and `blocked`, and `blocked_package_versions` (strings; the security exclusions below, `null` when that lookup failed). Nullable values stay `null` when information cannot be calculated. `blocked` is either `null` or an object with `code`, `message`, and nullable diagnostics such as `current_live_release_id`, `operation_id`, and `replacement_release_id`. Codes are `superseded`, `ongoing`, `no_predecessor`, `incompatible`, and `unresolved`. Do not offer confirmation when `blocked` is set. Show the resulting package and all kept/dropped keys, and state plainly that config reconciliation does not prove an older package works with the current config.

| Current release state | Server action | `action` |
| --- | --- | --- |
| `CREATED` | Discard the not-yet-started release. | `discarded` |
| `INPROGRESS` | Conclude on its control variant. | `concluded_control` |
| `CONCLUDED` with the experimental variant live | Re-release the previous live package with reconciled config, then ramp and conclude it. | `rereleased` |

Send a non-blank reason to `POST /api/releases/{release_id}/rollback`. Success includes `action`, `release_id`, `rolled_back_to_package_version`, nullable `new_release_id`, and `reconciled_keys` (`kept_current` and `dropped`). Completed retries also return nullable `current_live_release_id` and `later_release_id`. If the response was lost, retrying the same source returns the recorded success and identifies later unrelated live activity without starting another rollback.

### Durable operations and errors

The server persists rollback intent and its reconciliation plan before an upstream write. A replacement is resumed only from the exact state observed by that operation or its own pending transition. A definite replacement-stage failure returns `502` with `replacement_release_id` (possibly `null` during create recovery), `rollback_operation_id`, and `stage` (`create`, `ramp`, or `conclude`). Retry the same original release after reviewing the response.

`409 replacement_changed` includes the replacement and operation IDs. It means the replacement, its targeting, status, or a related newer release changed outside the operation. Inspect the replacement's variants, target, chosen variant, and Superposition change history. Do not resume or overwrite it automatically. Preview represents this case as `blocked.code: incompatible` with the replacement ID; POST uses `replacement_changed`.

Ramp percentages outside 0–50 return `400` before a write starts. Explicit upstream `400` and `422` validation responses for ramps are recorded as rejected and leave writes available. For other release writes, only failures known to have stopped before reaching Superposition avoid a pause: request construction errors and connect-phase failures (connection refused, DNS, TLS, connect timeout). A Superposition handler can return `4xx` after applying configuration effects, so other client errors do not prove that nothing was written. An unknown outcome pauses writes: Airborne persists the intent and returns `409 unresolved` with the operation ID, expected/before state, workspace/org and an `own_attempt` flag. `own_attempt: true` means this request may itself have changed upstream; absent/false means an earlier write is blocking it. Retry lets Airborne reconcile automatically when current state or positive Superposition audit history proves the marked expected change was accepted. A timeout, an unchanged experiment, a missing marker or a terminal status alone never proves rejection.

The pause is **application-wide**. Superposition contexts can overlap: a broad/default context and a more-specific one can both affect the same devices and config keys. Airborne cannot safely prove two different-looking contexts are independent, so it serializes writes and pauses every release mutation in that app rather than risk conflicting state.

If automatic reconciliation cannot prove acceptance, an organisation owner/admin or super admin can use `GET /api/control-center/operations?status=unresolved` and `POST /api/control-center/operations/{id}/resolve`. The dashboard's **Writes paused** panel and **Review recovery** flow are the normal operator path; the resolve dialog re-reads upstream, requires a finding and reason, and the server refuses contradictory or unverifiable claims.

- `applied` requires positive evidence that the expected change happened: the operation's marker on the expected transition in current state or in Superposition's audit history.
- `did_not_apply` requires three things. The experiment must be unchanged from the state saved before the write (or, for a create, no experiment carries the operation's marker). The application's workspace configuration must be unchanged from the snapshot saved before the write. The operator must check server and proxy logs and attest that the original request has terminated and cannot execute later. Airborne cannot verify termination independently.

Configuration is checked because a Superposition write can change defaults, contexts or overrides before it updates the experiment row. A write that failed part-way can therefore leave the experiment untouched while the config has moved. Before every mutation Airborne saves a snapshot of the app workspace's default values and of each context's conditions, overrides and weights, excluding audit timestamps and reasons, in `release_operations.data.config_before`. That snapshot is internal journal data; it is not part of any API response. The comparison is deliberately conservative: it covers the whole workspace, so an unrelated direct edit to the app's config also blocks `did_not_apply`.

When config differs, `did_not_apply` returns `409` naming the changed keys (`defaults:<key>`) and contexts with their override keys. Check the upstream history, then either restore those values and retry `did_not_apply`, or finish the intended operation and resolve as `applied`. Operations journaled before this evidence existed have no snapshot, so `did_not_apply` is refused for them. Do not backfill or edit a snapshot to get past the check.

Recovery updates the operation journal and inserts an `operation_resolved` event in one transaction. The event records the actor, operation ID, finding, reason, termination attestation and upstream verification. Direct SQL is a last resort only when the authenticated route cannot establish a finding; follow an audited, exact-operation DBA procedure and never edit expectations or snapshots, delete intents or unlock based on time.

### Reasons and operation markers

Every write Airborne sends to Superposition carries a change reason of the form `<your reason> [Airborne operation <UUID>]`, where the suffix is a generated canonical UUID that identifies the operation. Reconciliation and recovery use that suffix to recognise their own writes in current state and in audit history. The user's text is kept in Airborne's release events.

- **Reserved text.** A reason may not contain `Airborne operation` (case-sensitive) anywhere. Ramp, conclude, discard, rollback and the recovery route all reject such a reason with `400` before anything is dispatched, so a user cannot inject text that looks like another operation's marker.
- **Length.** Superposition allows 255 bytes in total, counted in bytes rather than characters, and the suffix takes 58 of them, so a reason can be at most 197 bytes. Longer reasons return `400` and are never truncated.
- **Matching.** A marker counts only when it is the single, terminal suffix of an experiment's top-level change reason with a canonical UUID equal to the saved one. Duplicate namespaces, malformed UUIDs, bare markers and trailing text do not match. Config values are compared exactly, so a config field that happens to be called `change_reason` gets no special treatment.

### Trust limit: direct Superposition writers

The marker is a correlation tag, not authenticated provenance. Anyone who can write to Superposition directly can set an exact valid suffix together with the expected transition, and Airborne would accept that as evidence the operation applied. Airborne validation stops users of its own API from injecting a marker; it cannot stop a trusted upstream writer from forging one. The same applies to concurrency: direct Superposition operators and old server instances do not take part in Airborne's lock or journal. Restrict direct write access to Superposition to trusted operators and services.

### Reconciliation limits

- An accepted Superposition write cannot be fenced. Old server instances and direct Superposition operators do not participate in Airborne's lock/journal guarantees.
- Schema assertions or patterns outside the conservative evaluator, and keys with compute/validation functions, are blocked as `incompatible` before creation. Valid configurations using these features may need operator review; full validation parity needs an upstream dry-run API.
- Reconciliation checks config validity and registered keys. It does not prove that an older package works with the changed config.
- A completed retry still needs authorization and an upstream read. Availability failures during that read remain errors and do not start another rollback.

### Deadlines and write coordination

Writes for one application use a PostgreSQL session advisory lock across server instances; different apps can progress independently. Same-app contention returns `409` promptly. Each server process admits at most 64 writer sessions, leaving database pool headroom; the read/audit pool is separate. Release mutation SDK calls have a five-second total deadline and a two-second connect deadline, with automatic retries disabled. Read-only full listings have an independent 15-second deadline, including under the writer lock and during preview. The operation budget is 90 seconds and is checked before mutation dispatch; it does not cancel an SDK call already in flight. PostgreSQL lock connection establishment has a six-second outer deadline and three-second libpq connect timeout; lock verification/SQL uses two seconds and journal reads have a three-second outer deadline. A timeout does not prove that an upstream write failed; use unresolved recovery.

These advisory locks require a dedicated session-pinned PostgreSQL connection. RDS Proxy must pin each writer session to its backend. PgBouncer transaction pooling is unsupported, and a DSN containing `pgbouncer=true` is refused. Configure a direct or session-pinned writer endpoint.

Capacity note: 50 simultaneous writes exhausted the local Superposition demo's connection pool. Airborne recovered the resulting unknown operations, but this did not establish that Superposition supports that burst. Test bursts against your own deployment before declaring a concurrency level supported.

### Safe rolling deployment order

This is a write-drained rollout, not a zero-downtime rolling-write guarantee:

1. Apply additive migrations `2026-10-31-000002_release_operations` and `2026-10-31-000003_operation_recovery` first. Keep existing data and `release_events`.
2. Disable/drain release mutation routes on every old instance: release update/create/ramp/conclude/discard/rollback. Drain in-flight requests and investigate ambiguous accepted work in Superposition and request logs. Reads may remain available.
3. Reconcile pre-upgrade partial rollback/event markers and unknown in-flight writes. Do not invent expected fingerprints.
4. Deploy/restart all instances with the new implementation. Confirm the migration and SDK deadlines; ensure no old instance or background writer still serves mutations.
5. Re-enable writes, then exercise scratch preview, rollback, and cross-instance contention. Never run old and new release writers concurrently while claiming serialization/fencing safety. For binary rollback, drain writes again and retain the operation table and unresolved records.

## Release state conflicts

Release writes validate the release's current state, inside the lock, before changing anything. A request for a state the release is no longer in returns `409`, not `400` or `500` as before. Callers should refresh the release and not retry blindly.

| Route | `409` when |
| --- | --- |
| `POST /api/releases` | Another release (`CREATED` or `INPROGRESS`) already exists for the same dimensions. |
| ramp | The release has already concluded or been discarded. Ramping from `CREATED` to start a rollout is still allowed. |
| conclude | The release has already concluded or been discarded, or it is still `CREATED`; ramp it first. |
| discard | The release is not `CREATED`. |

Ordinary upstream failures and lock failures can still return `500`. These checks apply to every caller of the release routes, not only Control Center.

## HTTP status codes

| Status | Meaning |
| --- | --- |
| `200` | Request completed. |
| `400` | Missing scope header, blank rollback or recovery reason, a reason containing the reserved text `Airborne operation` or longer than 197 bytes, invalid group name/platform/member, or invalid input. |
| `401` | Bearer token missing or invalid. |
| `403` | Caller lacks organisation/application permissions. |
| `404` | Requested group or release does not exist in the selected scope. |
| `409` | The release is not in a state that allows the request (see [Release state conflicts](#release-state-conflicts)), another release is ongoing for the same dimensions, the write lock is contended, a rollback is superseded, an upstream result is unresolved (including after an upstream `4xx` that may have had side effects), a recovery claim is contradicted by upstream state or changed config, or a replacement changed outside its operation. |
| `422` | A rollback cannot be reconciled: no previous live release, unreadable current config, required keys missing, or Superposition rejected the replacement. Nothing is created. |
| `500` | Airborne or an upstream dependency failed, or the overview could not authorise within its deadline. |
| `502` | A rollback replacement step failed definitively; details include the replacement, operation ID, and stage when available. Retry only after reviewing current upstream state. |

The standard Airborne error body is `{ "code": "AB_...", "message": "..." }`. Superseded, unresolved, replacement-changed, `422`, and partial `502` responses add the operation-specific fields described above.

### Rollback failure stages

Every failure with an incomplete durable rollback plan includes `stage`,
`rollback_operation_id`, and `replacement_release_id` (nullable). This includes
`planned`, `discarded` and `concluded_control`, as well as `create`, `ramp` and
`conclude`. Completed operations do not acquire misleading partial metadata.
Use the existing operations resolve API above for unknown upstream writes;
after resolution, retry the original rollback to resume its durable plan.

### Rollback lineage

Rollback replacements retain their source in the durable operations journal.
Preview returns `rollback_of` and blocks another rollback with `rollback_chain`;
POST enforces the same check, including emergency and approved executions.
A replacement whose create response was lost is also blocked by its reserved
operation description. This prevents an undo-of-undo from silently restoring
the rejected release. To restore different content, create a new release with
an explicitly reviewed package and configuration. Retrying the original
rollback remains supported.

### Organisation readers

Built-in organisation `read` membership sees all existing applications in that
organisation, including apps created later, and can use their read APIs. Stronger
explicit app grants remain intact. Built-in write/admin/owner memberships also
receive this read floor. This chooses useful organisation-wide visibility over
app-by-app privacy: give an app-only read role to people who must see only one
application. No write permission is added by this inheritance.

`POST /api/authz/me/enforce-batch` follows the same rule for `scope: "app"` checks:
a check passes when either the application binding or the organisation role grants
the permission, which is how application routes themselves are enforced. The
dashboard's classic application pages rely on this, so an organisation `write`
member with no application membership no longer gets a 404 there.

### Release cache failures

Release responses now send `Cache-Control: public, max-age=0, s-maxage=60, stale-if-error=300`. Remove any CDN policy that
forces a one-day TTL regardless of origin headers. Previously cached responses
still require invalidation. Each write attempts both release URL patterns up to
three times each (two seconds per attempt), handling returned CloudFront errors
as well as timeouts. Empty distribution IDs disable invalidation for local use.

`cache_invalidated` or `cache_invalidation_failed` is recorded with actor
`system:cache` and an empty release ID in the application timeline. Submission
success is not proof that CloudFront propagation has finished. An otherwise
successful write returns `502 cache_invalidation_failed` when invalidation fails,
with `mutation_may_have_committed: true`; read state before retrying that write.
An original write error remains the response when both operations fail.

An org owner/admin or app admin can call
`POST /api/control-center/cache-invalidation/retry` with both scope headers to
retry invalidation without repeating the deployment. It records the same timeline
event. Failure to persist this audit is also surfaced. This cache-only operation
does not change a deployment and needs no maker-checker approval.

### Initial releases and workspace recovery

All release creates return `CREATED` at zero traffic. Operators must explicitly
ramp and conclude the chosen experimental variant, including the first release.
A rebuilt Superposition workspace can resemble a new application; it never
constitutes approval to publish a package. Restore upstream history before normal
operations. Until the first release is ramped, clients use bundled code.

### Rollback artifact availability

Preview and execution verify every restored index, important, lazy and resource
file against fresh database metadata and an HTTP HEAD request. Missing metadata,
incomplete uploads, inaccessible URLs, redirects and verification timeouts block
rollback with `missing_files`. External artifact hosts must support HEAD without
redirects. Restore artifacts or publish a reviewed replacement package to proceed.
Checks establish availability at preview/execution time, not permanent retention
or checksum integrity; keep immutable artifacts backed up.

### API restart regression

Run `airborne_server/scripts/test-release-restart.py prepare URL CREDENTIALS CASE_JSON`,
restart only the isolated API process, then run the same command with `verify`.
This checks a persisted scratch release can still be read and ramped after restart.
A local :8083 run on 2026-10-31 passed: persisted GET 200 and ramp 50 confirmed by GET.
The local CDN returned the expected cache-only 502 after the committed ramp.

The earlier `Failed to read release` 500 was **not reproduced** by an API-only
restart. That message comes from Superposition `get_experiment` before ramping,
where all upstream failures collapse into a generic 500. It does not establish
that the release is absent. Interrupted connections during API shutdown are a
separate transport failure. Upstream outage/restart fault injection remains
unverified; no running Superposition container was disturbed. Inspect upstream
availability and release state before retrying an ambiguous write.

### Ramp-down serving evidence

A scratch HTTP regression on 2026-10-31 selected package 2 at ramp 50 and package
1 after ramp 0 for the same toss identifier. Ramp-down can therefore downgrade
**server-selected** packages. Whether a device applies that downgrade depends on
its SDK and local state; this test does not prove installed-client behavior.
Dashboard text that promises only to stop new adoption needs correction.

## Stored strict serving policy

New applications are strict. Migration `2026-10-31-000006` explicitly backfills
existing workspace applications with `strict=false`; it does not opt them in.
Apply this migration before deploying the new server. All serving instances must
run this version before relying on the policy; older binaries ignore it.
`STRICT_RELEASE_APPLICATIONS=org/app,...` remains a force-on deployment override.
No environment value can force a stored strict policy off. Reads fail closed on DB
errors. Policy reads bypass Redis, so changes apply on the next request.

All routes below use bearer auth and `x-organisation` / `x-application` headers:

- `GET /api/control-center/serving-policy` returns
  `{"strict":false,"deployment_override":false,"effective_strict":false}`.
- `PUT /api/control-center/serving-policy` accepts `{"strict":true}` and returns
  the same shape. Uses normal release `update` permission. A no-op succeeds.
- `POST /api/control-center/serving-policy/preview` accepts
  `{"context":{"app_version":"2.0.0","locale":"kn"},"toss":"42"}`.
  Returns `serving_policy`, echoed `context`/`toss`, `config_version`,
  `package_version`, `targeted`, `would_stop_serving`, `strict_status` (200 or 404),
  and `scope`. This route is read-only and requires release `read` permission.
  It evaluates the supplied context and toss against one consistent upstream
  snapshot; a concurrent snapshot change returns 409. It does not enumerate
  devices, estimate adoption, or check artifact availability.

Strict serving rejects default-only matches with 404 (use bundled code). A targeted
release still serves. Each member of `/api/control-center/overview` includes
`serving_policy` with the three booleans above. No dashboard controls are included.

Both directions of a policy change affect exposure: enabling can remove fallback
traffic; disabling can serve a fallback to previously excluded binaries. A finite
preview sample cannot prove zero impact. Therefore both require approval while
maker-checker is enabled. Raise `action: "set_strict_serving"`,
`payload: {"body":{"strict":true}}` (omit `release_id`) through the normal
`POST /api/control-center/deployment-requests` flow. The maker and checker need
release `update` permission. Serving policy is part of request freshness checks.
Changes and their actor/before/after/approval context are atomically recorded as
`policy_changed` timeline events with `payload.policy: "strict_serving"`.

Local validation: policy defaults/toggles/read permissions, timeline and overview,
default-only rejection and context preview were exercised on a scratch app at
`:8084`. The maker-checker permission/action tests pass. End-to-end checker
execution for this new action remains unverified locally: the deployment readiness
fence is false and was left unchanged. The HTTP regression automatically exercises
it when an operator has already enabled that fence.

## Anonymous device telemetry

Telemetry lives in the existing Postgres-backed API. The older analytics service requires Kafka and ClickHouse, is not running locally, and accepts unauthenticated events. Keeping small batches beside release serving avoids another deployment and lets the serving API sign the exact package/config selection. Receipts prove a configuration was served, never device identity or report truth. All v1 counts are explicitly unverified.

Public `POST /api/telemetry/reports` accepts at most 16 KiB and 32 events. Body: `{"receipt":"JWT","install_id":"random UUID","events":[{"id":"random UUID","kind":"boot_success"}]}`. Kinds are `package_downloaded`, `boot_started`, `boot_success`, `boot_failed`, `rollback`, `blocked_package`. UUID event ids deduplicate retries. The receipt binds organisation, app, release, package, native version and platform; it expires after one day. Invalid/expired receipt returns 400, accepted returns 202, the shared Postgres per-IP-range quota (120 batches/minute per IPv4 /24 or IPv6 /56) returns 429. Raw IP addresses are never persisted. No attestation: install IDs and calls can be faked.

Opted-in config requests send `telemetry_platform=web|android|ios` and `native_version=2.8.0` query parameters. A matching release response adds `telemetry: {receipt, expires_at, ingest_path, verification:"unverified"}`; unset signing key or unresolved release identity returns null. The endpoint is relative to the release origin. Tokens are scoped to the selected immutable package/config pair, including control selections.

Authenticated `GET /api/control-center/telemetry` uses `x-organisation`, `x-application` and normal release read permissions. Each overview app also has `telemetry` with this same object:

```ts
type Signal = {
  status: 'seems_bad' | 'suspicious_reports' | 'no_signal' | 'observed_only' | 'insufficient_data';
  baseline_release_id: string | null;
  // These evidence fields are absent when no baseline exists.
  crashes_up?: boolean; successes_down?: boolean; minimum_boot_devices?: number;
  boot_success_rate?: number; boot_failure_rate?: number;
  baseline_success_rate?: number; baseline_failure_rate?: number;
  automatic_action?: 'none';
};
type TelemetrySummary = {
  window_days: 7; verification: 'unverified'; automatic_action: 'none';
  adoption_definition: string;
  // Only on GET /control-center/telemetry, never in /overview. Security exclusions (below); null = lookup failed.
  blocked_package_versions?: string[] | null;
  releases: Array<{
    release_id: string; package_version: string; native_version: string;
    platform: 'ios' | 'android' | 'web'; release_created: number;
    reporting_devices: number; package_downloaded: number; boot_started: number;
    boot_success: number; boot_failed: number; rollback: number; blocked_package: number;
    unverified_reports: number; signal: Signal;
  }>;
};
```

The types describe the wire shape without inventing adoption data. Every event-kind count is distinct installs, so repeated retries/crashes do not multiply devices. Success and failure sets can overlap. Baseline is the previous reported release for the same native version and platform, over the same seven-day received window. Twenty booting devices on each side, at least five failing devices, a 10 percentage-point failure increase AND a 10 percentage-point success decrease are needed for `seems_bad`. Increased crashes alone produce `suspicious_reports`; other states are `no_signal` and `insufficient_data`. Without a baseline, enough current reports give observed_only; low sample sizes remain insufficient_data. Show evidence and zero verified counts. Never label rollout targets adoption.

**Advice only.** Neither ingest nor aggregation dispatches release writes. Airborne never reverts, pauses or ramps down on telemetry. A human decides. Even many forged installs cannot automatically take down a healthy release. Native boot failures mean a previous launch did not acknowledge first render; force quits also count, and crashes after acknowledgement are not detected. Expired offline telemetry is discarded; counts are incomplete observations.

## Security package exclusions

A `security` rollback-sensitive marker durably adds every older package version in that application to `blocked_packages`, in the marker transaction. The list is monotonic: clearing a marker, later unmarked releases and rollback replacements never remove exclusions. A `one_way_migration` marker does not assert a security exclusion. Config always includes `blocked_package_versions` as strings. Upgraded SDKs union this into persistent local state, independently of telemetry opt-in or boot guard configuration, and refuse OTA execution/restoration of those packages, including last-good and cached file fallback. A marker should be set only once the operator intends this irreversible exclusion.

Bundled code cannot be blocked by OTA: if every eligible cached OTA is excluded, clients use bundled code. Ship a secure native binary/host to remove vulnerable bundled code. Offline clients cannot learn a new exclusion until they successfully fetch a config; previously learned exclusions remain. Older SDKs ignore this field and receive no protection. Existing stored security markers are backfilled before serving a manifest. An unavailable historical security release fails config serving closed rather than omitting its exclusions. Markers cleared before this upgrade cannot be reconstructed from the current marker table.

### Publication and CDN timing

Release timeline payloads include `server_recorded_at` when the server records a mutation. Cache events separately record `publication_observed_at` (state observed before the invalidation attempt) and `invalidation_submission_finished_at`. Successful cache status includes `invalidation_submitted_at` and `availability_confirmed: false`. These record submission, not edge availability; no propagation probe is performed. A cache-only retry observes existing publication rather than publishing again. Legacy events may lack these fields.

### Telemetry without a comparison

All counts use the last seven days. When at least 20 installs report boot starts
but no earlier release reports in the same native/platform cohort, the state is
`observed_only` ("Reports without comparison"). This is no comparative health
assessment. Five or more failed-boot installs representing at least 10% of boot
starts instead produce `suspicious_reports`, including when there is no baseline.
Reports remain unverified. Airborne never acts on telemetry.

`release_totals` counts distinct install IDs across native versions and platforms,
using the same window as the cohort rows. A native update cannot inflate the
release total. Cohort rows must not be summed to obtain adoption.

### Partial group policy changes

Group apply is a non-atomic sequence. The dashboard stops at the first error and
reports confirmed saves, the unconfirmed outcome and applications not attempted.
A lost response may follow a commit. Read each policy before changing it again;
reapplying a disabled policy can cancel newly pending requests.

### Release read failures

Before mutation dispatch, upstream lookup failures include `stage: read_release`,
`mutation_committed: false`, `mutation_may_have_committed: false` and
`automatic_retry: false`. Codes distinguish `release_not_found` (404),
`upstream_workspace_unavailable` (503), `upstream_authentication_failed` (502),
`upstream_connection_failed` (503), `upstream_read_timeout` (504), and upstream
unavailability/invalid responses (502). If a 404 body identifies neither resource,
`release_or_workspace_not_found` preserves the ambiguity. These are upstream
credentials, not a reason for the caller to log in again. Do not infer that a
later write failed from a transport failure: inspect the operation journal.

### Approval-enabled system migration maintenance

Default-config migrations refuse approval-enabled apps. On boot, refused or failed workspaces are logged and skipped while the server keeps serving; the log lists their names. Explicit HTTP migration callers receive 403 and
`code: system_migration_requires_maintenance`, including `organisation`,
`application` and `workspace`. The local migration file is not bound to an
immutable approved request and upstream config changes are not transactional.
There is no silent system exemption. For each affected app an org owner/admin:

1. Schedules maintenance and drains **all** API writers, workers and boot
   migrators across the fleet. Keeps one isolated operator-only instance. Takes
   the paired Airborne/Superposition backup. Records binary revision, migration
   strategy and the config file's SHA-256 in the maintenance ticket.
2. Reads `/api/control-center/operations` and reconciles unresolved operations
   using the recovery procedure before continuing.
3. Saves `GET /api/control-center/approval-policy`. Using bearer authentication
   and `x-organisation`/`x-application`, PUTs that policy with `enabled: false`
   to the same path. This audits before/after and cancels pending requests.
   Never edits approval tables directly.
4. Starts the isolated instance with the reviewed
   `superposition-default-configs.json`, `MIGRATIONS_TO_RUN_ON_BOOT` including
   `superposition`, and the reviewed `SUPERPOSITION_MIGRATION_STRATEGY` (`PATCH`
   adds missing keys; `PUT` also deletes unlisted keys). Checks completion logs
   for **each workspace**; successful startup alone is insufficient.
5. Verifies upstream defaults and device resolution. PUTs the saved enabled
   policy and verifies its GET response before admitting traffic. Records both
   policy audit events in the ticket. On any failure keeps traffic drained,
   repairs or restores the paired backup, then repeats verification and policy
   restoration. Pending requests must be raised afresh.

### Reader and dashboard API additions

Resolve operations now requires `release:recover`. Existing Casbin endpoint
seeding grants it to org owner/admin roles at bootstrap. Org write/read and app
roles do not receive it. The handler also retains its org-admin check.
Operation-list and overview rows exclude config snapshots and upstream IDs;
readers receive only `operation_id`, `message`, and optionally `code: unresolved`.

Queue, individual-request and overview reads atomically expire pending/failed
requests and emit an `expired` event. Executing requests require reconciliation.
Decisions compare the prior persisted status before executing, preventing a
concurrent expiry from being overwritten.

Decision errors include `request_stale`, `request_expired`, `not_pending`,
`hash_mismatch`, `not_checker`, `not_maker`, `self_approval`, and `not_requester`.
Acknowledgement uses `not_checker`, `same_checker`, and `emergency_not_found`.
After an action error and a successful save of failed status, the response uses
`code: execution_failed`, `request_id`, and `request_status: failed`, retaining
its underlying HTTP status. An unresolved outcome, transport error or failed
status save still requires a request re-read.

Successful emergency reviews include `rollback_finished: true`,
`rolled_back_to_package_version`, `new_release_id`, and `rollback_result`.
The `emergency_rollback` event includes these under `details`. Missing fields on
legacy reviews mean unknown outcome. Emergency requests are not automatically
replayed; reconcile the rollback journal first.

Overview batches authorized auxiliary data within the request deadline.
`auxiliary_error` with null auxiliary fields means the lookup failed or timed out;
independently obtained release state remains visible.

A committed write followed by failed CDN invalidation deliberately returns 502
with `code: cache_invalidation_failed` and `mutation_may_have_committed: true`.
A database commit cannot guarantee CDN publication. Inspect state and retry cache
invalidation, without replaying the original write.

Artifact probes can return `artifact_verification_unknown`. This is transient: nothing changed; retry verification. Discard and control rollback do not probe unchanged artifacts, including pristine first-release control.

Workspace lookup waits at most two seconds for a database pool slot. Authenticated API routes preserve HTTP 503 on pool exhaustion and callers may retry. Public release reads deliberately return safe HTTP 404 with “keep current code” when the workspace, policy or strict resolution is unavailable; this is a no-update response, not a claim that the app is missing. Release operations use a separate 5 s/no-retry Superposition client; boot migrations, provisioning and non-release listings use the SDK default (retries disabled for this non-AWS client). CDN invalidation retries run after releasing the writer session.


An organisation admin can abandon a partial rollback after discarding its
replacement (or concluding that replacement to control):
`POST /api/control-center/operations/rollback/{source_release_id}/abandon` with
`{"reason":"replacement discarded after inspection"}`. This checks terminal
upstream state under the writer lock and records `rollback_abandoned` with scoped operation/replacement identities, prior
state/stage and reason, then clears the active row so a fresh plan uses a new
operation identity. Archived lineage remains available; private journal snapshots
are not published in reader-visible events. Active or completed replacements
cannot be abandoned. Resolve unknown write outcomes first.

Without a CloudFront distribution, invalidation is `not_applicable` and release
writes do not call CloudFront. Real configured distributions retain retry and
partial-write reporting.

Strict creation requires a nonempty `app_version` or `version_cohort` target, including the first release. Locale-only rules do not establish native compatibility. Custom targeting needs an audited `compatibility_exception` explanation of at least 20 characters; empty targeting is never an exception. Compatibility remains a declaration by the operator; the server does not verify native binary compatibility.
