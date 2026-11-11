import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  buildBundleCommand,
  resolveBundleLayout,
  shouldCompileHermes,
} from "../src/utils/bundle-command.js";

test("native platforms use react-native bundle with the configured index", () => {
  const config = { android: { index_file_path: "index.android.bundle" } };
  const layout = resolveBundleLayout(config, "android");
  assert.deepEqual(buildBundleCommand(config, "android", "/app", layout), {
    file: "npx", args: ["react-native", "bundle", "--platform", "android", "--dev", "false",
      "--entry-file", "index.js", "--bundle-output", "android/build/generated/airborne/index.android.bundle",
      "--assets-dest", "android/build/generated/airborne"], cwd: "/app"
  });
});

test("expo projects use expo export:embed", () => {
  const config = { expo: true, ios: {} };
  const command = buildBundleCommand(config, "ios", "/app", resolveBundleLayout(config, "ios"));
  assert.equal(command.file, "npx");
  assert.deepEqual(command.args.slice(0, 4), ["expo", "export:embed", "--platform", "ios"]);
  assert.equal(command.args[command.args.indexOf("--bundle-output") + 1], "ios/build/generated/airborne/index.ios.bundle");
});

test("web runs the app's build command with the output contract", () => {
  const config = { web: { build_command: "pnpm build:ota" } };
  const layout = resolveBundleLayout(config, "web");
  assert.equal(layout.index_file_path, "index.web.bundle");
  assert.deepEqual(buildBundleCommand(config, "web", "/app", layout), {
    file: "/bin/sh", args: ["-c", "pnpm build:ota"], cwd: "/app",
    env: { AIRBORNE_OUTPUT_DIR: "web/build/generated/airborne", AIRBORNE_INDEX_FILE: "index.web.bundle" }
  });
});

test("web defaults to npm run build:web and never compiles Hermes", () => {
  const config = { hermes_enabled: true, web: {} };
  const command = buildBundleCommand(config, "web", "/app", resolveBundleLayout(config, "web"));
  assert.equal(command.args[1], "npm run build:web");
  assert.equal(shouldCompileHermes(config, "web"), false);
  assert.equal(shouldCompileHermes(config, "android"), true);
});

test("the web build command's arguments can expand the output variables", () => {
  const config = { web: { build_command: 'printf "%s" "$AIRBORNE_OUTPUT_DIR/$AIRBORNE_INDEX_FILE"' } };
  const command = buildBundleCommand(config, "web", ".", resolveBundleLayout(config, "web"));
  assert.equal(
    execFileSync(command.file, command.args, { cwd: command.cwd, env: command.env }).toString(),
    "web/build/generated/airborne/index.web.bundle"
  );
});
