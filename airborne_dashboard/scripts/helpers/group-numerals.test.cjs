const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("./harness.cjs");
test("dense group flag cards share the incident numerals and retain a release link", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../components/control-center/telemetry.tsx"), "utf8");

  assert.match(source, /!onReleasePage &&/);
  assert.match(source, /\{rate\} reported failing/);
  assert.match(source, /Open release/);
});
