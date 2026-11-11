import fs from "fs";
import path from "path";

// Per-project CLI settings live in <project>/.airborne/config.json, next to the credentials and file mappings,
// so two projects can talk to two servers and nothing is written into the shared CLI checkout.
const userEndpoint = process.env.AIRBORNE_BASE_URL;

export function projectConfigPath(directory) {
  return path.join(directory, ".airborne", "config.json");
}

export function readProjectConfig(directory) {
  try {
    return JSON.parse(fs.readFileSync(projectConfigPath(directory), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw new Error(`Cannot read ${projectConfigPath(directory)}: ${err.message}`);
  }
}

export function parseBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Base URL must be an absolute http(s) URL, got "${value}"`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL must be an http(s) origin without credentials, query or fragment");
  }
  return value.replace(/\/+$/, "");
}

export function writeProjectConfig(directory, fields) {
  const file = projectConfigPath(directory);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let previous = {};
  try { previous = readProjectConfig(directory); } catch {}
  fs.writeFileSync(file, JSON.stringify({ ...previous, ...fields }, null, 2) + "\n", { mode: 0o600 });
  return file;
}

// Point the core CLI at this project's server. An AIRBORNE_BASE_URL set by the user always wins.
export function useProjectEndpoint(directory) {
  if (userEndpoint) return userEndpoint;
  const { baseUrl } = readProjectConfig(directory);
  if (baseUrl) process.env.AIRBORNE_BASE_URL = baseUrl;
  else delete process.env.AIRBORNE_BASE_URL;
  return baseUrl;
}
