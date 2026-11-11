const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");

const root = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const ev = (action, id, at) => ({ action, actor: "a", created_at: at, payload: id ? { id, action: "ramp" } : {} });

test("a request is one row however many events it left, and other events are untouched", () => {
  const { oneRowPerRequest } = load("lib/control-center/timeline-rows");
  const list = [
    ev("executed", "r2", "5"),
    ev("approved", "r2", "4"),
    ev("requested", "r2", "3"),
    ev("ramped", null, "2.5"),
    ev("requested", "r1", "2"),
    ev("created", null, "1"),
  ];
  const rows = oneRowPerRequest(list);
  assert.deepEqual(
    rows.map((r) => `${r.action}:${r.payload.id ?? "-"}`),
    ["executed:r2", "ramped:-", "requested:r1", "created:-"]
  );
});

test("request events without an id stay as they are", () => {
  const { oneRowPerRequest, requestIdOf } = load("lib/control-center/timeline-rows");
  const list = [ev("requested", null, "2"), ev("requested", null, "1")];
  assert.equal(oneRowPerRequest(list).length, 2);
  assert.equal(requestIdOf(list[0]), null);
  assert.equal(requestIdOf(ev("rolled_back", "x", "1")), null);
});

test("the timeline shows the latest five and offers the rest; a request's own page keeps its steps", () => {
  const src = read("components/control-center/timeline.tsx");
  assert.match(src, /TIMELINE_RECENT = 5/);
  assert.match(src, /Show all \$\{list\.length\}/);
  assert.match(read("components/control-center/request-card.tsx"), /byRequest=\{false\}/);
});

test("status enums and raw ids are not printed", () => {
  const card = read("components/control-center/request-card.tsx");
  assert.doesNotMatch(card, /\{String\(base\.status\)\}/);
  assert.match(card, /statusLabel\(String\(base\.status\)\)/);
  const page = read("app/dashboard/control-center/[orgId]/apps/[appId]/requests/[requestId]/page.tsx");
  assert.doesNotMatch(page, /<Mono>request \{request\.id\}<\/Mono>/);
});

test("plural forms: one app, one key", () => {
  const strip = read("components/control-center/attention-strip.tsx");
  assert.match(strip, /app\{totals\.apps === 1 \? "" : "s"\}/);
  assert.match(strip, /app\{summary\.stateUnknown === 1 \? "" : "s"\}/);
});

test("an unreadable page offers a real Refresh button and never says it was just updated", () => {
  const time = read("components/control-center/time.tsx");
  const unknown = time.slice(time.indexOf("if (unknown)"), time.indexOf("return (", time.indexOf("if (unknown)") + 20));
  assert.match(unknown, /<Button/);
  assert.match(unknown, /Refresh/);
  assert.doesNotMatch(unknown, /Updated/);
  for (const f of [
    "app/dashboard/control-center/[orgId]/apps/[appId]/releases/[releaseId]/page.tsx",
    "app/dashboard/control-center/[orgId]/apps/[appId]/page.tsx",
    "app/dashboard/control-center/[orgId]/apps/[appId]/requests/[requestId]/page.tsx",
  ])
    assert.match(read(f), /unknown=\{/, f);
});

test("the classic pages are a footer fallback, not header actions", () => {
  for (const f of [
    "app/dashboard/control-center/[orgId]/apps/[appId]/releases/[releaseId]/page.tsx",
    "app/dashboard/control-center/[orgId]/apps/[appId]/page.tsx",
  ]) {
    const src = read(f);
    assert.match(src, /<ClassicLink/, f);
    assert.doesNotMatch(src, /<ExternalLink/, f);
  }
});
