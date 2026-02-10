import {
  executeReactNativeBundleCommand,
  readDirectoryRecursive,
} from "./file.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import path from "path";
import { promptWithType } from "./prompt.js";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function readReleaseConfig(directory_path, platform, namespace) {
  let configPath;

  if (platform === "android") {
    configPath = path.join(
      directory_path,
      platform,
      "app",
      "src",
      "main",
      "assets",
      namespace,
      "release_config.json"
    );
  } else {
    configPath = path.join(directory_path, platform, "release_config.json");
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(`❌ Release config not found at ${configPath}`);
  }

  try {
    const configContent = fs.readFileSync(configPath, "utf8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error("❌ Failed to read release config:", error.message);
    throw error;
  }
}

export async function fillReleaseConfigOptions(options = {}) {
  const questions = [
    {
      key: "boot_timeout",
      question:
        "\nPlease enter the boot timeout in milliseconds (default: 4000): ",
      expectedType: "number",
      defaultValue: 4000,
    },
    {
      key: "release_config_timeout",
      question:
        "\nPlease enter the release config timeout in milliseconds (default: 4000): ",
      expectedType: "number",
      defaultValue: 4000,
    },
  ];

  const result = { ...options };

  const getNested = (obj, path) =>
    path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);

  const setNested = (obj, path, value) => {
    const parts = path.split(".");
    let temp = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!temp[parts[i]]) temp[parts[i]] = {};
      temp = temp[parts[i]];
    }
    temp[parts[parts.length - 1]] = value;
  };

  for (const { key, question, expectedType, defaultValue } of questions) {
    let value;

    if (getNested(options, key) !== undefined) {
      value = getNested(options, key);
    } else if (question) {
      value = await promptWithType(question, expectedType, defaultValue);
    }

    if (value !== undefined) {
      setNested(result, key, value);
    }
  }

  return result;
}

export async function createLocalReleaseConfig(
  airborneConfig,
  options,
  platform
) {
  try {
    const entry_file = airborneConfig.js_entry_file || "index.js";
    const index_file_path =
      airborneConfig[platform].index_file_path || `index.${platform}.bundle`;
    const build_folder = path.join(platform, "build", "generated", "airborne");

    const fullBuildFolderPath = path.join(options.directory_path, build_folder);
    if (!fs.existsSync(fullBuildFolderPath)) {
      fs.mkdirSync(fullBuildFolderPath, { recursive: true });
    }

    const isExpo = airborneConfig.expo || false;
    let command;
    if (isExpo) {
      command = `cd '${options.directory_path}' && npx expo export:embed --platform ${platform} --dev false --entry-file '${entry_file}' --bundle-output '${build_folder}/${index_file_path}' --assets-dest '${build_folder}'`;
    } else {
      command = `cd '${options.directory_path}' && npx react-native bundle --platform ${platform} --dev false --entry-file '${entry_file}' --bundle-output '${build_folder}/${index_file_path}' --assets-dest '${build_folder}'`;
    }

    const bundleResult = await executeReactNativeBundleCommand(command);

    if (!bundleResult.success) {
      throw new Error(
        `React Native bundle command failed: ${bundleResult.error}`
      );
    }

    const baseDir = path.isAbsolute(options.directory_path)
      ? options.directory_path
      : path.join(process.cwd(), options.directory_path);

    const remotebundlePath = path.join(baseDir, build_folder);
    const remotebundleContents = readDirectoryRecursive(remotebundlePath);
    const filledOptions = await fillReleaseConfigOptions(options);
    const releaseConfig = {
      version: "",
      config: {
        version: "",
        boot_timeout: filledOptions.boot_timeout,
        release_config_timeout: filledOptions.release_config_timeout,
        properties: {},
      },
      package: {
        name: airborneConfig.namespace,
        version: "",
        prooerties: {},
        index: {
          file_path: airborneConfig[platform].index_file_path,
          url: "",
          checksum: "",
        },
        important: remotebundleContents
          .filter(
            (item) => item.path !== airborneConfig[platform].index_file_path
          )
          .map((item) => {
            return {
              file_path: item.path,
              url: "",
            };
          }),
        lazy: [],
      },
      resources: [],
    };

    await writeReleaseConfig(
      releaseConfig,
      platform,
      airborneConfig.namespace,
      filledOptions.directory_path
    );
  } catch (err) {
    console.error("❌ Failed to create local release config:", err.message);
  }
}

export async function writeReleaseConfig(
  releaseConfig,
  platform,
  namespace,
  directory_path
) {
  try {
    let configDir;
    if (platform === "android") {
      configDir = path.join(
        directory_path,
        platform,
        "app",
        "src",
        "main",
        "assets",
        namespace
      );
    } else {
      configDir = path.join(directory_path, platform);
    }
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, {
        recursive: true,
      });
    }
    const configPath = path.join(configDir, "release_config.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify(releaseConfig, null, 2),
      "utf8"
    );
    console.log(`✅ Release config written to ${configPath}`);

    if (platform === "ios") {
      console.log("Running ruby script for ios");
      const rubyScriptPath = path.join(__dirname, "../", "bundleRC.rb");
      const rubyCommand = `ruby "${rubyScriptPath}"`;

      try {
        execSync(rubyCommand, { stdio: "inherit", cwd: directory_path });
        console.log("✅ Ruby script executed successfully");
      } catch (error) {
        console.error("❌ Ruby script execution failed:", error.message);
      }
    }
  } catch (err) {
    console.error("❌ Failed to write release config:", err.message);
  }
}

export async function updateLocalReleaseConfig(
  airborneConfig,
  options,
  platform
) {
  try {
    const entry_file = airborneConfig.js_entry_file || "index.js";
    const index_file_path =
      airborneConfig[platform].index_file_path || `index.${platform}.bundle`;
    const build_folder = path.join(platform, "build", "generated", "airborne");

    const fullBuildFolderPath = path.join(options.directory_path, build_folder);
    if (!fs.existsSync(fullBuildFolderPath)) {
      fs.mkdirSync(fullBuildFolderPath, { recursive: true });
    }

    // empty the folder
    fs.readdirSync(fullBuildFolderPath).forEach((file) => {
      const curPath = path.join(fullBuildFolderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmSync(curPath, { recursive: true, force: true }); // remove folder recursively
      } else {
        fs.unlinkSync(curPath); // remove file
      }
    });

    const isExpo = airborneConfig.expo || false;
    let command;
    if (isExpo) {
      command = `cd '${options.directory_path}' && npx expo export:embed --platform ${platform} --dev false --entry-file '${entry_file}' --bundle-output '${build_folder}/${index_file_path}' --assets-dest '${build_folder}'`;
    } else {
      command = `cd '${options.directory_path}' && npx react-native bundle --platform ${platform} --dev false --entry-file '${entry_file}' --bundle-output '${build_folder}/${index_file_path}' --assets-dest '${build_folder}'`;
    }

    const bundleResult = await executeReactNativeBundleCommand(command);

    if (!bundleResult.success) {
      throw new Error(
        `React Native bundle command failed: ${bundleResult.error}`
      );
    }

    const baseDir = path.isAbsolute(options.directory_path)
      ? options.directory_path
      : path.join(process.cwd(), options.directory_path);

    const remotebundlePath = path.join(baseDir, build_folder);
    const remotebundleContents = readDirectoryRecursive(remotebundlePath);
    const existingReleaseConfig = await readReleaseConfig(
      options.directory_path,
      options.platform,
      airborneConfig.namespace
    );

    const releaseConfig = {
      version: existingReleaseConfig?.version || "",
      config: {
        version: existingReleaseConfig?.config?.version || "",
        boot_timeout:
          options.boot_timeout ?? existingReleaseConfig?.config?.boot_timeout,
        release_config_timeout:
          options.release_config_timeout ??
          existingReleaseConfig?.config?.release_config_timeout,
        properties: existingReleaseConfig?.config?.properties || {},
      },
      package: {
        name: airborneConfig.namespace,
        version: existingReleaseConfig?.package?.version || "",
        properties: existingReleaseConfig?.package?.properties || {},
        index: {
          file_path: airborneConfig[options.platform].index_file_path,
          url: "",
          checksum: "",
        },
        important: remotebundleContents
          .filter(
            (item) =>
              item.path !== airborneConfig[options.platform].index_file_path
          )
          .map((item) => ({
            file_path: item.path,
            url: "",
            checksum: "",
          })),
        lazy: [],
      },
      resources: (existingReleaseConfig?.resources || []).filter(
        (res) =>
          !remotebundleContents.some((item) => item.path === res.file_path)
      ),
    };

    await writeReleaseConfig(
      releaseConfig,
      platform,
      airborneConfig.namespace,
      options.directory_path
    );
  } catch (err) {
    console.error("❌ Failed to create local release config:", err.message);
  }
}

export async function releaseConfigExists(directoryPath, platform, namespace) {
  try {
    let configPath;

    if (platform === "android") {
      configPath = path.join(
        directoryPath,
        platform,
        "app",
        "src",
        "main",
        "assets",
        namespace,
        "release_config.json"
      );
    } else {
      configPath = path.join(directoryPath, platform, "release_config.json");
    }

    await fs.promises.access(configPath);
    return true;
  } catch (error) {
    return false;
  }
}
