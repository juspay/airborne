// Final fix pass: capped pinned lines, long chains, group labels, release not found, request pairing in the source.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");
const dep = load("lib/control-center/deployments");
const scope = load("lib/control-center/scope");
const nf = load("lib/control-center/not-found");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
const row = (n, bucket = "attention") => ({
  org: "o",
  group: null,
  app: { application: `a${n}` },
  bucket,
  reasons: [],
});

test("pinned lines are capped at five with the rest counted by kind, and one extra line is shown rather than hidden", () => {
  const twelve = [...Array(9)].map((_, i) => row(i)).concat([...Array(3)].map((_, i) => row(100 + i, "rolling")));
  const c = dep.capPinned(twelve, false);
  assert.equal(c.shown.length, dep.PINNED_CAP);
  assert.equal(dep.PINNED_CAP, 5);
  assert.equal(c.hiddenAttention, 4);
  assert.equal(c.hiddenRolling, 3);
  const all = dep.capPinned(twelve, true);
  assert.equal(all.shown.length, 12);
  assert.equal(all.hiddenAttention + all.hiddenRolling, 0);
  // Six rows: hiding one behind "1 more" saves nothing, so all six show.
  assert.equal(dep.capPinned(twelve.slice(0, 6), false).shown.length, 6);
  assert.equal(dep.capPinned(twelve.slice(0, 7), false).shown.length, 5);
  assert.equal(dep.capPinned([], false).shown.length, 0);
});

test("a long release chain keeps its first and last step and counts the ones between", () => {
  const steps = (n) => [...Array(n)].map((_, i) => `S${i + 1}`);
  assert.equal(dep.chainText(steps(3)), "S1 → S2 → S3");
  assert.equal(dep.chainText(steps(5)), "S1 → S2 → S3 → S4 → S5");
  assert.equal(dep.chainText(steps(6)), "S1 → … (4 more) → S6");
  assert.equal(dep.chainText(steps(11)), "S1 → … (9 more) → S11");
});

test("a group with no readable name is never labelled by its id", () => {
  const id = "402033f0-96cf-4a11-8c5a-1e2f3a4b5c6d";
  assert.equal(scope.describeScope({ org: "acme", group: id }), "a group in acme");
  assert.equal(scope.describeScope({ org: "acme", group: id }, ""), "a group in acme");
  assert.equal(scope.describeScope({ org: "acme", group: id }, "Mobile"), "group Mobile in acme");
  assert.ok(!scope.describeScope({ org: "acme", group: id }).includes(id));
  assert.equal(scope.describeScope({ org: "acme", app: "web" }), "application web in acme");
});

test("an unknown release reads as not found, a failed read does not", () => {
  const err = (status, code) => Object.assign(new Error("x"), { status, body: code ? { code } : undefined });
  assert.equal(nf.isReleaseNotFound(err(404, "release_or_workspace_not_found")), true);
  assert.equal(nf.isReleaseNotFound(err(404, "release_not_found")), true);
  assert.equal(nf.isReleaseNotFound(err(404)), true);
  assert.equal(nf.isReleaseNotFound(err(502, "upstream_release_unavailable")), false);
  assert.equal(nf.isReleaseNotFound(err(503, "upstream_workspace_unavailable")), false);
  assert.equal(nf.isReleaseNotFound(new Error("network")), false);
  assert.equal(nf.isReleaseNotFound(undefined), false);
  assert.match(
    read("app/dashboard/control-center/[orgId]/apps/[appId]/releases/[releaseId]/page.tsx"),
    /isReleaseNotFound\(releaseQuery\.error\)/
  );
});

test("the application users page asks only once it knows the application, and the key names it", () => {
  const src = read("app/dashboard/[orgId]/[appId]/users/page.tsx");
  assert.match(src, /useParams/);
  assert.match(src, /token && org && app \? \["\/organisations\/applications\/user\/list", org, app\]/);
  assert.doesNotMatch(src, /token && org \? "\/organisations\/applications\/user\/list"/);
});

test("groups are asked for once per organisation and only for the ones needed", () => {
  const hooks = read("lib/control-center/hooks.ts");
  assert.match(hooks, /groupReads/);
  assert.match(read("components/scope/scope-picker.tsx"), /open \? orgNames : scope\.org \? \[scope\.org\] : \[\]/);
  assert.match(
    read("app/dashboard/control-center/deployments/page.tsx"),
    /useScopeGroups\(scope\.org \? \[scope\.org\] : \[\]/
  );
  assert.match(read("app/dashboard/control-center/page.tsx"), /useScopeGroups\(scope\.org \? \[scope\.org\] : \[\]/);
});

test("serving-policy and approval-policy changes share one neutral label, and the row shows the server's summary", () => {
  assert.equal(dep.actionLabel("policy_changed"), "Policy changed");
  const it = (summary) => ({
    app: "web",
    release_id: null,
    package_version: null,
    action: "policy_changed",
    recovered: false,
    summary,
  });
  assert.equal(
    dep.readableSummary(it("Serving policy: strict serving turned on")),
    "Serving policy: strict serving turned on"
  );
  assert.equal(dep.readableSummary(it("Approval policy turned on")), "Approval policy turned on");
  assert.ok(!/approval policy changed/i.test(read("components/control-center/timeline.tsx")));
});
