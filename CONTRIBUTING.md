# Contributing

Keep each PR independently buildable. Add a regression test that fails before each behavior change and passes after it. Include measured evidence and limits; synthetic reports must be labelled and kept out of default demos. Do not use device telemetry to automatically revert, pause or reduce exposure.

Review order for the proposed stack:

1. Dependency and local identity/storage foundations.
2. Web/native SDK serving and boot behavior.
3. Storage, release operations and recovery APIs.
4. Maker-checker policy and scoped authorization.
5. Smithy models, generated SDK and CLI contracts.
6. Dashboard release, approval and recovery workflows.
7. Activation, sample quickstart and integration docs.
8. Operational backup/restore, acceptance evidence and maintenance ownership.

The order is a review proposal, not evidence of upstream acceptance. Use conventional commit subjects with a body explaining the trigger, resulting behavior and validation. Generated consumers belong with their model change; do not hand-edit compiled output. Suitable `good first issue` candidates are a documented unsupported scaffold fixture, a specific troubleshooting example, or a regression test for an existing error message. Maintainers assign labels after confirming scope.

From the repository root:

```sh
cargo test -p airborne_server --locked
npm ci
npm test --workspace airborne-devkit
node smithy/scripts/test-generated.cjs
python3 scripts/test-quickstart-seed.py
python3 scripts/test-quickstart-teardown.py
python3 scripts/test-quickstart-isolation.py
python3 scripts/test-quickstart-addresses.py
python3 scripts/test-sample-assets.py
ruby scripts/test-init-podfile.rb
npm run build --prefix airborne_docs
```

Build the generated SDK first with `npm run build --workspace airborne-server-sdk`. Regenerate model consumers with `make generate-cli` using the pinned Smithy/Java toolchain. The transactional `scripts/test-compatibility-audit.sql` can be run with `psql -v ON_ERROR_STOP=1` against a disposable migrated database. Database integration tests marked ignored require a disposable migrated `TEST_DATABASE_URL`; never point them at shared data. Native acceptance needs the Android SDK/JDK, or Xcode/CocoaPods for iOS. Record platform, scaffold revision, SDK revision and exact build command.

Quickstart owns only its unique Compose project. Stop it with Ctrl-C; never run a global Docker prune or shut down another sandbox. Record sandbox readiness separately from first observed OTA boot. See [first OTA](airborne_docs/docs/guides/first-ota.md) and [recovery checklist](airborne_docs/docs/server/recovery-checklist.md).

For the larger disposable PostgreSQL lifecycle fixtures, use `RUST_MIN_STACK=33554432` with the test runner. Credential-dependent HTTP integration tests additionally need their documented scratch API/actor/token environment; an ignored test is not a pass.
