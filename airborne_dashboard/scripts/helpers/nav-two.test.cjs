// Second navigation pass: failed reads versus missing scopes, the remembered scope, feed rows and the server's
// completeness note.
const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
const scope = load("lib/control-center/scope");
const dep = load("lib/control-center/deployments");

const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
const eq = (a, b) => assert.deepEqual(plain(a), plain(b));

const app = (name, extra = {}) => ({
  application: name,
  platform: "web",
  live: [],
  active: [],
  last_activity_at: null,
  error: null,
  ...extra,
});
const ov = (orgs) => ({ generated_at: "2026-01-01T00:00:00Z", organisations: orgs });

test("a group or application missing from a cut-short read is unconfirmed, not 'does not exist'", () => {
  const cut = ov([{ name: "a", groups: [], ungrouped: [], groups_error: true }]);
  const f = scope.filterOverview(cut, { org: "a", group: "g1" });
  assert.equal(f.organisations.length, 1, "the organisation stays, so the page can say its read was cut short");
  assert.equal(scope.scopeOutcome(f, { org: "a", group: "g1" }), "unconfirmed");
  const auth = ov([{ name: "a", groups: [], ungrouped: [], authorization_error: true }]);
  assert.equal(
    scope.scopeOutcome(scope.filterOverview(auth, { org: "a", app: "x" }), { org: "a", app: "x" }),
    "unconfirmed"
  );
  // A clean read that lacks the application: it is not there, or not readable.
  const clean = ov([{ name: "a", groups: [], ungrouped: [app("web")] }]);
  const none = scope.filterOverview(clean, { org: "a", app: "x" });
  assert.equal(none.organisations.length, 0);
  assert.equal(scope.scopeOutcome(none, { org: "a", app: "x" }), "not_found");
  assert.equal(scope.scopeOutcome(scope.filterOverview(clean, { org: "zzz" }), { org: "zzz" }), "not_found");
  // Found things are found, with or without a read error elsewhere.
  assert.equal(
    scope.scopeOutcome(scope.filterOverview(clean, { org: "a", app: "web" }), { org: "a", app: "web" }),
    "found"
  );
  const mixed = ov([{ name: "a", groups: [], ungrouped: [app("web")], authorization_error: true }]);
  assert.equal(
    scope.scopeOutcome(scope.filterOverview(mixed, { org: "a", app: "web" }), { org: "a", app: "web" }),
    "found"
  );
  // An empty organisation is real; All is always found; nothing loaded yet says nothing.
  assert.equal(scope.scopeOutcome(ov([{ name: "e", groups: [], ungrouped: [] }]), { org: "e" }), "found");
  assert.equal(scope.scopeOutcome(ov([]), {}), "found");
  assert.equal(scope.scopeOutcome(undefined, { org: "a" }), undefined);
});

test("the last scope is stored as plain data, read back defensively, and only restored while it still exists", () => {
  assert.equal(scope.serialiseScope({ org: "a", group: "g", app: "x" }), '{"org":"a","group":"g","app":"x"}');
  assert.equal(scope.serialiseScope({ group: "g" }), "{}", "a group without an organisation holds nothing");
  eq(scope.parseStoredScope('{"org":"a","app":"x"}'), { org: "a", app: "x" });
  for (const bad of [null, undefined, "", "nope", "[]", "42", '{"org":7}', '{"org":"' + "x".repeat(300) + '"}']) {
    eq(scope.parseStoredScope(bad), {});
  }
  const orgs = [{ name: "a", applications: [{ application: "x" }] }];
  eq(scope.restorableScope({ org: "a", app: "x" }, orgs), { org: "a", app: "x" });
  // The application has gone: the organisation is still a fair place to open.
  eq(scope.restorableScope({ org: "a", app: "gone" }, orgs), { org: "a" });
  assert.equal(scope.restorableScope({ org: "gone" }, orgs), undefined);
  assert.equal(scope.restorableScope({}, orgs), undefined, "All stays All");
  assert.equal(scope.appKnown(orgs, "a", "x"), true);
  assert.equal(scope.appKnown(orgs, "a", "nope"), false);
  assert.equal(scope.appKnown(orgs, "b", "x"), false);
  assert.equal(scope.appKnown(undefined, "a", "x"), undefined);
  assert.equal(scope.appKnown([], "a", "x"), undefined);
});

test("any action name gets a sensible label; known ones keep theirs", () => {
  assert.equal(dep.actionLabel("concluded"), "Concluded");
  assert.equal(dep.actionLabel("failed"), "Request failed");
  assert.equal(dep.actionLabel("operation_resolved"), "Operation resolved");
  assert.equal(dep.actionLabel("some-new_action"), "Some new action");
  assert.equal(dep.actionLabel(""), "Unknown event");
  // Not fooled by names that exist on every object.
  assert.equal(dep.actionLabel("constructor"), "Constructor");
  assert.equal(dep.actionLabel("toString"), "Tostring");
});

const item = (id, over = {}) => ({
  event_id: id,
  at: "2026-03-10T10:00:00Z",
  org: "acme",
  group: null,
  app: "web",
  platform: "web",
  release_id: "7522599980729765888",
  package_version: null,
  action: "ramped",
  recovered: false,
  actor: "a@x",
  from_target: null,
  to_target: 50,
  summary: "Ramping release 7522599980729765888 to 50% traffic",
  ...over,
});

test("a row names a release by its version, and by a short id only when there is no version", () => {
  assert.equal(dep.releaseLabel(item("1", { package_version: "2" })), "v2");
  assert.equal(dep.releaseLabel(item("1", { package_version: "v3.1" })), "v3.1");
  assert.equal(dep.releaseLabel(item("1")), "release …765888");
  assert.equal(dep.releaseLabel(item("1", { release_id: "r7" })), "release r7");
  assert.equal(dep.releaseLabel(item("1", { release_id: null })), null);
  assert.equal(dep.readableSummary(item("1", { package_version: "2" })), "web v2 ramped to 50%");
  assert.equal(dep.readableSummary(item("1")), "web release …765888 ramped to 50%");
  assert.equal(
    dep.readableSummary(item("1", { action: "policy_changed", summary: "Policy changed" })),
    "Policy changed"
  );
  assert.equal(dep.readableSummary(item("1", { release_id: null })), "web ramped to 50%");
});

test("consecutive events of one release collapse into one row, newest first, and nothing else does", () => {
  const rows = dep.groupFeed([
    item("1", { action: "concluded" }),
    item("2", { action: "ramped" }),
    item("3", { action: "created" }),
    item("4", { release_id: "other", action: "created" }),
    item("5", { action: "ramped" }),
    item("6", { release_id: null, action: "policy_changed" }),
    item("7", { release_id: null, action: "policy_changed" }),
    item("8", { app: "ios", action: "ramped" }),
    item("9", { app: "ios", org: "beta", action: "ramped" }),
  ]);
  eq(
    rows.map((r) => r.items.map((i) => i.event_id)),
    [["1", "2", "3"], ["4"], ["5"], ["6"], ["7"], ["8"], ["9"]],
    "a release seen again after another is a different row, and an event with no release stands alone"
  );
  eq(dep.groupFeed([]), []);
});

const page = (ids, next = null, extra = {}) => ({
  items: ids.map((i) => item(i)),
  next_cursor: next,
  partial: false,
  errors: [],
  ...extra,
});

test("polling merges the first page into the loaded pages without a hole, and asks for a reload when it cannot", () => {
  const loaded = [page(["c", "d"], "k1"), page(["e", "f"], null)];
  // One new event on top: the loaded pages keep their cursors.
  const merged = dep.mergeHead(loaded, page(["b", "c"], "fresh"));
  eq(
    merged.pages[0].items.map((i) => i.event_id),
    ["b", "c", "d"]
  );
  assert.equal(merged.pages[0].next_cursor, "k1", "the cursor that continues the loaded pages is kept");
  assert.equal(merged.pages.length, 2);
  assert.equal(merged.newer, false);
  eq(
    dep.mergePages(merged.pages).items.map((i) => i.event_id),
    ["b", "c", "d", "e", "f"]
  );
  // Nothing changed.
  assert.equal(dep.mergeHead(loaded, loaded[0]).pages, loaded);
  eq(
    dep.mergeHead(loaded, page(["c", "d"], "fresh")).pages[0].items.map((i) => i.event_id),
    ["c", "d"]
  );
  // More new events than a page holds: no overlap, so nothing is merged and the caller offers a reload.
  const gap = dep.mergeHead(loaded, page(["x", "y"], "fresh"));
  assert.equal(gap.newer, true);
  assert.equal(gap.pages, loaded);
  // The newest read of the applications that could be read wins; nothing polled yet is a no-op.
  const bad = dep.mergeHead(
    loaded,
    page(["c", "d"], "f", { partial: true, errors: [{ org: "a", app: "b", reason: "t" }] })
  );
  assert.equal(dep.mergePages(bad.pages).partial, true);
  const healed = dep.mergeHead([page(["c"], null, { partial: true })], page(["c"], null));
  assert.equal(dep.mergePages(healed.pages).partial, false);
  assert.equal(dep.mergeHead(loaded, undefined).pages, loaded);
  // An empty feed that gained its first events.
  eq(
    dep.mergeHead([page([], null)], page(["a"], null)).pages[0].items.map((i) => i.event_id),
    ["a"]
  );
});

test("the server's completeness field becomes an honest note, and its absence says nothing", () => {
  assert.equal(dep.completenessNote(undefined), null);
  assert.equal(dep.completenessNote(null), null);
  assert.equal(dep.completenessNote("complete"), null);
  assert.equal(dep.completenessNote({ complete: true, notes: ["ignored"] }), null);
  assert.match(dep.completenessNote("best_effort").text, /best-effort/);
  assert.match(dep.completenessNote("Best-Effort").text, /best-effort/);
  assert.match(dep.completenessNote("partial_history").text, /not proof/);
  assert.match(dep.completenessNote("partial_history").text, /Partial history/i);
  const obj = dep.completenessNote({
    complete: false,
    notes: ["Edits are not audited.", 3, ""],
    best_effort_actions: ["cache_failed"],
  });
  assert.match(obj.text, /not proof/);
  eq(obj.notes, ["Edits are not audited."]);
  const derived = dep.completenessNote({ complete: false, best_effort_actions: ["cache_failed"] });
  assert.match(derived.notes[0], /CDN cache not cleared/);
  // An object that says nothing either way is not turned into a claim.
  assert.equal(dep.completenessNote({}), null);
  assert.equal(dep.completenessNote(7), null);
  // The note travels with the pages: the newest page that carries one.
  const v = dep.mergePages([page(["a"], "c"), page(["b"], null, { audit_completeness: "best_effort" })]);
  assert.equal(v.completeness, "best_effort");
  assert.equal(dep.mergePages([page(["a"])]).completeness, undefined);
});

test("only what needs a person or is moving is pinned above the feed", () => {
  const rolling = app("rolling", { active: [{ release_id: "r", status: "INPROGRESS", traffic_percentage: 10 }] });
  const rows = dep.nowApps(
    ov([
      {
        name: "a",
        groups: [],
        ungrouped: [
          app("quiet"),
          app("live", { live: [{ release_id: "l", dimensions: {} }] }),
          rolling,
          app("bad", { error: "x" }),
        ],
      },
    ])
  );
  eq(
    dep.pinnedApps(rows).map((r) => r.app.application),
    ["bad", "rolling"]
  );
});

test("Create asks about the applications inside the scope, narrowed by what was typed", () => {
  const tree = scope.buildScopeTree(
    [
      { name: "acme", applications: [{ application: "web" }, { application: "ios" }, { application: "solo" }] },
      { name: "beta", applications: [{ application: "web" }] },
    ],
    { acme: [{ id: "g1", name: "Product", members: [{ application: "web" }, { application: "ios" }] }] }
  );
  const names = (c) => c.map((x) => `${x.org}/${x.app}${x.group ? ` (${x.group})` : ""}`);
  eq(names(scope.appChoices(tree, {})), ["acme/ios (Product)", "acme/solo", "acme/web (Product)", "beta/web"]);
  eq(names(scope.appChoices(tree, { org: "beta" })), ["beta/web"]);
  eq(names(scope.appChoices(tree, { org: "acme", group: "g1" })), ["acme/ios (Product)", "acme/web (Product)"]);
  // A group that cannot be found in the list does not hide the organisation's applications.
  eq(names(scope.appChoices(tree, { org: "beta", group: "g9" })), ["beta/web"]);
  eq(names(scope.appChoices(tree, {}, "SO")), ["acme/solo"]);
  eq(names(scope.appChoices(tree, {}, "beta")), ["beta/web"]);
  eq(scope.appChoices(tree, { org: "gone" }), []);
});

test("an approved row reads the outcome of its own request, never one that only shares its release", () => {
  const items = [
    // Request r2 on the same release was cancelled later; r1 was executed. Each approval gets its own outcome.
    item("7", { action: "cancelled", at: "2026-03-10T12:05:00Z", request_id: "r2" }),
    item("6", { action: "approved", at: "2026-03-10T12:01:00Z", request_id: "r2" }),
    item("5", { action: "requested", at: "2026-03-10T12:00:00Z", request_id: "r2" }),
    item("4", { action: "executed", at: "2026-03-10T10:05:00Z", request_id: "r1" }),
    item("3", { action: "approved", at: "2026-03-10T10:01:00Z", request_id: "r1" }),
    item("2", { action: "requested", at: "2026-03-10T10:00:00Z", request_id: "r1" }),
    // Another application's request with the same id is not this one.
    item("1", { action: "approved", at: "2026-03-10T09:00:00Z", request_id: "r1", app: "ios" }),
  ];
  eq(
    [...dep.supersededApprovals(items).entries()],
    [
      ["6", "cancelled"],
      ["3", "executed"],
    ]
  );
  // Only one request is cancelled: the other, executed approval must not read "cancelled".
  eq(dep.supersededApprovals(items).get("3"), "executed");
  // No request id, no pairing, even when a later outcome exists on the same release.
  eq(
    [
      ...dep
        .supersededApprovals([
          item("a", { action: "failed", at: "2026-03-10T10:05:00Z" }),
          item("b", { action: "approved", at: "2026-03-10T10:01:00Z" }),
          item("c", { action: "failed", at: "2026-03-10T10:05:00Z", request_id: null }),
          item("d", { action: "approved", at: "2026-03-10T10:01:00Z", request_id: null }),
        ])
        .entries(),
    ],
    []
  );
  // An outcome older than the approval is not its outcome.
  eq(
    [
      ...dep
        .supersededApprovals([
          item("a", { action: "executed", at: "2026-03-10T09:00:00Z", request_id: "r" }),
          item("b", { action: "approved", at: "2026-03-10T10:00:00Z", request_id: "r" }),
        ])
        .entries(),
    ],
    []
  );
  // A recovered row is labelled by what it completed.
  assert.equal(dep.actionLabel(item("r", { action: "concluded", recovered: true }).action), "Concluded");
});

test("the picker marks the current row by the deepest level the scope names, so an application in a path is found under its group", () => {
  const tree = scope.buildScopeTree(
    [{ name: "acme", applications: [{ application: "web" }, { application: "solo" }] }],
    { acme: [{ id: "g1", name: "Product", members: [{ application: "web" }] }] }
  );
  const rows = scope.pickerRows(tree, "", new Set(["acme"]));
  const current = (s) => rows.filter((r) => scope.rowIsCurrent(r, s)).map((r) => r.key);
  eq(current({ org: "acme", app: "web" }), ["app:acme:g1:web"]);
  eq(current({ org: "acme", group: "g1", app: "web" }), ["app:acme:g1:web"]);
  eq(current({ org: "acme", app: "solo" }), ["app:acme::solo"]);
  eq(current({ org: "acme", group: "g1" }), ["group:acme:g1"]);
  eq(current({ org: "acme" }), ["org:acme"]);
  eq(current({}), ["all"]);
  eq(current({ org: "acme", app: "gone" }), []);
});
