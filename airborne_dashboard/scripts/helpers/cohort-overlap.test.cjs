const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");

const ver = (key, v) => ({ [key]: [{ var: "app_version" }, v] });
const range = (lo, hi) => ({ and: [ver("jp_ver_ge", lo), ver("jp_ver_le", hi)] });

test("a new range finds the cohorts it overlaps and who takes the shared devices", () => {
  const { overlappingCohorts } = load("lib/cohort-overlap");
  const order = ["stable", "legacy", "beta", "otherwise"];
  const definitions = {
    stable: range("2.5.0", "3.0.0"),
    legacy: ver("jp_ver_lt", "2.0.0"),
    beta: ver("jp_ver_ge", "3.1.0"),
  };
  const found = [...overlappingCohorts(order, definitions, "2.0.0", "2.9.9", 0)].map((o) => ({ ...o }));
  assert.deepEqual(found, [{ name: "stable", index: 0, takenByNewRange: true }]);
  // Placed after "stable", the existing band keeps the shared devices.
  const after = [...overlappingCohorts(order, definitions, "2.0.0", "2.9.9", 1)].map((o) => ({ ...o }));
  assert.deepEqual(after, [{ name: "stable", index: 0, takenByNewRange: false }]);
});

test("range edges: touching at an inclusive end overlaps, an exclusive end does not", () => {
  const { overlappingCohorts } = load("lib/cohort-overlap");
  const order = ["a", "otherwise"];
  const hit = (definition, lo, hi) => overlappingCohorts(order, { a: definition }, lo, hi, 0).length === 1;
  assert.equal(hit(ver("jp_ver_ge", "2.9.9"), "2.0.0", "2.9.9"), true);
  assert.equal(hit(ver("jp_ver_gt", "2.9.9"), "2.0.0", "2.9.9"), false);
  assert.equal(hit(ver("jp_ver_le", "2.0.0"), "2.0.0", "2.9.9"), true);
  assert.equal(hit(ver("jp_ver_lt", "2.0.0"), "2.0.0", "2.9.9"), false);
  // A text comparison is not understood, so it is not reported.
  assert.equal(hit({ str_ge: [{ var: "x" }, "a"] }, "2.0.0", "2.9.9"), false);
});
