const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");

test("first-run creation goes to the organisation applications page", () => {
  const { createAppPath } = load("components/control-center/paths");
  assert.equal(createAppPath("scratch org"), "/dashboard/scratch%20org");
});

test("the Create an app step opens the form directly", () => {
  const { createAppFormPath } = load("components/control-center/paths");
  assert.equal(createAppFormPath("scratch org"), "/dashboard/scratch%20org?create=1");
  const page = fs.readFileSync(path.join(root, "app/dashboard/[orgId]/page.tsx"), "utf8");
  assert.match(page, /get\("create"\) === "1"/);
  assert.match(page, /wantsCreateForm && canCreateApplication/);
});

const app = (extra = {}) => ({
  application: "web",
  platform: "web",
  live: [],
  active: [],
  telemetry: { window_days: 7, releases: [] },
  ...extra,
});
const org = (apps) => ({ name: "o", groups: [], ungrouped: apps });
const seen = { telemetry: { window_days: 7, releases: [{ release_id: "r", reporting_devices: 3 }] } };
const live = { live: [{ release_id: "r" }] };

test("the checklist ticks from server state: app, first device, first live release", () => {
  const { firstRunProgress } = load("lib/control-center/first-run");
  const none = firstRunProgress(org([]));
  assert.deepEqual([none.app, none.device, none.release, none.complete], ["next", "todo", "todo", false]);
  const created = firstRunProgress(org([app()]));
  assert.deepEqual([created.app, created.device, created.release], ["done", "next", "todo"]);
  assert.equal(created.firstApp, "web");
  const deviceOnly = firstRunProgress(org([app(seen)]));
  assert.deepEqual([deviceOnly.app, deviceOnly.device, deviceOnly.release], ["done", "done", "next"]);
  const liveNoDevice = firstRunProgress(org([app(live)]));
  assert.deepEqual([liveNoDevice.device, liveNoDevice.release], ["next", "done"]);
  const all = firstRunProgress(org([app({ ...seen, ...live })]));
  assert.equal(all.complete, true);
});

test("a device step the server cannot see is unknown, never ticked and never failed", () => {
  const { firstRunProgress } = load("lib/control-center/first-run");
  const absent = firstRunProgress(org([app({ telemetry: undefined })]));
  assert.equal(absent.device, "unknown");
  const failed = firstRunProgress(org([app({ telemetry: { error: "boom" } })]));
  assert.equal(failed.device, "unknown");
  assert.equal(absent.complete, false);
});

test("an established organisation never sees the checklist, and a finished one sees the finished state once", () => {
  const { firstRunProgress, firstRunView } = load("lib/control-center/first-run");
  const established = firstRunProgress(org([app(live)]));
  assert.equal(firstRunView(established, null), "none");
  assert.equal(firstRunView(established, "active"), "checklist");
  const complete = firstRunProgress(org([app({ ...seen, ...live })]));
  assert.equal(firstRunView(complete, null), "none");
  assert.equal(firstRunView(complete, "active"), "finished");
  assert.equal(firstRunView(complete, "dismissed"), "none");
  const empty = firstRunProgress(org([]));
  assert.equal(firstRunView(empty, null), "checklist");
  assert.equal(firstRunView(empty, "dismissed"), "none");
});

test("the empty organisation list does not repeat the checklist's instruction", () => {
  const page = fs.readFileSync(path.join(root, "app/dashboard/control-center/page.tsx"), "utf8");
  assert.match(page, /noApps && firstRun !== "checklist"/);
  assert.doesNotMatch(page, /Ramp, then conclude explicitly/);
});

test("first manifest fetch stays seen with telemetry off or outside its window", () => {
  const { firstRunProgress } = load("lib/control-center/first-run");
  for (const telemetry of [undefined, { error: "off" }, { window_days: 7, releases: [] }]) {
    assert.equal(
      firstRunProgress(org([app({ first_device_seen_at: "2026-01-01T00:00:00Z", telemetry })])).device,
      "done"
    );
  }
});

test("a new server can report no first request even with telemetry off", () => {
  const { firstRunProgress } = load("lib/control-center/first-run");
  assert.equal(firstRunProgress(org([app({ first_device_seen_at: null, telemetry: undefined })])).device, "next");
});

test("an existing unstarted release supplies the start link", () => {
  const { firstRunProgress } = load("lib/control-center/first-run");
  const progress = firstRunProgress(
    org([app({ active: [{ release_id: "prepared", package_version: 1, status: "CREATED", traffic_percentage: 0 }] })])
  );
  assert.equal(progress.firstRelease.id, "prepared");
  assert.equal(progress.firstRelease.version, 1);
});
