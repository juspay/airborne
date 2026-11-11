const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("the incident headline is the failure rate in words, with no stray full stop after a qualifier", () => {
  const src = read("components/control-center/telemetry.tsx");
  assert.match(src, /\{rate\} reported failing/);
  assert.doesNotMatch(src, /\(unverified reports\)<\/span>\s*\./);
  assert.doesNotMatch(src, /reporting from \{platform\} failed a boot/);
});

test("a flagged release leads with failed devices, in the overview line and the adoption block", () => {
  const src = read("components/control-center/telemetry.tsx");
  assert.match(src, /function isFlaggedRows/);
  assert.match(src, /isFlaggedRows\(a\.rows\) \?/);
  assert.match(src, /of <span className="tabular-nums">\{compactCount\(a\.started\)\}<\/span> failed/);
});

test("on the overview a flag has its own line with its percentage, and routine chips step aside", () => {
  const src = read("components/control-center/app-status-row.tsx");
  assert.match(src, /<AppFlagChip org=\{org\} app=\{app\} variant="badge"/);
  assert.match(src, /\{!flagged && \(\s*<ServingChip/);
  assert.match(read("components/control-center/telemetry.tsx"), /failing`\}/);
});

test("a reach restriction is neutral, not amber, and wraps instead of colliding with the next column", () => {
  const src = read("components/control-center/app-status-row.tsx");
  const chip = src.slice(src.indexOf("{onlyTargeted && ("), src.indexOf("RelativeTime iso={defaultLive.concluded_at}"));
  assert.match(chip, /tone="muted"/);
  assert.doesNotMatch(chip, /tone="waiting"/);
  assert.match(chip, /whitespace-normal/);
});
