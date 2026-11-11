const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, test } = require("./harness.cjs");

const approval = () => load("lib/control-center/approval");
const err = (status, message, body = {}) => Object.assign(new Error(message), { status, body: { message, ...body } });

test("every decide phrase appears in the server source under the status the UI expects", () => {
  const file = path.join(__dirname, "..", "..", "..", "airborne_server", "src", "release", "maker_checker.rs");
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8").toLowerCase();
  const kinds = { 400: "badrequest", 403: "forbidden", 404: "notfound", 409: "conflict" };
  for (const [kind, statuses, phrases] of approval().DECIDE_PHRASES) {
    for (const phrase of phrases) {
      const found = statuses.some((s) =>
        new RegExp(`(?:aberror::${kinds[s]}\\("[^"]*|coded\\(${s},\\s*"[^"]*",\\s*"[^"]*)${phrase}`).test(source)
      );
      assert.ok(
        found,
        `${kind}: "${phrase}" is not an ${statuses.map((s) => kinds[s]).join("/")} message on the server`
      );
    }
  }
});

test("a decide error the UI cannot place is unconfirmed, never 'approved but failed'", () => {
  const a = approval();
  for (const e of [
    err(503, "upstream unavailable"),
    err(502, "bad gateway"),
    err(500, "Invalid expiry"),
    err(undefined, "Failed to fetch"),
  ]) {
    const f = a.classifyApprovalError(e, "decide");
    assert.equal(f.kind, "unconfirmed", e.message);
    assert.doesNotMatch(a.describeApprovalFailure(f), /approval was recorded|marked failed/);
  }
  assert.equal(a.classifyApprovalError(err(404, "Request not found in this application"), "decide").kind, "not_found");
  assert.equal(a.classifyApprovalError(err(404, "Unknown decision"), "decide").kind, "not_found");
});

test("server phrases only count under their own status", () => {
  const a = approval();
  assert.equal(a.classifyApprovalError(err(409, "Request stale; raise a new request"), "decide").kind, "stale");
  assert.equal(a.classifyApprovalError(err(409, "Request expired during validation"), "decide").kind, "expired");
  // An upstream 502 whose text mentions "stale" or "expired" is not a refusal from the request checks.
  assert.equal(a.classifyApprovalError(err(502, "upstream session expired"), "decide").kind, "unconfirmed");
  assert.equal(a.classifyApprovalError(err(500, "stale lock"), "decide").kind, "unconfirmed");
  assert.equal(
    a.classifyApprovalError(err(403, "Nobody may approve their own request"), "decide").kind,
    "self_approval"
  );
  assert.equal(a.classifyApprovalError(err(403, "Release permission required"), "decide").kind, "forbidden");
});

test("'approved, but the action failed' needs the re-read request to be failed", () => {
  const a = approval();
  const unconfirmed = a.classifyApprovalError(err(503, "x"), "decide");
  const pending = { status: "pending", updated_at: "t1" };
  assert.equal(a.reconcileDecision(unconfirmed, pending, pending).kind, "unconfirmed");
  assert.equal(
    a.reconcileDecision(unconfirmed, pending, { status: "failed", updated_at: "t2" }).kind,
    "execution_failed"
  );
  assert.equal(
    a.reconcileDecision(unconfirmed, pending, { status: "executed", updated_at: "t2" }).kind,
    "already_executed"
  );
  // A retry of a request that was already failed, and still reads failed with the same timestamp, proves nothing.
  const failed = { status: "failed", updated_at: "t1" };
  assert.equal(a.reconcileDecision(unconfirmed, failed, failed).kind, "unconfirmed");
  // A recognised refusal is never rewritten.
  const stale = a.classifyApprovalError(err(409, "Request stale; raise a new request"), "decide");
  assert.equal(a.reconcileDecision(stale, pending, { status: "failed", updated_at: "t2" }).kind, "stale");
});

test("acknowledge errors are not read as an approval that failed", () => {
  const a = approval();
  const kind = (status, message) => a.classifyAcknowledgeError(err(status, message)).kind;
  assert.equal(kind(404, "Unacknowledged emergency not found"), "gone");
  assert.equal(kind(403, "A different checker must acknowledge"), "same_actor");
  assert.equal(kind(403, "Current checker required"), "not_checker");
  assert.equal(kind(400, "Acknowledgement reason required"), "reason_required");
  assert.equal(kind(503, "upstream unavailable"), "unconfirmed");
  assert.equal(kind(undefined, "Failed to fetch"), "unconfirmed");
  for (const f of ["gone", "unconfirmed", "refused"]) {
    const text = JSON.stringify(a.describeAcknowledgeFailure({ kind: f, message: "m", status: 500 }));
    assert.doesNotMatch(text, /approval was recorded|marked failed|Approved/);
  }
});

test("an emergency review only claims a restore when the server recorded one", () => {
  const a = approval();
  const planned = a.emergencyRestoredVersion({ plan: { resulting_package_version: 7 } });
  assert.deepEqual({ ...planned }, { version: 7, confirmed: false, finished: false });
  const done = a.emergencyRestoredVersion({
    rollback_finished: true,
    rolled_back_to_package_version: 7,
    plan: { resulting_package_version: 6 },
  });
  assert.deepEqual({ ...done }, { version: 7, confirmed: true, finished: true });
  // A row from an older server has a package number but no `rollback_finished`: the outcome is unknown, the plan wins.
  const legacy = a.emergencyRestoredVersion({
    rolled_back_to_package_version: 7,
    plan: { resulting_package_version: 6 },
  });
  assert.deepEqual({ ...legacy }, { version: 6, confirmed: false, finished: false });
  // Finished, but the result names no package: say it finished, never invent a version.
  const bare = a.emergencyRestoredVersion({ rollback_finished: true, plan: { resulting_package_version: 6 } });
  assert.deepEqual({ ...bare }, { version: null, confirmed: false, finished: true });
  assert.equal(a.emergencyRestoredVersion({}).version, null);
});

// The decide, acknowledge and create-request refusals carry a machine-readable `code`. It decides the kind whatever the
// status or wording; the phrases are only for servers that send none.
test("a coded decide refusal is read from its code, not from its wording or status", () => {
  const a = approval();
  const kind = (status, code, message = "unrelated words") =>
    a.classifyApprovalError(err(status, message, { code }), "decide").kind;
  assert.equal(kind(403, "self_approval"), "self_approval");
  assert.equal(kind(409, "not_pending"), "not_pending");
  assert.equal(kind(403, "not_requester"), "not_requester");
  assert.equal(kind(403, "not_checker"), "not_checker");
  assert.equal(kind(403, "not_maker"), "not_maker");
  assert.equal(kind(409, "request_expired"), "expired");
  assert.equal(kind(409, "hash_mismatch"), "tampered");
  assert.equal(kind(409, "request_stale"), "stale");
  // Creating a request as a non-maker gets the same code on the raise path.
  assert.equal(a.classifyApprovalError(err(403, "x", { code: "not_maker" }), "raise").kind, "not_maker");
  // A code the table does not know, and a prototype name, are not refusals.
  assert.equal(kind(503, "constructor"), "unconfirmed");
  assert.equal(kind(500, "AB_500"), "unconfirmed");
});

test("execution_failed means the request is failed, without a re-read, whatever status the action failed with", () => {
  const a = approval();
  for (const status of [400, 403, 409, 500, 502]) {
    const f = a.classifyApprovalError(
      err(status, "Request stale; raise a new request", {
        code: "execution_failed",
        request_id: "r1",
        request_status: "failed",
      }),
      "decide"
    );
    assert.equal(f.kind, "execution_failed", String(status));
    assert.equal(f.requestId, "r1");
    // Re-reading a request that is still pending (a lagging read) cannot talk the UI out of what the server said.
    const same = { status: "pending", updated_at: "t1" };
    assert.equal(a.reconcileDecision(f, same, same).kind, "execution_failed");
  }
  // The code without the saved status is not proof: say the outcome is unconfirmed and re-read.
  assert.equal(a.classifyApprovalError(err(502, "boom", { code: "execution_failed" }), "decide").kind, "unconfirmed");
  assert.match(
    a.describeApprovalFailure({ kind: "execution_failed", message: "m" }, { action: "ramp" }),
    /request is now marked failed/
  );
});

test("acknowledge refusals are read from their code", () => {
  const a = approval();
  const kind = (status, code) => a.classifyAcknowledgeError(err(status, "unrelated words", { code })).kind;
  assert.equal(kind(404, "emergency_not_found"), "gone");
  assert.equal(kind(403, "same_checker"), "same_actor");
  assert.equal(kind(403, "not_checker"), "not_checker");
  assert.equal(kind(500, "emergency_not_found"), "gone");
});

test("every code the UI reads is sent by the server source", () => {
  // Set AIRBORNE_SERVER_SRC to a server tree that has the codes; the default tree may predate them.
  const root = process.env.AIRBORNE_SERVER_SRC ?? path.join(__dirname, "..", "..", "..", "airborne_server");
  const file = path.join(root, "src", "release", "maker_checker.rs");
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("fn coded(")) return;
  for (const code of [...Object.keys(approval().DECIDE_CODES), "emergency_not_found", "same_checker"]) {
    assert.match(source, new RegExp(`coded\\(\\d+,\\s*"${code}"`), code);
  }
  assert.match(source, /"code":"execution_failed"/);
  assert.match(source, /"request_status":"failed"/);
  assert.match(source, /rollback_finished/);
  assert.match(source, /rolled_back_to_package_version/);
});

test("a policy write is unconfirmed on a lost response or a 5xx, refused on a 4xx", () => {
  const a = approval();
  assert.equal(a.isUnconfirmedWrite(err(undefined, "Failed to fetch")), true);
  assert.equal(a.isUnconfirmedWrite(err(504, "timeout")), true);
  assert.equal(a.isUnconfirmedWrite(err(400, "Each maker needs a different checker")), false);
  assert.equal(a.isUnconfirmedWrite(err(403, "Forbidden")), false);
});

test("a non-maker keeps the target button unless every target needs a request", () => {
  const a = approval();
  assert.equal(a.everyRampTargetNeedsRequest(true, "INPROGRESS", false), false);
  assert.equal(a.everyRampTargetNeedsRequest(true, "CREATED", false), true);
  assert.equal(a.everyRampTargetNeedsRequest(true, "INPROGRESS", true), true);
  assert.equal(a.everyRampTargetNeedsRequest(false, "CREATED", true), false);
  // The server's rule that makes lowering direct: a lower target on a non-sensitive release needs no approval.
  assert.equal(a.needsApproval("ramp", "INPROGRESS", 25, 0, false), false);
});

test("the server's refusal of a second emergency rollback is recognised", () => {
  const a = approval();
  assert.equal(
    a.isEmergencyReviewPending(err(409, "A previous emergency still needs a different checker's acknowledgement")),
    true
  );
  assert.equal(a.isEmergencyReviewPending(err(409, "Request stale; raise a new request")), false);
  assert.equal(
    a.isEmergencyReviewPending(err(500, "A previous emergency still needs a different checker's acknowledgement")),
    false
  );
  const file = path.join(__dirname, "..", "..", "..", "airborne_server", "src", "release", "maker_checker.rs");
  if (fs.existsSync(file)) assert.match(fs.readFileSync(file, "utf8"), /A previous emergency still needs/);
});

test("acknowledge is enabled by checker membership alone", () => {
  const a = approval();
  assert.equal(a.canAcknowledgeEmergency({ checkers: ["carol"] }, "carol"), true);
  assert.equal(a.canAcknowledgeEmergency({ checkers: ["carol"] }, "dave"), false);
  // Approval switched off afterwards: the policy still lists the checkers and the server still accepts them.
  assert.equal(a.canAcknowledgeEmergency({ enabled: false, checkers: ["carol"] }, "carol"), true);
  // No policy yet: wait. Policy unreadable: leave it to the server.
  assert.equal(a.canAcknowledgeEmergency(undefined, "carol"), false);
  assert.equal(a.canAcknowledgeEmergency(undefined, "carol", true), true);
  assert.equal(a.canAcknowledgeEmergency({ checkers: ["carol"] }, null), false);
});

test("the permission a decider needs matches the server's permission_action", () => {
  const a = approval();
  const expected = {
    create: "create",
    update: "update",
    set_rollback_sensitive: "update",
    set_strict_serving: "update",
    ramp: "ramp",
    discard: "discard",
    conclude: "conclude",
    rollback: "conclude",
  };
  for (const [action, permission] of Object.entries(expected))
    assert.equal(a.permissionForAction(action), permission, action);
  const file = path.join(__dirname, "..", "..", "..", "airborne_server", "src", "release", "maker_checker.rs");
  if (fs.existsSync(file)) {
    const source = fs.readFileSync(file, "utf8");
    const body = source.slice(source.indexOf("fn permission_action"), source.indexOf("fn valid_roster"));
    for (const [action, permission] of Object.entries(expected)) {
      if (action === "conclude" || action === "rollback") continue;
      assert.match(body, new RegExp(`"${action}"[^=]*=> "${permission}"`), `server maps ${action} to ${permission}`);
    }
  }
});

test("a write refused with approval_required is a frozen write, not a request that can be raised", () => {
  const a = approval();
  const frozen = a.frozenWriteNotice(err(403, "Approval required for kharcha", { code: "approval_required" }));
  assert.match(frozen.description, /turn approval off/);
  assert.doesNotMatch(frozen.description, /raise a request instead/i);
  assert.equal(a.frozenWriteNotice(err(403, "Forbidden")), null);
  assert.equal(a.frozenWriteNotice(err(500, "boom")), null);
});
