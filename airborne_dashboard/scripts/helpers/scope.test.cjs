const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
const scope = load("lib/control-center/scope");
const dep = load("lib/control-center/deployments");
const { feedSearch } = dep;

const q = (s) => new URLSearchParams(s);
// The module runs in its own realm: compare plain data, not prototypes.
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
const eq = (a, b) => assert.deepEqual(plain(a), plain(b));

test("scope is read from the path when the page names its subject, else from the query", () => {
  eq(scope.scopeFromLocation("/dashboard/control-center", q("")), {});
  eq(scope.scopeFromLocation("/dashboard/control-center", q("org=acme&group=g1&app=web")), {
    org: "acme",
    group: "g1",
    app: "web",
  });
  // A group or application without an organisation holds nothing.
  eq(scope.scopeFromLocation("/dashboard/control-center/deployments", q("app=web")), {});
  eq(scope.scopeFromLocation("/dashboard/control-center/acme/apps/web", q("org=other")), {
    org: "acme",
    app: "web",
  });
  eq(scope.scopeFromLocation("/dashboard/control-center/acme/groups/g1", q("")), {
    org: "acme",
    group: "g1",
  });
  eq(scope.scopeFromLocation("/dashboard", q("org=acme")), {});
  eq(scope.scopeFromLocation("/dashboard/onboarding", q("")), {});
  eq(scope.scopeFromLocation("/dashboard/acme", q("")), { org: "acme" });
  eq(scope.scopeFromLocation("/dashboard/acme/users", q("")), { org: "acme" });
  eq(scope.scopeFromLocation("/dashboard/acme/web/files", q("")), { org: "acme", app: "web" });
  eq(scope.scopeFromLocation("/dashboard/my%20org/web", q("")), { org: "my org", app: "web" });
  eq(scope.scopeFromLocation("/login", q("org=acme")), {});
});

test("scope links keep the scope and drop what cannot hold", () => {
  assert.equal(scope.scopedHref(scope.CC_BASE, {}), "/dashboard/control-center");
  assert.equal(scope.scopedHref(scope.CC_BASE, { org: "a b" }), "/dashboard/control-center?org=a+b");
  assert.equal(scope.scopedHref(scope.CC_BASE, { app: "web" }), "/dashboard/control-center");
  assert.equal(
    scope.scopedHref(
      scope.DEPLOYMENTS_BASE,
      { org: "acme", group: "g", app: "web" },
      { action: ["a", "b"], actor: "" }
    ),
    "/dashboard/control-center/deployments?org=acme&group=g&app=web&action=a&action=b"
  );
});

test("choosing a scope keeps the kind of page, and choosing an application opens that application", () => {
  const acme = { org: "acme" };
  const web = { org: "acme", app: "web" };
  assert.equal(scope.scopeTarget("/dashboard/control-center", acme), "/dashboard/control-center?org=acme");
  // From the overview an application opens its own page: at application scope the Overview is that page.
  assert.equal(scope.scopeTarget("/dashboard/control-center", web), "/dashboard/control-center/acme/apps/web");
  assert.equal(
    scope.scopeTarget("/dashboard/control-center", { org: "acme", group: "g1", app: "web" }),
    "/dashboard/control-center/acme/apps/web"
  );
  assert.equal(
    scope.scopeTarget("/dashboard/control-center/acme/apps/old/releases/9", web),
    "/dashboard/control-center/acme/apps/web"
  );
  assert.equal(scope.scopeTarget("/dashboard/control-center/acme/apps/old", {}), "/dashboard/control-center");
  assert.equal(scope.overviewHref(web), "/dashboard/control-center/acme/apps/web");
  assert.equal(scope.overviewHref({ org: "acme", group: "g1" }), "/dashboard/control-center?org=acme&group=g1");
  assert.equal(scope.overviewHref({}), "/dashboard/control-center");
  assert.equal(
    scope.scopeTarget("/dashboard/control-center/deployments", web),
    "/dashboard/control-center/deployments?org=acme&app=web"
  );
  assert.equal(scope.scopeTarget("/dashboard/control-center/approvals/", {}), "/dashboard/control-center/approvals");
  // Classic application page: the same page of the other application.
  assert.equal(scope.scopeTarget("/dashboard/acme/old/files", web), "/dashboard/acme/web/files");
  assert.equal(scope.scopeTarget("/dashboard/acme/old", web), "/dashboard/acme/web");
  // A record page names the old application's record: land on the list.
  assert.equal(scope.scopeTarget("/dashboard/acme/old/releases/123/edit", web), "/dashboard/acme/web/releases");
  // Anything else opens the overview at the new scope.
  assert.equal(
    scope.scopeTarget("/dashboard/control-center/acme/apps/old", acme),
    "/dashboard/control-center?org=acme"
  );
  assert.equal(scope.scopeTarget("/dashboard/acme/old/files", acme), "/dashboard/control-center?org=acme");
  assert.equal(scope.scopeTarget("/dashboard/acme/users", web), "/dashboard/control-center/acme/apps/web");
});

const app = (name, extra = {}) => ({
  application: name,
  platform: "web",
  live: [],
  active: [],
  last_activity_at: null,
  error: null,
  ...extra,
});
const overview = {
  generated_at: "2026-01-01T00:00:00Z",
  organisations: [
    {
      name: "acme",
      groups: [{ id: "g1", name: "Product", members: [app("web"), app("ios")] }],
      ungrouped: [app("solo")],
    },
    { name: "beta", groups: [], ungrouped: [app("web")] },
  ],
};

test("the overview narrows to a scope and never invents an empty result for an unknown one", () => {
  const names = (o) => o.organisations.map((x) => x.name);
  assert.equal(scope.filterOverview(overview, {}), overview);
  eq(names(scope.filterOverview(overview, { org: "beta" })), ["beta"]);
  const g = scope.filterOverview(overview, { org: "acme", group: "g1" });
  eq(names(g), ["acme"]);
  assert.equal(g.organisations[0].groups[0].members.length, 2);
  assert.equal(g.organisations[0].ungrouped.length, 0);
  const a = scope.filterOverview(overview, { org: "acme", app: "web" });
  eq(
    a.organisations[0].groups[0].members.map((m) => m.application),
    ["web"]
  );
  // The same application name in another organisation is not in scope.
  assert.equal(scope.filterOverview(overview, { org: "acme", app: "solo" }).organisations[0].ungrouped.length, 1);
  eq(names(scope.filterOverview(overview, { org: "nope" })), []);
  eq(names(scope.filterOverview(overview, { org: "acme", group: "gone" })), []);
  eq(names(scope.filterOverview(overview, { org: "acme", app: "gone" })), []);
  assert.equal(scope.filterOverview(undefined, { org: "acme" }), undefined);
});

test("the picker tree offers only applications the caller can read, and leaves them flat when groups are unreadable", () => {
  const orgs = [
    { name: "acme", applications: [{ application: "web" }, { application: "ios" }, { application: "solo" }] },
    { name: "beta", applications: [{ application: "web" }] },
  ];
  const groups = {
    acme: [{ id: "g1", name: "Product", members: [{ application: "web" }, { application: "hidden" }] }],
  };
  const tree = scope.buildScopeTree(orgs, groups);
  eq(tree[0].groups, [{ id: "g1", name: "Product", apps: [{ application: "web" }] }]);
  eq(
    tree[0].ungrouped.map((a) => a.application),
    ["ios", "solo"]
  );
  // beta's groups read was refused: its application stays listed.
  eq(
    tree[1].ungrouped.map((a) => a.application),
    ["web"]
  );
  eq(scope.resolveGroup({ org: "acme", app: "web" }, tree), {
    id: "g1",
    name: "Product",
    apps: [{ application: "web" }],
  });
  assert.equal(scope.resolveGroup({ org: "acme", app: "solo" }, tree), undefined);
  assert.equal(scope.scopeExists({ org: "acme", app: "web" }, tree), true);
  assert.equal(scope.scopeExists({ org: "acme", app: "gone" }, tree), false);
  assert.equal(scope.scopeExists({ org: "nope" }, tree), false);
  assert.equal(scope.scopeExists({ org: "beta", group: "anything" }, tree), true, "no groups read proves nothing");
  assert.equal(scope.scopeExists({ org: "acme" }, undefined), undefined);
});

test("feed filters round-trip through the URL and ignore what the server does not know", () => {
  const f = dep.filtersFromSearch(
    q("action=ramped&action=bogus&action=rolled_back&platform=ios&actor=sam%40x&since=7d")
  );
  eq(
    f.actions,
    ["rolled_back", "ramped"].sort((a, b) => dep.FEED_ACTIONS.indexOf(a) - dep.FEED_ACTIONS.indexOf(b))
  );
  assert.equal(f.platform, "ios");
  assert.equal(f.since, "7d");
  assert.equal(dep.filtersFromSearch(q("platform=windows&since=forever")).platform, undefined);
  assert.equal(dep.filtersFromSearch(q("since=forever")).since, "any");
  assert.equal(dep.filtersActive(dep.NO_FILTERS), false);
  assert.equal(dep.filtersActive({ ...dep.NO_FILTERS, actor: "  " }), false);
  eq(dep.filtersToParams(dep.NO_FILTERS), {
    action: undefined,
    platform: undefined,
    actor: undefined,
    since: undefined,
  });
});

test("status chips toggle whole sets of actions and 'on' means every action of the chip is selected", () => {
  const chip = dep.STATUS_CHIPS.find((c) => c.key === "rolled_back");
  const on = dep.toggleChip(["created"], chip.actions);
  eq(on, ["created", "rolled_back", "emergency_rollback", "rollback_abandoned", "emergency_acknowledged"]);
  eq(dep.toggleChip(on, chip.actions), ["created"]);
  // One action of the chip already selected: the chip completes rather than clearing.
  eq(dep.toggleChip(["rolled_back"], chip.actions), [
    "rolled_back",
    "emergency_rollback",
    "rollback_abandoned",
    "emergency_acknowledged",
  ]);
  const covered = new Set(dep.STATUS_CHIPS.flatMap((c) => c.actions));
  for (const a of dep.FEED_ACTIONS) assert.ok(covered.has(a), `${a} is behind a chip`);
});

test("the feed query carries scope and filters, repeats action, and rounds since to the hour", () => {
  const now = new Date("2026-03-10T10:47:12Z");
  const query = dep.feedQuery(
    { org: "acme", group: "g1" },
    { actions: ["ramped", "created"], platform: "web", actor: " sam ", since: "24h" },
    now
  );
  assert.equal(query.since, "2026-03-09T10:00:00.000Z");
  assert.equal(
    feedSearch({ ...query, cursor: "c1" }),
    "?org=acme&group=g1&platform=web&actor=sam&since=2026-03-09T10%3A00%3A00.000Z&cursor=c1&action=ramped&action=created&limit=50"
  );
  assert.equal(feedSearch({}), "");
});

const item = (id, over = {}) => ({
  event_id: id,
  at: "2026-03-10T10:00:00Z",
  org: "acme",
  group: null,
  app: "web",
  platform: "web",
  release_id: "r",
  package_version: "2",
  action: "ramped",
  actor: "a@x",
  from_target: 0,
  to_target: 50,
  summary: "s",
  ...over,
});

test("pages merge newest first, show an event once, and keep partial from any page", () => {
  const v = dep.mergePages([
    { items: [item("1"), item("2")], next_cursor: "c", partial: false, errors: [] },
    {
      items: [item("2"), item("3")],
      next_cursor: null,
      partial: true,
      errors: [{ org: "acme", app: "ios", reason: "timeout" }],
    },
  ]);
  eq(
    v.items.map((i) => i.event_id),
    ["1", "2", "3"]
  );
  assert.equal(v.partial, true);
  assert.equal(v.nextCursor, null);
  assert.equal(v.errors.length, 1);
  // Errors without the flag are still an incomplete read.
  assert.equal(
    dep.mergePages([{ items: [], next_cursor: null, partial: false, errors: [{ org: "o", app: null, reason: "x" }] }])
      .partial,
    true
  );
  assert.equal(dep.mergePages([]).partial, false);
});

test("day labels are Today, Yesterday, then the date", () => {
  const now = new Date(2026, 2, 10, 12, 0, 0);
  assert.equal(dep.dayLabel(new Date(2026, 2, 10, 1, 0, 0).toISOString(), now), "Today");
  assert.equal(dep.dayLabel(new Date(2026, 2, 9, 23, 0, 0).toISOString(), now), "Yesterday");
  assert.match(dep.dayLabel(new Date(2026, 2, 1, 9, 0, 0).toISOString(), now), /1 Mar/);
  assert.match(dep.dayLabel(new Date(2025, 2, 1, 9, 0, 0).toISOString(), now), /2025/);
  assert.equal(dep.dayLabel("not a date", now), "Unknown date");
});

test("what is live now pins flagged, paused, review and approval items first, and unknown is never quiet", () => {
  const rolling = app("rolling", {
    active: [{ release_id: "r", status: "INPROGRESS", traffic_percentage: 10 }],
    last_activity_at: "2026-03-10T00:00:00Z",
  });
  const live = app("live", { live: [{ release_id: "l", dimensions: {} }] });
  const nothing = app("nothing");
  const approval = app("approval", { pending_requests: 2 });
  const paused = app("paused", { unresolved_operations: [{ operation_id: "o", message: "m" }] });
  const review = app("review", { emergency_needs_review: [{ id: "e", acknowledged_by: null }] });
  const failed = app("failed", { error: "Release lookup failed or timed out" });
  const reviewed = app("reviewed", {
    emergency_needs_review: [{ id: "e", acknowledged_by: "me" }],
    live: [{ release_id: "l", dimensions: {} }],
  });
  const partial = app("partial", {
    auxiliary_error: "Auxiliary status unavailable",
    live: [{ release_id: "l", dimensions: {} }],
  });
  const ov = {
    generated_at: "x",
    organisations: [
      {
        name: "acme",
        groups: [],
        ungrouped: [nothing, live, rolling, approval, review, paused, failed, reviewed, partial],
      },
    ],
  };
  const rows = dep.nowApps(ov);
  const order = rows.map((r) => r.app.application);
  eq(order.slice(0, 6), ["failed", "paused", "review", "approval", "partial", "rolling"]);
  eq(
    rows.map((r) => r.bucket),
    ["attention", "attention", "attention", "attention", "attention", "rolling", "live", "live", "nothing"]
  );
  assert.ok(rows.find((r) => r.app.application === "partial").reasons.includes("state partly unreadable"));
  assert.equal(rows.find((r) => r.app.application === "reviewed").bucket, "live");
  eq(dep.nowApps(undefined), []);
});

test("the picker lists the tree, searches by name keeping parents, and puts the cursor on the best match", () => {
  const tree = scope.buildScopeTree(
    [
      { name: "acme", applications: [{ application: "web" }, { application: "ios" }, { application: "solo" }] },
      { name: "beta", applications: [{ application: "web" }] },
    ],
    { acme: [{ id: "g1", name: "Product", members: [{ application: "web" }, { application: "ios" }] }] }
  );
  const all = scope.pickerRows(tree, "", new Set(["acme", "beta"]));
  eq(
    all.map((r) => r.kind),
    ["all", "org", "group", "app", "app", "app", "org", "app"]
  );
  assert.ok(all.every((r) => !r.match));
  const solo = scope.pickerRows(tree, "SOLO");
  eq(
    solo.map((r) => r.label),
    ["acme", "solo"]
  );
  eq(
    solo.map((r) => r.match),
    [false, true]
  );
  // An organisation match brings its whole tree, and is the one match.
  const org = scope.pickerRows(tree, "beta");
  eq(
    org.map((r) => r.label),
    ["beta", "web"]
  );
  eq(
    org.map((r) => r.match),
    [true, false]
  );
  // The same application name under two organisations is two rows with two scopes.
  const web = scope.pickerRows(tree, "web").filter((r) => r.match);
  eq(
    web.map((r) => r.scope),
    [
      { org: "acme", group: "g1", app: "web" },
      { org: "beta", app: "web" },
    ]
  );
  assert.equal(scope.pickerRows(tree, "zzz").length, 0);
  assert.equal(scope.pickerRows(tree, "all")[0].kind, "all");
});

test("without a search only the organisation in scope or one the person opened lists its contents", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ application: `a${i}` }));
  const tree = scope.buildScopeTree(
    [
      { name: "big", applications: many },
      { name: "small", applications: [{ application: "web" }] },
    ],
    {}
  );
  eq(
    scope.pickerRows(tree, "").map((r) => r.key),
    ["all", "org:big", "org:small"]
  );
  const opened = scope.pickerRows(tree, "", new Set(["small"]));
  eq(
    opened.map((r) => r.key),
    ["all", "org:big", "org:small", "app:small::web"]
  );
  const big = scope.pickerRows(tree, "", new Set(["big"]));
  assert.equal(big.length, 33);
  const row = big.find((r) => r.key === "org:big");
  assert.equal(row.apps, 30);
  assert.equal(row.expanded, true);
  // A search always lists matches with their parents, whatever was opened.
  eq(
    scope.pickerRows(tree, "web").map((r) => r.key),
    ["org:small", "app:small::web"]
  );
});
