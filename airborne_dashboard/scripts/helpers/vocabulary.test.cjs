const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("approval vocabulary waits for a policy: the app page and group page offer one quiet line until then", () => {
  const app = read("app/dashboard/control-center/[orgId]/apps/[appId]/page.tsx");
  assert.match(app, /\(approvalOn \|\| !approvalKnown\) && \(/);
  assert.doesNotMatch(app, /Off: release changes here are direct/);
  assert.match(app, /setUp=\{/);
  const group = read("app/dashboard/control-center/[orgId]/groups/[groupId]/page.tsx");
  assert.match(group, /canSetPolicy && approvalOn > 0 && \(/);
  assert.match(group, /Set up approvals for this group/);
});

test("the marker button needs a policy, and in an incident locked buttons are left out", () => {
  const src = read("components/control-center/release-actions.tsx");
  assert.match(src, /policyOn && \(isOngoing \|\| isLive\) && !\(incident && \(notMaker \|\| !permissions\.update\)\)/);
  assert.match(src, /status === "INPROGRESS" && !\(incident && conclude\.disabled\)/);
});

test("an unknown approval state is still said, never hidden", () => {
  const app = read("app/dashboard/control-center/[orgId]/apps/[appId]/page.tsx");
  assert.match(app, /Unknown: approval state could not be verified/);
});
