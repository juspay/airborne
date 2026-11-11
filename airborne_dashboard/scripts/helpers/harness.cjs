// Loads the dashboard's TypeScript helpers into plain node for the checks in this folder.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..", "..");
const cache = new Map();

/** Load a TypeScript module from the dashboard, resolving relative and "@/" imports and nothing else. */
function load(name) {
  const file = path.join(root, `${name}.ts`);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const requireFrom = (spec) => {
    if (spec.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(file), spec)));
    if (spec.startsWith("@/")) return load(spec.slice(2));
    return require(spec);
  };
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(out, {
    exports: mod.exports,
    module: mod,
    require: requireFrom,
    Intl,
    Error,
    Date,
    Math,
    URL,
    URLSearchParams,
  });
  return mod.exports;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

module.exports = { load, test, tests };
