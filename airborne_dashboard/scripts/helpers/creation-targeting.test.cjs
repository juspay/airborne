const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
test("strict creation validates declared version or explained nonempty custom targeting", () => {
  const { validCreationTargeting: valid } = load("lib/control-center/creation-targeting");
  const rule = (dimension, values) => ({ dimension, values, operator: "equals" });
  assert.equal(valid(true, [], "An explanation longer than twenty characters"), false);
  assert.equal(valid(true, [rule("locale", "en")], ""), false);
  assert.equal(valid(true, [rule("app_version", "1.0")], ""), true);
  assert.equal(valid(true, [rule("version_cohort", "v1")], ""), true);
  assert.equal(valid(true, [rule("locale", "en")], "Tested this custom cohort against native v1"), true);
  assert.equal(valid(true, [rule("app_version", " ")], ""), false);
  assert.equal(valid(false, [], ""), true);
});

test("cloning creates a release and therefore uses the strict creation gate too", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.resolve(__dirname, "../../components/release/ReleaseFormContext.tsx"), "utf8");
  assert.match(source, /mode !== "edit" && locateApp/);
  assert.match(source, /compatibility_exception: compatibilityException.trim/);
});

test("exception bounds count Unicode characters consistently with the server", () => {
  const { validCreationTargeting: valid } = load("lib/control-center/creation-targeting");
  const rules = [{ dimension: "locale", values: "en", operator: "equals" }];
  assert.equal(valid(true, rules, "😀".repeat(10)), false);
  assert.equal(valid(true, rules, "😀".repeat(20)), true);
  assert.equal(valid(true, rules, "x".repeat(2001)), false);
});
