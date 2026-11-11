# Deployments feed

Authenticated `GET /api/control-center/deployments` returns durable release audit events across readable applications. It uses the same Casbin permission checks as release reads, including organisation-level readers. It requires no scope headers.

Query parameters: `org` (organisation name), `group` (group UUID), `app` (application name), repeatable `action`, `platform` (`web`, `ios`, `android`), `actor` (exact audit subject), `since` (RFC 3339), `cursor`, `limit` (default 50; 1–200). Scope parameters intersect. Unknown or inaccessible scopes return no rows. Malformed filters return 400. Cursor requests must preserve every filter; limit may change.

Response fields follow `nav/SPEC.md`: `items`, nullable `next_cursor`, `partial`, `errors`, `audit_completeness`. Events contain `event_id`, `at`, `org`, nullable `group`, `app`, nullable `platform`, nullable `release_id`, nullable `package_version`, `action`, nullable `actor`, nullable `from_target`, nullable `to_target`, and `summary`. Missing historical facts remain null. Actors are the recorded user subjects (normally email addresses) or real system identities such as `system:cache`; the feed does not invent people. Platform comes from group membership, falling back to recorded event metadata.

Release, maker-checker, policy and CDN failures share `release_events`; `cache_invalidation_failed` maps to `cache_failed`.

Actions: `created`, `ramped`, `concluded`, `rolled_back`, `discarded`, `emergency_rollback`, `requested`, `approved`, `rejected`, `expired`, `cache_failed`, `cache_retried`, `policy_changed`, and the outcomes `executed`, `failed`, `stale`, `cancelled`, `rollback_abandoned`, `emergency_acknowledged`. An approval is followed by its outcome: a request that was approved and then failed, went stale or was cancelled shows that outcome, not only "approved". `compatibility_exception` (a creation attempt) and successful cache invalidations are not feed actions.

A release write whose upstream result was ambiguous and was later confirmed by an operator (`POST /operations/{id}/resolve`, finding `applied`) appears as the action it completed (`created`, `ramped`, `concluded` or `discarded`) with `recovered: true`, the operator as `actor`, and the operator's reason in `summary`. `did_not_apply` findings, and operations that are not deployments (draft edits), are not shown. Every item carries `recovered`. Explicit CDN retry requests now record `cache_retried` with their caller before attempting invalidation. Ordinary successful invalidations are not retries and do not appear as such. Historical events are returned as recorded; writers that predate transactional audit cannot reconstruct events never persisted. No upstream experiment scans or synthetic history are performed.

Ordering uses `(created_at DESC, id DESC)`, with a snapshot timestamp carried in the cursor. The first page takes the snapshot from the database clock (`SELECT now()`), the same clock that stamps `created_at`, so application-server clock skew cannot hide fresh events. Inserts newer than that timestamp are excluded from subsequent pages. A transaction that began before the snapshot but commits after the first page can add an event dated before the snapshot; if it is newer than the cursor position it is missed by that traversal and appears on the next fresh one. The feed index starts with `(org_id, app_id)` and ends with descending timestamp/UUID. Each authorized app reads at most `limit + 1` rows, each lookup with a 750ms PostgreSQL statement timeout and a 250ms pool wait. Lookups across all feed requests share a permit pool of `DATABASE_POOL_SIZE - 1` (at least 1, at most 8; 3 with the default pool of 4), so the feed can never hold every connection and starve writes, authorization or other handlers. A lookup waits for a permit without holding a connection; one that has not run by the five-second deadline is reported as `Audit read deadline exceeded`. Pages are merged as they arrive and only the newest `limit + 1` rows are kept, so memory is bounded by the page size, not by the number of applications. Raise `DATABASE_POOL_SIZE` for a deployment with many readers of large scopes; the default is unchanged because it sets every deployment's database connection budget. At most 1,000 applications are considered, with a five-second request deadline. Limits, authorization failures, and failed app reads return `partial: true` and named errors, rather than silently reporting an empty healthy feed. A failure to enumerate authorization scope fails the request. Retry a partial page before advancing its cursor if a complete export is required.

`GET /api/control-center/overview` accepts the same `org`, `group`, and `app` scope parameters. Status, auxiliary queries and groups are restricted to that scope.

## Organisation names are reusable

Deleting an organisation removes its access policies but keeps its audit rows. Creating an organisation records `organisation_epochs.started_at` (database clock, taken before the owner grant; creation fails if it cannot be recorded). The feed, and the overview's cache-status read, ignore audit rows older than the current epoch of an organisation, so a recreated `acme` does not see the previous `acme`'s events, actors or summaries. The rows are retained, not deleted. Organisations created before this migration have no epoch, and a name that was already deleted and reused before it cannot be told apart.

The release control tables are not kept: deleting an organisation removes its approval policy, deployment requests, release protections, emergency reviews, release operations (the durable journal) and application groups, and creating an organisation removes any that remain, in the transaction that records its epoch. Deletion is refused with 409 while a request of the organisation is executing, and from the moment it starts no request can move to `executing` (`organisation_deleted`, 10-minute window). Not purged, because they describe package and serving data that also survives an organisation delete: `blocked_packages`, `serving_policies`, `device_reports`, `first_device_requests`, and the core application tables (`workspace_names`, packages, files, configs, builds).

## Audit completeness

Release `created`, `ramped`, `concluded` and `discarded` events (and the four rollback equivalents) are inserted in the same database transaction as the write's durable journal entry reaches `confirmed`. A confirmed release mutation therefore cannot exist without its event. If that transaction fails, the journal entry stays `unresolved` with its audit intent recorded; the next writer (or an operator) resolves it and the event is written then, attributed to the original actor. Approval, policy, emergency and expiry events are committed with their own state change.

What is still not guaranteed, and is stated on every response in `audit_completeness` (`complete: false`, `transactional_actions`, `best_effort_actions`, `notes`):

- Releases changed before this rule existed were audited best-effort; their events can be missing.
- A write whose upstream result is unresolved has no event until it is resolved; the change may already be live.
- `cache_failed` is written after the CDN attempt in a separate statement.
- `expired` is recorded when the expiry is first processed, which can be later than the request's expiry time.
- Edits to a release that has not started rolling out are not audited.

An absent event is therefore not proof that nothing happened. Clients should say "as recorded" and not "every event".

## Validation

`cargo test -p airborne_server -- --skip database_integration --skip postgres` runs the non-Postgres suite. The `#[ignore]`d `database_integration` tests need a disposable `TEST_DATABASE_URL` whose name contains `scratch`: they run migrations and exercise the HTTP handlers with the real Casbin provider.

```sh
createdb airborne_scratch_feed   # a NEW database for each full run
RUST_MIN_STACK=33554432 TEST_DATABASE_URL=postgres://.../airborne_scratch_feed \
  cargo test -p airborne_server database_integration -- --ignored --test-threads=1
dropdb airborne_scratch_feed
```

Use a fresh database per run: the contract test reads as a fixed subject, and organisations from an earlier run would be read too. `RUST_MIN_STACK` is needed by `postgres_lifecycle_and_writer_recovery` in debug builds. They cover: org isolation and filters; stable pages under inserts; a genuine one-app Postgres failure; organisation-, application- and group-level readers and denied readers; request outcomes and operator-recovered writes; audit rows committing with the journal (with an injected insert failure); the database-clock snapshot; a recreated organisation not seeing the previous tenant's rows; and feed reads leaving pool connections free. Never run them against the live database.
