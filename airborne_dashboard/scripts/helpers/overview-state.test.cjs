const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
const { overviewStateWarning } = load("lib/control-center/overview-state");

test("failed auxiliary reads never imply approvals off or writes unpaused", () => {
  const app = {
    auxiliary_error: "deadline exceeded",
    approval_required: null,
    emergency_needs_review: null,
    release_protections: null,
    serving_policy: null,
    unresolved_operations: null,
  };
  assert.match(overviewStateWarning(app), /approvals, reviews, serving policy and paused writes could not be read/);
  assert.ok(overviewStateWarning({ auxiliary_error: "" }));
  assert.equal(overviewStateWarning({ auxiliary_error: null }), null);
  assert.equal(overviewStateWarning({}), null);
  assert.equal(overviewStateWarning(undefined), null);
});
