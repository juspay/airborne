const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("rollback words say who returns to what and when, without the engine's terms", () => {
  const c = load("lib/control-center/rollback-copy");
  const direct = `${c.rollbackHeadline("concluded_control", 1)} ${c.rollbackDirectBody("concluded_control", 2, 1)}`;
  assert.match(direct, /^Everyone in reach returns to v1\./);
  assert.match(direct, /Devices get v1 on their next update check/);
  assert.match(direct, /cannot be resumed/);
  assert.doesNotMatch(direct, /control variant|concludes|experiment/i);
  assert.match(c.rollbackDirectBody("rereleased", 2, 1), /new release of v1[^.]*replacing v2/);
  assert.match(c.rollbackHeadline("concluded_control", 0), /bundled in the app/);
  assert.match(c.rollbackHeadline("concluded_control", null), /previous release/);
  assert.match(c.rollbackHeadline("discarded", null), /Nothing changes for devices/);
  assert.match(c.rollbackRequestBody("concluded_control", 1), /^Nothing changes now\./);
});

test("a finished rollback reports the server change and leaves device recovery unconfirmed", () => {
  const c = load("lib/control-center/rollback-copy");
  assert.equal(c.serverNowServes(1), "Server now serves v1.");
  assert.equal(c.DEVICE_BOOT_UNCONFIRMED, "Device boot unconfirmed.");
  assert.doesNotMatch(c.serverNowServes(1), /restored|recovered|fixed/i);
  assert.equal(c.rollbackActionLabel("rereleased").includes("rereleased"), false);
  const dialog = read("components/control-center/release-actions.tsx");
  assert.match(dialog, /serverNowServes\(served\)/);
  assert.match(dialog, /DEVICE_BOOT_UNCONFIRMED/);
  assert.match(dialog, /See device reports/);
  // The config warning is kept in the result.
  assert.match(dialog, /<ReconciledNotice keys=\{reconciled\}[\s\S]{0,80}done/);
  assert.doesNotMatch(dialog, /restored\./);
});

test("the reason is prefilled from the flag and the placeholder fits the platform", () => {
  const c = load("lib/control-center/rollback-copy");
  const flag = {
    status: "seems_bad",
    failureRate: 0.48,
    row: { package_version: "2", boot_started: 25, platform: "web" },
  };
  assert.equal(c.reasonFromFlag(flag), "48% of 25 Web devices failed a boot on v2 (unverified reports).");
  assert.match(c.reasonFromFlag({ ...flag, status: "suspicious_reports" }), /^Failures up on v2: 48% of 25 Web/);
  assert.match(c.reasonFromFlag({ ...flag, failureRate: undefined }), /Boot failures reported on v2/);
  assert.doesNotMatch(c.reasonPlaceholder("web", false), /Android/);
  assert.match(c.reasonPlaceholder("android", false), /Android 14/);
  assert.doesNotMatch(c.reasonPlaceholder("other", false), /Android|iOS/);
});

test("the emergency review card keeps the server change apart from customer recovery", () => {
  const card = read("components/control-center/emergency-review.tsx");
  assert.match(card, /Server change/);
  assert.match(card, /Customer recovery/);
  assert.match(card, /Not confirmed\./);
  assert.doesNotMatch(card, /Replacement release:/);
});
