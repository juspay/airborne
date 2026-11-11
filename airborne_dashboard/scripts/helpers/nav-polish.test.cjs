// Navigation polish: cut-short reads never read as empty, feed rows in words, the operator's footer.
const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
const scope = load("lib/control-center/scope");

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

test("an organisation whose read was cut short and listed nothing is unconfirmed, never empty", () => {
  const cut = { name: "a", groups: [], ungrouped: [], authorization_error: true };
  assert.equal(scope.unconfirmedOrg(cut), true);
  assert.equal(scope.scopeOutcome(scope.filterOverview(ov([cut]), { org: "a" }), { org: "a" }), "unconfirmed");
  // groups cut short with an empty list is the same: the missing applications could be in the missing groups
  const groupsCut = { name: "a", groups: [], ungrouped: [], groups_error: true };
  assert.equal(scope.scopeOutcome(ov([groupsCut]), { org: "a" }), "unconfirmed");
  // a clean empty organisation is real; a cut-short one with something listed shows what it has
  const clean = { name: "a", groups: [], ungrouped: [] };
  assert.equal(scope.unconfirmedOrg(clean), false);
  assert.equal(scope.scopeOutcome(ov([clean]), { org: "a" }), "found");
  const some = { name: "a", groups: [], ungrouped: [app("web")], authorization_error: true };
  assert.equal(scope.unconfirmedOrg(some), false);
  assert.equal(scope.scopeOutcome(ov([some]), { org: "a" }), "found");
  // an empty group in a cut-short organisation lists no application either
  const emptyGroup = {
    name: "a",
    groups: [{ id: "g", name: "G", members: [] }],
    ungrouped: [],
    authorization_error: true,
  };
  assert.equal(scope.unconfirmedOrg(emptyGroup), true);
});

const dep = load("lib/control-center/deployments");
const item = (over = {}) => ({
  event_id: "e",
  at: "2026-01-01T00:00:00Z",
  org: "o",
  group: null,
  app: "kharcha-ios",
  platform: "ios",
  release_id: "7522599980729000113",
  package_version: "3",
  action: "rolled_back",
  recovered: false,
  actor: "a@x",
  from_target: null,
  to_target: null,
  summary: "Event on release 7522599980729000113",
  ...over,
});

test("a feed row says what happened in words, from the app, the version and the action", () => {
  const say = (over) => dep.readableSummary(item(over));
  assert.equal(say({}), "kharcha-ios v3 rolled back");
  assert.equal(say({ action: "ramped", to_target: 50 }), "kharcha-ios v3 ramped to 50%");
  assert.equal(say({ action: "ramped" }), "kharcha-ios v3 ramped");
  assert.equal(say({ action: "concluded" }), "kharcha-ios v3 made live");
  assert.equal(say({ action: "created" }), "kharcha-ios v3 created");
  assert.equal(say({ action: "discarded" }), "kharcha-ios v3 discarded");
  assert.equal(say({ action: "emergency_rollback" }), "kharcha-ios v3 rolled back in an emergency");
  // The server's wording does not matter for these: the row is the same.
  assert.equal(say({ summary: "Rolled the release back" }), "kharcha-ios v3 rolled back");
});

test("a short release id stands in only where there is no version, and nothing where there is no release", () => {
  assert.equal(dep.readableSummary(item({ package_version: null })), "kharcha-ios release …000113 rolled back");
  assert.equal(dep.readableSummary(item({ package_version: null, release_id: null })), "kharcha-ios rolled back");
  for (const over of [{}, { package_version: null }, { action: "ramped", to_target: 25 }]) {
    const t = dep.readableSummary(item(over));
    assert.ok(!/Event on release/i.test(t), t);
    assert.ok(!/\d{10,}/.test(t), "no long release id: " + t);
  }
});

test("rows whose server sentence says more are kept; a generic sentence is never shown", () => {
  // an operator's recovery note, a request step, a policy change keep the server's words
  assert.equal(
    dep.readableSummary(item({ action: "created", recovered: true, summary: "Confirmed applied after a timeout" })),
    "Confirmed applied after a timeout"
  );
  assert.equal(
    dep.readableSummary(item({ action: "requested", summary: "Requested a ramp to 50%" })),
    "Requested a ramp to 50%"
  );
  assert.equal(
    dep.readableSummary(
      item({ action: "policy_changed", release_id: null, package_version: null, summary: "Approval policy changed" })
    ),
    "Approval policy changed"
  );
  // ... and the long id in a kept sentence is still swapped for the version
  assert.equal(
    dep.readableSummary(item({ action: "failed", summary: "ramp request failed on release 7522599980729000113" })),
    "ramp request failed on v3"
  );
  // a generic sentence on an action with no fixed wording becomes the action's name after the application
  assert.equal(dep.readableSummary(item({ action: "expired" })), "kharcha-ios v3 request expired");
  assert.equal(dep.readableSummary(item({ action: "future_checked" })), "kharcha-ios v3 future checked");
  // a summary that is only the action's own name is no sentence either
  assert.equal(
    dep.readableSummary(item({ action: "requested", summary: "requested" })),
    "kharcha-ios v3 approval requested"
  );
});

test("the default foot of the feed is plain words; the server's technical notes are kept apart", () => {
  const note = dep.completenessNote({
    complete: false,
    best_effort_actions: ["cache_failed"],
    notes: [
      "Created events are committed with the write's durable journal entry.",
      "cache_failed is recorded in a separate statement.",
    ],
  });
  assert.match(note.text, /not proof that it did not happen/);
  for (const jargon of [/journal/i, /cache_failed/, /statement/i, /transactional/i, /best_effort/]) {
    assert.ok(!jargon.test(note.text), `${jargon} in the default text`);
  }
  assert.equal(note.notes.length, 2, "the server's own words are still there, for Details");
  assert.ok(!/every event/i.test(note.text));
});
