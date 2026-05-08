import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { spawn } from "child_process";
import os from "os";

const require = createRequire(import.meta.url);


function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getPlatformBinaryNames() {
  switch (process.platform) {
    case "darwin":
      return ["osx-bin/hermesc"];
    case "linux":
      return ["linux64-bin/hermesc", "linux-bin/hermesc"];
    case "win32":
      return ["win64-bin/hermesc.exe"];
    default:
      return []; 
  }
}

function resolvePackageRoot(pkgName, projectRoot) {
  const nodeModulesRoot = path.join(projectRoot, "node_modules");
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
      paths: [nodeModulesRoot],
    });
    return path.dirname(pkgJsonPath);
  } catch {
    return null;
  }
}

function buildCandidatePaths(packageRoot) {
  const bins = getPlatformBinaryNames();
  const isWin = process.platform === "win32";
  const hermescBin = isWin ? "hermesc.exe" : "hermesc";

  return [
    ...bins.map((b) => path.join(packageRoot, "hermesc", b)),
    ...bins.map((b) => path.join(packageRoot, b)),
    ...bins.map((b) => path.join(packageRoot, "sdks", "hermesc", b)),
    path.join(
      packageRoot,
      "sdks",
      "hermes-engine",
      "destroot",
      "bin",
      hermescBin
    ),
  ].filter(Boolean);
}


const PRUNE_DIRS = new Set([
  ".git", "build", "dist", ".gradle",
  ".cache", ".yarn", "__tests__", "test", "docs", "example", "examples",
]);


function findFirstExecutableInTree(startDir, fileName, maxDepth = 6) {
  function walk(dir, depth) {
    if (depth > maxDepth) return null;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null; 
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (PRUNE_DIRS.has(entry.name)) continue;
        const found = walk(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      } else if (entry.isFile() && entry.name === fileName) {
        const fullPath = path.join(dir, entry.name);
        if (isExecutable(fullPath)) return fullPath;
      }
    }

    return null;
  }

  return walk(startDir, 0);
}


const KNOWN_PACKAGES = ["hermes-compiler", "hermes-engine", "react-native"];

export function findHermesCompiler(projectRoot) {
  const nodeModulesDir = path.join(projectRoot, "node_modules");

  for (const pkg of KNOWN_PACKAGES) {
    const packageRoot = resolvePackageRoot(pkg, projectRoot);

    if (!packageRoot) continue;

    if (!packageRoot.startsWith(nodeModulesDir + path.sep)) continue;

    const candidates = buildCandidatePaths(packageRoot);

    for (const candidate of candidates) {
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  const hermescBin =
    process.platform === "win32" ? "hermesc.exe" : "hermesc";

  return findFirstExecutableInTree(nodeModulesDir, hermescBin);
}


export async function compileHermesBundle(projectRoot, bundlePath) {
  const hermescPath = findHermesCompiler(projectRoot);

  if (!hermescPath) {
    console.error("[Hermes] Error: Hermes compiler not found.");
    console.error("[Hermes] Make sure hermes-compiler, hermes-engine, or react-native is installed.");
    return;
  }

  const tempFile = path.join(os.tmpdir(), `${Date.now()}-${path.basename(bundlePath)}.hbc`);

  try {
    await runHermesCompiler(hermescPath, bundlePath, tempFile);
    fs.renameSync(tempFile, bundlePath);
    console.log(`[Hermes] Compiled ${bundlePath}`);
  } catch (error) {
    console.error(`[Hermes] Compilation failed: ${error.message}`);
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    throw error;
  }
}

function runHermesCompiler(hermescPath, inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ["-emit-binary", "-out", outputPath, inputPath];

    const child = spawn(hermescPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";
    let isSettled = false;

    const settle = (fn, arg) => {
      if (isSettled) return;
      isSettled = true;
      fn(arg);
    };

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        settle(reject, new Error(`hermesc exited with code ${code}: ${stderr || stdout || "(no output)"}`));
      } else {
        settle(resolve, undefined);
      }
    });

    child.on("error", (err) => {
      settle(reject, new Error(`Failed to spawn hermesc: ${err.message}`));
    });
  });
}

