const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");

test("partial policy failure stops remaining writes", async () => {
  const calls = [];
  const result = await load("lib/control-center/policy-batch").applyPolicyBatch(
    ["first", "second", "third"],
    async (app) => {
      calls.push(app);
      if (app === "second") throw new Error("response lost");
    }
  );
  assert.deepEqual(calls, ["first", "second"]);
  assert.equal(result[0].ok, true);
  assert.match(result[1].message, /unconfirmed/);
  assert.match(result[2].message, /Not attempted/);
});

test("telemetry totals never sum native cohorts; no-baseline wording", () => {
  const t = load("lib/control-center/telemetry");
  const row = {
    release_id: "r",
    boot_success: 1,
    boot_started: 1,
    signal: { status: "observed_only", baseline_release_id: null },
  };
  const summary = { releases: [row, row], release_totals: [{ ...row, reporting_devices: 1, unverified_reports: 4 }] };
  assert.equal(t.adoptionFor(summary, "r").booted, 1);
  assert.equal(t.adoptionFor({ releases: [row, row] }, "r"), undefined);
  assert.equal(t.signalLabel("observed_only"), "Reports without comparison");
  assert.match(t.signalExplanation(row), /no baseline/);
});

test("a policy refusal is confirmed and not labelled as server-authored prose", async () => {
  const error = Object.assign(new Error("forbidden"), { status: 403 });
  const rows = await load("lib/control-center/policy-batch").applyPolicyBatch(["a"], async () => {
    throw error;
  });
  assert.match(rows[0].message, /refused; nothing changed/);
});
