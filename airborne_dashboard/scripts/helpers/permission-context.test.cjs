const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
test("org pages omit app-scoped checks without weakening their decisions", () => {
  const { contextualPermissionChecks } = load("lib/page-permissions");
  const checks = [
    { resource: "application", action: "create", scope: "org" },
    { resource: "release", action: "create", scope: "app" },
  ];
  assert.equal(contextualPermissionChecks(checks, null).length, 1);
  assert.equal(contextualPermissionChecks(checks, "web").length, 2);
});
