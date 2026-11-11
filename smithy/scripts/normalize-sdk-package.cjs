const fs = require("node:fs");

const packagePath = process.argv[2];
if (!packagePath) {
  throw new Error("Usage: node normalize-sdk-package.cjs <package.json>");
}

const source = fs.readFileSync(packagePath, "utf8");
const normalized = source.replace(/(?:\\n)+\s*$/, "");

// Smithy can emit a literal backslash-n after the final JSON brace. Strip only
// that invalid suffix, then validate the metadata before npm consumes it.
JSON.parse(normalized);

if (normalized !== source) {
  fs.writeFileSync(packagePath, `${normalized}\n`);
}
