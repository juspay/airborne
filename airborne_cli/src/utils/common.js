import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { promptWithType } from "./prompt.js";

function persistToConfig(configPath, platform, fields, label) {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!raw[platform]) {
      raw[platform] = {};
    }
    for (const [key, value] of Object.entries(fields)) {
      raw[platform][key] = value;
    }
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2), "utf8");
    const keys = Object.keys(fields).join(", ");
    console.log(`✅ Updated ${label} ${keys} in ${configPath}`);
  } catch (err) {
    console.error(
      `⚠️  Could not persist ${label} config to file:`,
      err.message
    );
  }
}

export async function readAndResolveAirborneConfig(directoryPath, platform) {
  const airborneConfig = await readAirborneConfig(directoryPath);
  const configPath = path.join(directoryPath, "airborne-config.json");
  const label = platform === "android" ? "Android" : "iOS";

  if (!airborneConfig[platform]) {
    airborneConfig[platform] = {};
  }

  const fieldsToPersist = {};

  if (!airborneConfig[platform].organisation) {
    const oldOrganisation = airborneConfig.organisation || undefined;

    airborneConfig[platform].organisation = await promptWithType(
      `\n Please enter the ${label} organisation name${oldOrganisation ? ` (default: ${oldOrganisation})` : ""}: `,
      "string",
      oldOrganisation
    );
    fieldsToPersist.organisation = airborneConfig[platform].organisation;
  }

  if (!airborneConfig[platform].namespace) {
    const oldNamespace = airborneConfig.namespace || undefined;

    airborneConfig[platform].namespace = await promptWithType(
      `\n Please enter the ${label} namespace/application name${oldNamespace ? ` (default: ${oldNamespace})` : ""}: `,
      "string",
      oldNamespace
    );
    fieldsToPersist.namespace = airborneConfig[platform].namespace;
  }

  if (Object.keys(fieldsToPersist).length > 0) {
    persistToConfig(configPath, platform, fieldsToPersist, label);
  }

  airborneConfig.namespace = airborneConfig[platform].namespace;
  airborneConfig.organisation = airborneConfig[platform].organisation;

  return airborneConfig;
}

const cliToConfigMap = {
  platform: "platform",
  tag: "tag",
  androidOrganisation: "android.organisation",
  iosOrganisation: "ios.organisation",
  androidNamespace: "android.namespace",
  iosNamespace: "ios.namespace",
  jsEntryFile: "js_entry_file",
  androidIndex: "android.index_file_path",
  iosIndex: "ios.index_file_path",
  upload: "upload",
  directoryPath: "directory_path",
  bootTimeout: "boot_timeout",
  releaseConfigTimeout: "release_config_timeout",
  expo: "expo",
};

export function normalizeOptions(options = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(options)) {
    const mappedKey = cliToConfigMap[key] || key;
    normalized[mappedKey] = value;
  }

  return normalized;
}

export async function readAirborneConfig(directoryPath) {
  const configPath = path.join(directoryPath, "airborne-config.json");

  try {
    // Check if file exists
    await fs.promises.access(configPath);
  } catch {
    throw new Error(
      `❌ Airborne config not found at ${configPath}, try using create-local-release-config`
    );
  }

  try {
    const configContent = await fs.promises.readFile(configPath, "utf8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error("❌ Failed to read airborne-config.json:", error.message);
    throw error;
  }
}

export async function writeAirborneConfig(options) {
  try {
    const filledOptions = await fillAirborneConfigOptions(options);
    const config = {
      expo: filledOptions.expo,
      js_entry_file: filledOptions.js_entry_file,
      android: {
        organisation: filledOptions.android.organisation,
        namespace: filledOptions.android.namespace,
        index_file_path: filledOptions.android.index_file_path,
      },
      ios: {
        organisation: filledOptions.ios.organisation,
        namespace: filledOptions.ios.namespace,
        index_file_path: filledOptions.ios.index_file_path,
      },
    };
    const configPath = path.join(
      filledOptions.directory_path,
      "airborne-config.json"
    );
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.log(`✅ Config written to ${configPath}`);
  } catch (err) {
    console.error("❌ Failed to create local airborne config:", err.message);
    process.exit(1); // Exit with failure code
  }
}

export async function fillAirborneConfigOptions(options = {}) {
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

  // Ask for expo first
  if (getNested(result, "expo") === undefined) {
    const expoValue = await promptWithType(
      "\n Is this an Expo project? (y/n, default: no): ",
      "boolean",
      false
    );
    setNested(result, "expo", expoValue);
  }

  const isExpo = getNested(result, "expo");

  const questions = [
    {
      key: "android.organisation",
      question: "\n Please enter the Android organisation name: ",
      expectedType: "string",
    },
    {
      key: "ios.organisation",
      question: "\n Please enter the iOS organisation name: ",
      expectedType: "string",
    },
    {
      key: "android.namespace",
      question: "\n Please enter the Android namespace/application name: ",
      expectedType: "string",
    },
    {
      key: "ios.namespace",
      question: "\n Please enter the iOS namespace/application name: ",
      expectedType: "string",
    },
    {
      key: "js_entry_file",
      question: isExpo
        ? "\n Please enter the JavaScript entry file (default: node_modules/expo-router/entry.js): "
        : "\n Please enter the JavaScript entry file (default: index.js): ",
      expectedType: "string",
      defaultValue: isExpo ? "node_modules/expo-router/entry.js" : "index.js",
    },
    {
      key: "android.index_file_path",
      question:
        "\n Please enter the Android index file path (default: index.android.bundle): ",
      expectedType: "string",
      defaultValue: "index.android.bundle",
    },
    {
      key: "ios.index_file_path",
      question:
        "\n Please enter the iOS index file path (default: main.jsbundle): ",
      expectedType: "string",
      defaultValue: "main.jsbundle",
    },
  ];

  for (const { key, question, expectedType, defaultValue } of questions) {
    let value;

    if (getNested(result, key) !== undefined) {
      value = getNested(result, key);
    } else if (question) {
      value = await promptWithType(question, expectedType, defaultValue);
    }

    if (value !== undefined) {
      setNested(result, key, value);
    }
  }

  return result;
}

export async function sha256FileHex(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

export function hexToBase64(hex) {
  return Buffer.from(hex, "hex").toString("base64");
}

export function stripMetadata(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stripMetadata);
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      if (key === "$metadata") continue;
      newObj[key] = stripMetadata(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function removeToken(text) {
  return (
    text
      // 1. Remove whole `--token <...>` in any usage line
      .replace(/\s*--token\s+<[^>\s]+>/g, "")

      // 2. Fix cases where we had " \\" at the end of a line
      .replace(/\\\s*\n\s*\n/g, "\n\n")

      // 3. Remove full parameter definition lines for token
      .replace(/^\s*--token[^\n]*(\n|$)/gm, "")

      // 4. If leftover text "(required) : Bearer token..." is stuck on another line, drop it
      .replace(/\(required\)\s*:\s*Bearer token[^\n]*/gi, "")

      // 5. Remove JSON `"token": "..."` entries
      .replace(/"token"\s*:\s*"[^"]*",?\s*\n?/g, "")

      // 6. Cleanup trailing spaces per line
      .replace(/[ \t]+$/gm, "")
  );
}

export function formatCommand(cmd) {
  cmd.options = cmd.options.filter((opt) => opt.long !== "--token");
  cmd._description = removeToken(cmd._description);
  cmd._description = cmd._description.replace(
    /airborne-core-cli/g,
    "airborne-devkit"
  );
  cmd.listeners("option:token").forEach((listener) => {
    cmd.removeListener("option:token", listener);
  });
  const afterHelpListeners = cmd.listeners("afterHelp");
  cmd.removeAllListeners("afterHelp");
  afterHelpListeners.forEach((fn) => {
    cmd.on("afterHelp", function (...args) {
      const originalWrite = process.stdout.write;
      let output = "";

      // hijack stdout to capture output
      process.stdout.write = (chunk, ...rest) => {
        output += chunk;
        return true;
      };

      fn.apply(this, args);

      // replace airborne_core_åcli with airborne-devkit
      output = output.replace(/airborne-core-cli/g, "airborne-devkit");

      // restore stdout
      process.stdout.write = originalWrite;

      // write sanitized output
      process.stdout.write(removeToken(output));
    });
  });

  cmd.hook("preAction", async (thisCmd) => {
    const token = loadToken(process.cwd());
    if (token?.access_token) {
      thisCmd.setOptionValue("token", token.access_token);
    }
  });

  return cmd;
}

export async function saveToken(access_token, refresh_token, directory_path) {
  try {
    let tokenPath;

    if (process.env.CI === "true") {
      tokenPath = path.join("/tmp", "airborne_tokens.json");
    } else {
      if (!directory_path) {
        throw new Error("directory_path is required for non-CI usage.");
      }

      const airborneDir = path.join(directory_path, ".airborne");

      // Create .airborne directory if it doesn't exist
      if (!fs.existsSync(airborneDir)) {
        fs.mkdirSync(airborneDir, { recursive: true, mode: 0o700 }); // rwx------
      }

      tokenPath = path.join(airborneDir, "credentials.json");
    }

    const data = {
      access_token,
      refresh_token,
      saved_at: new Date().toISOString(),
    };

    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2), {
      mode: 0o600, // rw------- permissions
    });
    const gitignorePath = path.join(directory_path, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    }

    if (!gitignoreContent.includes(".airborne")) {
      gitignoreContent +=
        (gitignoreContent.endsWith("\n") ? "" : "\n") + ".airborne\n";
      fs.writeFileSync(gitignorePath, gitignoreContent, "utf8");
    }
  } catch (err) {
    console.error("❌ Failed to save tokens:", err.message);
    throw err;
  }
}

export function loadToken(directory_path) {
  try {
    let tokenPath;

    if (process.env.CI === "true") {
      tokenPath = path.join("/tmp", "airborne_tokens.json");
    } else {
      if (!directory_path) {
        throw new Error("directory_path is required for non-CI usage.");
      }
      tokenPath = path.join(directory_path, ".airborne", "credentials.json");
    }

    if (fs.existsSync(tokenPath)) {
      return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    }

    return null;
  } catch (err) {
    console.error("❌ Failed to load tokens:", err.message);
    return null;
  }
}

export async function airborneConfigExists(directoryPath) {
  try {
    const configPath = path.join(directoryPath, "airborne-config.json");
    await fs.promises.access(configPath);
    return true;
  } catch (error) {
    return false;
  }
}
