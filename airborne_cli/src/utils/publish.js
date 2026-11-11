import fs from "fs";
import path from "path";
import { readAndResolveAirborneConfig, requireToken } from "./common.js";
import { createFiles, uploadFiles } from "./file.js";
import {
  createLocalReleaseConfig,
  readReleaseConfig,
  releaseConfigExists,
  updateLocalReleaseConfig,
  writeReleaseConfig,
} from "./release.js";
import { createPackageFromLocalRelease } from "./package.js";
import { firstRelease } from "../init/first-release.js";
import { ConcludeReleaseAction, GetReleaseAction, RampReleaseAction } from "airborne-core-cli/action";
import { explainAuthFailure } from "./auth.js";
import { MAX_RAMP_PERCENTAGE, describeFailure, parseRampPercentage, runLifecycle } from "./lifecycle.js";

const lifecycleActions = { ConcludeReleaseAction, GetReleaseAction, RampReleaseAction };

// Record every file of the local release on the server (upload, or external URLs with baseUrl) and write the
// returned urls and checksums back into the release config. This is the body of create-remote-files.
export async function registerReleaseFiles(airborneConfig, releaseConfig, { upload, baseUrl }) {
  const processFiles = async (files) => {
    if (!files || files.length === 0) return;
    return upload
      ? uploadFiles(files, airborneConfig)
      : createFiles(files, airborneConfig, baseUrl);
  };
  const applyResults = (entries, results) => {
    if (!entries || !results) return;
    for (const entry of entries) {
      if (results[entry.file_path]) {
        entry.url = results[entry.file_path].url;
        entry.checksum = results[entry.file_path].checksum;
      }
    }
  };

  console.log("Processing index file");
  const indexFiles = [releaseConfig.package.index];
  applyResults(indexFiles, await processFiles(indexFiles));
  releaseConfig.package.index = indexFiles[0];

  for (const [label, key, get, set] of [
    ["important files", "important", () => releaseConfig.package.important, (v) => (releaseConfig.package.important = v)],
    ["lazy files", "lazy", () => releaseConfig.package.lazy, (v) => (releaseConfig.package.lazy = v)],
    ["resource files", "resources", () => releaseConfig.resources, (v) => (releaseConfig.resources = v)],
  ]) {
    const files = get() || [];
    if (files.length > 0) {
      console.log(`Processing ${label}`);
      applyResults(files, await processFiles(files));
      set(files);
    }
  }

  await writeReleaseConfig(
    releaseConfig,
    airborneConfig.platform,
    airborneConfig.namespace,
    airborneConfig.directory_path
  );
  return releaseConfig;
}

// Bundle (and Hermes-compile) the JS and refresh the platform's release_config.json. Safe to repeat: it creates the
// release config when there is none and rewrites it otherwise, keeping its timeouts and package version.
export async function bundleRelease(directory, platform, options = {}, deps = {}) {
  const {
    read = readAndResolveAirborneConfig,
    exists = releaseConfigExists,
    update = updateLocalReleaseConfig,
    create = createLocalReleaseConfig,
  } = deps;
  const airborneConfig = await read(directory, platform);
  const settings = { directory_path: directory, platform };
  if (options.bootTimeout) settings.boot_timeout = options.bootTimeout;
  if (options.releaseConfigTimeout) settings.release_config_timeout = options.releaseConfigTimeout;
  if (await exists(directory, platform, airborneConfig.namespace)) {
    await update(airborneConfig, settings, platform);
  } else {
    await create(
      airborneConfig,
      { boot_timeout: 4000, release_config_timeout: 4000, ...settings },
      platform
    );
  }
  return airborneConfig;
}

// The binary version the app reports as app_version: Android BuildConfig.VERSION_NAME, iOS CFBundleShortVersionString.
// Returns null when it is not a literal in the project (then pass --app-version).
export function detectAppVersion(directory, platform) {
  if (platform === "android") {
    const gradle = path.join(directory, "android", "app", "build.gradle");
    const match = fs.existsSync(gradle) && fs.readFileSync(gradle, "utf8").match(/^\s*versionName\s*=?\s*["']([^"']+)["']/m);
    return match ? match[1] : null;
  }
  if (platform === "ios") {
    const iosDir = path.join(directory, "ios");
    const projects = fs.existsSync(iosDir)
      ? fs.readdirSync(iosDir).filter((name) => name.endsWith(".xcodeproj"))
      : [];
    const versions = new Set();
    for (const project of projects) {
      const pbx = path.join(iosDir, project, "project.pbxproj");
      if (!fs.existsSync(pbx)) continue;
      for (const [, version] of fs.readFileSync(pbx, "utf8").matchAll(/MARKETING_VERSION = "?([^";\s]+)"?;/g)) {
        versions.add(version);
      }
    }
    return versions.size === 1 ? [...versions][0] : null;
  }
  return null;
}

const log = (step, message) => console.log(`\n[${step}/6] ${message}`);

// Bundle, upload, package, prepare an exact-version release, ramp it and conclude it.
// Each stage needs the one before; a failure names the stage and what is already on the server.
export async function publishRelease(options, deps = {}) {
  const {
    directory,
    platform,
    tag,
    appVersion: requestedVersion,
    ramp = MAX_RAMP_PERCENTAGE,
    conclude = false,
    prepareOnly = false,
    bootTimeout,
    releaseConfigTimeout,
  } = options;
  const {
    bundle = bundleRelease,
    register = registerReleaseFiles,
    createPackage = createPackageFromLocalRelease,
    prepareRelease = firstRelease,
    lifecycle = (kind, args) => runLifecycle(kind, args, lifecycleActions),
    token = requireToken,
    endpoint = () => process.env.AIRBORNE_BASE_URL,
    readConfig = readAndResolveAirborneConfig,
    readRelease = (config) => readReleaseConfig(directory, platform, config.namespace),
  } = deps;

  const percentage = parseRampPercentage(ramp);
  const accessToken = token(directory);
  const baseUrl = endpoint();
  if (!baseUrl) {
    throw new Error(
      "No server is configured for this project. Run: airborne-devkit configure --base-url <server URL> (for example http://localhost:8080)"
    );
  }
  const appVersion = requestedVersion || detectAppVersion(directory, platform);
  if (!appVersion) {
    throw new Error(
      `Cannot read the ${platform} app version from the project. Pass --app-version with the versionName / MARKETING_VERSION of the installed binary.`
    );
  }
  const identity = await readConfig(directory, platform);
  const scope = { organisation: identity.organisation, application: identity.namespace, token: accessToken };
  const stage = async (name, run) => {
    try {
      return await run();
    } catch (err) {
      const detail = name === "preparing the release" && /approval_required/.test(String(err.code) + err.message)
        ? `The uploaded package ${releaseConfig.package.version} requires approval; raise the release from the dashboard. No release was created.`
        : explainAuthFailure(err);
      err.message = `Publish stopped while ${name}: ${detail}`;
      throw err;
    }
  };

  log(1, `Bundling ${platform} JavaScript`);
  await stage("bundling", () => bundle(directory, platform, { bootTimeout, releaseConfigTimeout }));
  const airborneConfig = {
    ...(await readConfig(directory, platform)),
    directory_path: directory,
    platform,
    tag,
    token: accessToken,
  };
  const releaseConfig = await readRelease(airborneConfig);

  log(2, "Uploading files");
  await stage("uploading files", () => register(airborneConfig, releaseConfig, { upload: true }));

  log(3, "Creating the package");
  await stage("creating the package", () => createPackage(airborneConfig, releaseConfig));
  const packageVersion = releaseConfig.package.version;

  log(4, `Preparing a release of package ${packageVersion} for app version ${appVersion} (no traffic yet)`);
  const release = await stage("preparing the release", () =>
    prepareRelease({
      endpoint: baseUrl,
      organisation: scope.organisation,
      application: scope.application,
      packageVersion,
      appVersion,
      token: accessToken,
    })
  );
  const result = { platform, organisation: scope.organisation, application: scope.application, packageVersion, appVersion, releaseId: release.id, state: "created" };
  if (prepareOnly) return result;
  const afterwards = `The release ${release.id} exists; finish it with ramp-release / conclude-release, or discard-release.`;

  log(5, `Ramping to ${percentage}%`);
  try {
    await lifecycle("ramp", { ...scope, releaseId: release.id, percentage });
    result.state = "ramped";
    result.ramp = percentage;
  } catch (err) {
    err.message = `Publish stopped while ramping: ${describeFailure(err)}. ${afterwards}`;
    throw err;
  }
  if (!conclude) {
    result.concludeCommand = `airborne-devkit conclude-release ${release.id} -p ${platform} --variant release`;
    console.log(`After reviewing the ramp, run:\n${result.concludeCommand}`);
    return result;
  }

  log(6, "Concluding: everyone on this app version gets the new package");
  try {
    await lifecycle("conclude", { ...scope, releaseId: release.id, variant: "release" });
    result.state = "concluded";
  } catch (err) {
    err.message = `Publish stopped while concluding: ${describeFailure(err)}. ${afterwards}`;
    throw err;
  }
  return result;
}
