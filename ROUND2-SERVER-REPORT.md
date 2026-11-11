# Round 2 server, CLI and activation report

Implemented on `persona/r2-server`, based on `stack/final-4`. Nothing pushed. No dashboard source or dashboard-documentation change remains in the final diff.

## Delivered

- Strict creation requires a nonempty `app_version` or `version_cohort` declaration. Custom targeting needs an explicit compatibility explanation; empty targeting still fails. Both direct creation and maker-checker snapshot creation use the same gate. Execution persists the exception before upstream mutation; the new migration permits its audit action. Compatibility remains an operator declaration, not verification of a native binary.
- Overview/group `active[].created_by` reads the scoped creation audit, matching the timeline. Missing legacy actors are labelled exactly `Unknown actor (legacy release)`. The UI handoff is recorded in the shared Round 2 fix log.
- `airborne-devkit init` patches recognized Kotlin and RN 0.78/0.79 Swift scaffolds, shows a no-write unified dry-run diff, writes local and bundled configuration, and refuses unsupported or subsequently edited native wiring. Android and iOS use distinct application identities. An explicit local native-SDK option supports unpublished checkout testing. Repeated initialization and repeated generated CocoaPods resource-hook execution are tested.
- Quickstart uploads real checked-in v1/v2 web scripts, makes v1 live and leaves v2 prepared at zero exposure. The next command ramps then explicitly concludes v2. The sample fetches the real public manifest and checksum-verifies the downloaded script before executing it. No synthetic failures, device installations or telemetry reports are seeded.
- Quickstart now removes explicit Compose network names as well as volume/container names. The prior named network could resolve service aliases across projects; the final acceptance run used a unique project network. Teardown remains project-labelled. The API-only sample also proxies stored assets on its public origin.
- Added the five-stage first-OTA guide with the Kharcha native diff, contribution/review order and test commands, plus a recovery checklist separating server completion from customer recovery with incident owner, verifier and deadline fields.

## Measured activation

On a clean local clone at `71a097dd`, using a fresh isolated Compose project, cached container images and Rust build artifacts, and `scripts/quickstart.py --no-dashboard --api-port 8102`:

- Sandbox ready: **38.9 seconds**.
- First web OTA visibly booted: **46.3 seconds** from launch, including browser startup and operator delay. The browser first verified v1, invoked the printed v2 publication command, then verified the visible v2 text and its executed-script marker. Time uses the launch log creation timestamp; precision is approximate to a tenth of a second.

These numbers exclude dashboard compilation and cold downloads. They verify the small real web sample, not the RN SDK browser loader or an independent operator. Historical 179-second readiness is not used as first-OTA evidence.

A separately timed fresh RN 0.79.2 scaffold completed init, dependency installation and a **55-second cached Android Release build**. **No Android first-OTA boot time is claimed:** the device tool rejected the emulator as owned by another session. That session was neither reused nor closed.

## Verification

- Rust with a disposable scratch PostgreSQL database: **82 passed, 2 credential-dependent HTTP tests excluded**, using `RUST_MIN_STACK=33554432`. A first attempt overflowed the existing lifecycle fixture's default test-thread stack; the larger-stack rerun passed. The ordinary suite also passed (75 tests; 9 database/API tests ignored) before the database run.
- CLI: **18 passed**. Negative runs demonstrate the old locale gate, service-account attribution, missing native-SDK option, platform-scope collision and namespaced fallback-path behavior fail the new checks.
- Generated SDK: TypeScript types/CJS/ES compile; **7 contract checks pass**, including serialization of `compatibility_exception`. The old serializer fails that assertion. Local dependency symlinks required TypeScript `--preserveSymlinks`; unrelated compiler metadata/order changes were discarded. The Smithy executable was unavailable, so the full generator pipeline was not run; the Smithy member, model JSON, source consumers and compiled consumers were updated and contract-checked.
- Python: seeder, teardown, resource isolation, public-address configuration and real HTTP asset-proxy tests pass. Each seeder lifecycle/API discrepancy was reproduced in an own sandbox and added to its regression transport: required package block, separate index, ramp-before-conclusion and persisted variant IDs.
- PostgreSQL audit SQL: insertion fails with the old constraint and passes after the new migration; fixture rows roll back. On the real isolated API, locale-only strict creation returns 400, a custom exception succeeds and is recorded, and overview/timeline both credit `quickstart@example.com`.
- Android: Release APK builds pass for the fresh RN **0.79.2** template and Kharcha's initial **0.78.2** scaffold (`69dab54`), arm64, `newArchEnabled=false`, with the explicitly selected local native SDK. The APK contains the root JS bundle and namespace release config. These are compilation/fallback-packaging checks, not observed native OTA boots.
- iOS, earlier attempt: CocoaPods installation succeeded (73 pods), but compilation stopped in RN fmt. This was superseded by the final-5 fresh RN 0.79.2 arm64 Release simulator compilation pass on Xcode 27 with new architecture disabled, static frameworks, the generated fmt workaround and matching local SDK. Evidence: kharcha-plan final-5 `ios-build-physical.result.json`. Neither attempt establishes native OTA boot or published SDK pairing.
- Documentation production build and `git diff --check` pass. The CocoaPods generated-hook repeat-execution regression passes.

## Limits and remaining acceptance

- Android emulator use was rejected with `DEVICE_IN_USE` naming another session. Inspection through the bound command was unavailable; device work stopped. No claimed native boot or native time-to-first-OTA.
- The published native Maven artifact lacks methods called by this checkout's wrapper. Native build acceptance uses the matching local source module, explicitly selected by CLI option. Published npm/Maven pairing and the new architecture still need acceptance.
- iOS AppDelegate integration remains unverified because the dependency compile fails first. No unrelated SDK source or vendored pod was changed to bypass it.
- Full dashboard-mode quickstart was not timed; an external team's unaided activation and real customer recovery remain unmeasured. Recovery evidence is not inferred from server operations.
- The final schema migration was verified separately after the timed sample run; the timing is attributed to the measured revision, not silently relabelled as a cold build of the final tip.

## Local evidence

Temporary evidence is retained in kharcha-plan evidence: `r2-web-acceptance.json` (historical local artifact), kharcha-plan evidence: `r2-server-acceptance.json` (historical local artifact), kharcha-plan evidence: `r2-rust-db-final.log` (historical local artifact), kharcha-plan evidence: `r2-cli-accepted.log` (historical local artifact), kharcha-plan evidence: `r2-native-fresh-retry.log` (historical local artifact), kharcha-plan evidence: `r2-native-kharcha-release.log` (historical local artifact), kharcha-plan evidence: `r2-native-timed-build.log` (historical local artifact), kharcha-plan evidence: `r2-ios-build.log` (historical local artifact), kharcha-plan evidence: `r2-ios-retry.log` (historical local artifact), and kharcha-plan evidence: `r2-docs-final-accepted.log` (historical local artifact). Own quickstart logs remain under the clone's `.quickstart/` directories. Credentials remain private and are not included here.

Only own sandbox processes, containers and volumes are torn down. Shared containers' lifecycle, port 8081, live release apps web 10 / iOS 8 / Android 3 and stack split scripts were not operated on. Builds and quickstart enforce the 4 GiB disk guard; an earlier run stopped at its former 5 GiB guard and cleaned up its own project.

## Implementation commits

The documentation/report commit follows these focused commits:

```text
b3202df6 fix(server): require declared native compatibility for strict creation
5345c09d fix(server): attribute release creation to its audited actor
a555668b feat(cli): initialize recognized bare React Native projects
57ea55ed feat(quickstart): seed real sample releases and separate boot timing
09080b4a fix(cli): separate native platform scopes during initialization
d627b9b3 fix(quickstart): supply the required package override block
edc836ea fix(quickstart): keep the package index out of additional files
e67ba260 fix(cli): retain the standard Android bundle output path
fbd8f047 fix(quickstart): ramp sample releases before explicit conclusion
9799848a fix(quickstart): resolve persisted variant IDs before conclusion
8ae3aa06 feat(cli): support explicit local Android SDK integration
115a6d97 fix(quickstart): proxy stored assets in API-only mode
092fc35c feat(quickstart): expose emulator-reachable sample assets
b9b42382 test(quickstart): verify emulator and browser public origins
71a097dd fix(quickstart): isolate Compose networks as well as volumes
6ddf8f42 fix(cli): keep generated CocoaPods resource wiring idempotent
672a94c9 fix(server): permit durable compatibility exception audit events
```
