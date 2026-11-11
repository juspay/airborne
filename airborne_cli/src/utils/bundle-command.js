import path from "path";

export const DEFAULT_WEB_BUILD_COMMAND = "npm run build:web";

/**
 * Resolves where a platform's OTA bundle is built and which file is its index.
 * `index_file_path` falls back to `index.<platform>.bundle` when the config
 * does not set one (web configs are not prompted for it).
 */
export function resolveBundleLayout(airborneConfig, platform) {
  return {
    entry_file: airborneConfig.js_entry_file || "index.js",
    index_file_path:
      airborneConfig[platform]?.index_file_path || `index.${platform}.bundle`,
    build_folder: path.join(platform, "build", "generated", "airborne"),
  };
}

/**
 * Process descriptor that writes the bundle to `<build_folder>/<index_file_path>`.
 * Web has no react-native bundle step: the app's own build command
 * (`web.build_command`, default `npm run build:web`) must emit a single script
 * at `$AIRBORNE_OUTPUT_DIR/$AIRBORNE_INDEX_FILE`.
 */
export function buildBundleCommand(airborneConfig, platform, directoryPath, layout) {
  const { entry_file, index_file_path, build_folder } = layout;
  if (platform === "web") {
    const buildCommand =
      airborneConfig.web?.build_command || DEFAULT_WEB_BUILD_COMMAND;
    // Environment is set before the shell expands the build command's arguments.
    return { file: "/bin/sh", args: ["-c", buildCommand], cwd: directoryPath,
      env: { AIRBORNE_OUTPUT_DIR: build_folder, AIRBORNE_INDEX_FILE: index_file_path } };
  }
  const args = airborneConfig.expo ? ["expo", "export:embed"] : ["react-native", "bundle"];
  return { file: "npx", args: args.concat(["--platform", platform, "--dev", "false",
    "--entry-file", entry_file, "--bundle-output", `${build_folder}/${index_file_path}`,
    "--assets-dest", build_folder]), cwd: directoryPath };
}

/** Hermes bytecode only applies to native bundles. */
export function shouldCompileHermes(airborneConfig, platform) {
  return Boolean(airborneConfig.hermes_enabled) && platform !== "web";
}
