const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const request = (action, body, base) => ({
  action,
  payload: { release_id: "r2", body },
  base_state: { releases: base ? [{ id: "r2", traffic_percentage: base }] : [] },
});

const row = (status, extra = {}) => ({
  release_id: "r2",
  package_version: "2",
  native_version: "2.8.0",
  platform: "web",
  boot_started: 25,
  boot_success: 13,
  boot_failed: 12,
  signal: { status, boot_failure_rate: 0.48, baseline_release_id: null },
  ...extra,
});

const app = (rows, extra = {}) => ({
  application: "web",
  live: [],
  active: [{ release_id: "r2", package_version: 2, status: "INPROGRESS", traffic_percentage: 25 }],
  telemetry: { window_days: 7, releases: rows },
  ...extra,
});

test("a request widens a release when it concludes it or raises its target", () => {
  const { raisesExposure } = load("lib/control-center/approval");
  assert.equal(raisesExposure(request("conclude", {}, 25)), true);
  assert.equal(raisesExposure(request("ramp", { traffic_percentage: 50 }, 25)), true);
  assert.equal(raisesExposure(request("ramp", { traffic_percentage: 25 }, 25)), false);
  assert.equal(raisesExposure(request("ramp", { traffic_percentage: 5 }, 25)), false);
  // A base that was not recorded is read as raising: the cost is one extra tick.
  assert.equal(raisesExposure(request("ramp", { traffic_percentage: 10 })), true);
  assert.equal(raisesExposure(request("ramp", {}, 25)), true);
  assert.equal(raisesExposure(request("rollback", {}, 25)), false);
  assert.equal(raisesExposure(request("set_rollback_sensitive", { rollback_sensitive: "x" }, 25)), false);
});

test("release evidence says flagged, reports, none or unknown, and unknown is never healthy", () => {
  const { evidenceForRelease } = load("lib/control-center/telemetry");
  assert.equal(evidenceForRelease(app([row("seems_bad")]), "r2").kind, "flagged");
  assert.equal(evidenceForRelease(app([row("suspicious_reports")]), "r2").kind, "flagged");
  assert.equal(evidenceForRelease(app([row("no_signal")]), "r2").kind, "reports");
  assert.equal(evidenceForRelease(app([row("insufficient_data")]), "r2").kind, "reports");
  assert.deepEqual(JSON.parse(JSON.stringify(evidenceForRelease(app([]), "r2"))), {
    kind: "none",
    availability: "silent",
  });
  assert.equal(evidenceForRelease(app([row("no_signal", { release_id: "other" })]), "r2").kind, "none");
  // The read failed, the server does not report, or the overview is not here: all unknown.
  assert.deepEqual(JSON.parse(JSON.stringify(evidenceForRelease(app([], { telemetry: { error: "boom" } }), "r2"))), {
    kind: "unknown",
    reason: "unavailable",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(evidenceForRelease(app([], { telemetry: undefined }), "r2"))), {
    kind: "unknown",
    reason: "absent",
  });
  assert.equal(evidenceForRelease(undefined, "r2").kind, "unknown");
  assert.equal(evidenceForRelease(app([]), "r2", true).kind, "unknown");
  assert.equal(evidenceForRelease(app([row("no_signal")]), "r2", true).kind, "unknown");
  // A flag already on screen stays, even if the latest refresh failed.
  assert.equal(evidenceForRelease(app([row("seems_bad")]), "r2", true).kind, "flagged");
});

test("the decision panel, dialog, queue row and request page all carry the evidence", () => {
  const card = read("components/control-center/request-card.tsx");
  assert.match(card, /<EvidenceBlock[\s\S]*?evidence=\{evidence\}/);
  assert.match(card, /<FlagAcknowledge/);
  assert.match(card, /needsFlagAck/);
  assert.match(card, /rejectLeads/);
  assert.match(card, /flagForRelease\(app,/);
  const page = read("app/dashboard/control-center/[orgId]/apps/[appId]/requests/[requestId]/page.tsx");
  assert.match(page, /evidenceForRelease\(located\.app, releaseId/);
  assert.match(page, /evidence=\{evidence\}/);
  const queue = read("app/dashboard/control-center/approvals/page.tsx");
  assert.match(queue, /app=\{apps\.find/);
});

test("when the overview failed, 'now' reads unknown rather than a loading ellipsis", () => {
  const card = read("components/control-center/request-card.tsx");
  assert.match(card, /unreadable \? <span className="text-muted-foreground">unknown<\/span> : "…"/);
  assert.doesNotMatch(card, /^\s+"…"\s*$/m);
  const page = read("app/dashboard/control-center/[orgId]/apps/[appId]/requests/[requestId]/page.tsx");
  assert.match(page, /unreadable=\{Boolean\(overviewError\) && !overview\}/);
});
