const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
test("first-run creation goes to the organisation applications page", () => {
  const { createAppPath } = load("components/control-center/paths");
  assert.equal(createAppPath("scratch org"), "/dashboard/scratch%20org");
});
