import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOptions } from "../src/utils/common.js";

test("--release-timeout maps to release_config_timeout", () => {
  assert.deepEqual(normalizeOptions({ releaseTimeout: 60000, bootTimeout: 30000 }), {
    release_config_timeout: 60000,
    boot_timeout: 30000,
  });
});

test("canonical timeout and matching alias normalize identically", () => {
  assert.deepEqual(normalizeOptions({ releaseConfigTimeout: 60000 }), {
    release_config_timeout: 60000,
  });
  assert.deepEqual(normalizeOptions({ releaseConfigTimeout: 60000, releaseTimeout: 60000 }), {
    release_config_timeout: 60000,
  });
});

test("conflicting timeout aliases are rejected in either order", () => {
  assert.throws(() => normalizeOptions({ releaseTimeout: 1, releaseConfigTimeout: 2 }), /Conflicting timeout/);
  assert.throws(() => normalizeOptions({ releaseConfigTimeout: 2, releaseTimeout: 1 }), /Conflicting timeout/);
});

test("both commands expose canonical and deprecated flags", async () => {
  const { spawnSync } = await import("node:child_process");
  const cli = new URL("../src/index.js", import.meta.url);
  for (const command of ["create-local-release-config", "update-local-release-config"]) {
    const help = spawnSync(process.execPath, [cli.pathname, command, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--release-config-timeout/);
    assert.match(help.stdout, /Deprecated alias/);
    const legacy = spawnSync(process.execPath, [cli.pathname, command, "/nonexistent-airborne-test", "-p", "android", "--release-timeout", "60000"], { encoding: "utf8" });
    assert.match(legacy.stderr, /--release-timeout is deprecated/);
    assert.doesNotMatch(legacy.stderr, /unknown option/);
  }
});
