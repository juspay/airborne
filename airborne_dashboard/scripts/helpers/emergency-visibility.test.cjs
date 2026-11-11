const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
test("only current checkers see emergency rollback", () => {
  const { canOfferEmergency } = load("lib/control-center/approval");
  const p = { enabled: true, emergency_rollback: true, checkers: ["a", "b"] };
  assert.equal(canOfferEmergency(p, "owner"), false);
  assert.equal(canOfferEmergency(p, "a"), true);
  assert.equal(canOfferEmergency(undefined, "a"), false);
});
