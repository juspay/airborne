import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { test } from "node:test";
import {
  buildBundleCommand,
  resolveBundleLayout,
  shouldCompileHermes,
} from "../src/utils/bundle-command.js";

test("native platforms use react-native bundle with the configured index", () => {
  const config = { android: { index_file_path: "index.android.bundle" } };
  const layout = resolveBundleLayout(config, "android");
  assert.equal(
    buildBundleCommand(config, "android", "/app", layout),
    "cd '/app' && npx react-native bundle --platform android --dev false --entry-file 'index.js' --bundle-output 'android/build/generated/airborne/index.android.bundle' --assets-dest 'android/build/generated/airborne'"
  );
});

test("expo projects use expo export:embed", () => {
  const config = { expo: true, ios: {} };
  const command = buildBundleCommand(config, "ios", "/app", resolveBundleLayout(config, "ios"));
  assert.match(command, /npx expo export:embed --platform ios/);
  assert.match(command, /--bundle-output 'ios\/build\/generated\/airborne\/index\.ios\.bundle'/);
});

test("web runs the app's build command with the output contract", () => {
  const config = { web: { build_command: "pnpm build:ota" } };
  const layout = resolveBundleLayout(config, "web");
  assert.equal(layout.index_file_path, "index.web.bundle");
  assert.equal(
    buildBundleCommand(config, "web", "/app", layout),
    "cd '/app' && export AIRBORNE_OUTPUT_DIR='web/build/generated/airborne' AIRBORNE_INDEX_FILE='index.web.bundle' && pnpm build:ota"
  );
});

test("web defaults to npm run build:web and never compiles Hermes", () => {
  const config = { hermes_enabled: true, web: {} };
  const command = buildBundleCommand(config, "web", "/app", resolveBundleLayout(config, "web"));
  assert.match(command, / npm run build:web$/);
  assert.equal(shouldCompileHermes(config, "web"), false);
  assert.equal(shouldCompileHermes(config, "android"), true);
});

test("the web build command's arguments can expand the output variables", () => {
  const config = { web: { build_command: 'printf "%s" "$AIRBORNE_OUTPUT_DIR/$AIRBORNE_INDEX_FILE"' } };
  const command = buildBundleCommand(config, "web", ".", resolveBundleLayout(config, "web"));
  assert.equal(
    execSync(command, { shell: "/bin/sh", env: {} }).toString(),
    "web/build/generated/airborne/index.web.bundle"
  );
});
