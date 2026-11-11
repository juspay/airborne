const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
const eq = (a, b) => assert.deepEqual(plain(a), plain(b));

test("adoption rows of releases not served now are set apart, never dropped, and never hide an unserved-only table", () => {
  const { splitServedRows } = load("lib/control-center/telemetry");
  const row = (id) => ({ release_id: id, package_version: "2" });
  const rows = [row("a"), row("b"), row("c"), row("d")];
  const served = new Set(["a", "c"]);
  const split = splitServedRows(rows, (id) => served.has(id));
  eq(
    split.served.map((r) => r.release_id),
    ["a", "c"]
  );
  eq(
    split.earlier.map((r) => r.release_id),
    ["b", "d"]
  );
  assert.equal(split.collapsible, true);
  const none = splitServedRows(rows, () => false);
  assert.equal(none.collapsible, false);
  assert.equal(none.served.length + none.earlier.length, 4);
  assert.equal(splitServedRows(rows, () => true).collapsible, false);
});
