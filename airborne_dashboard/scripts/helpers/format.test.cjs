const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");

const format = () => load("lib/control-center/format");

const appWith = (status) => ({
  application: "a",
  live: [{ release_id: "r", dimensions: {} }],
  active: [],
  telemetry: {
    releases: [
      { release_id: "r", platform: "android", native_version: "1", signal: { status, baseline_release_id: null } },
    ],
  },
});

test("an app whose served release is observed_only counts as not enough data", () => {
  const f = format();
  assert.equal(f.summariseAttention([appWith("observed_only")]).insufficientData, 1);
  assert.equal(f.summariseAttention([appWith("insufficient_data")]).insufficientData, 1);
  assert.equal(f.summariseAttention([appWith("no_signal")]).insufficientData, 0);
});

test("only native-version dimensions are grouped as native versions", () => {
  const f = format();
  const native = (dims) => [...f.splitReach(dims).nativeVersions.map(([k]) => k)];
  assert.deepEqual(native({ app_version: "1", os: "ios", sdk_version: "2", build_number: "3" }).sort(), [
    "app_version",
    "build_number",
    "os",
    "sdk_version",
  ]);
  assert.deepEqual(native({ host: "canary", position: "a", cost_center: "b", locale: "kn" }), []);
});

test("unreadable auxiliary state cannot be counted as quiet", () => {
  const app = { application: "a", live: [], active: [], auxiliary_error: "journal unavailable" };
  assert.equal(format().summariseAttention([app]).stateUnknown, 1);
});
