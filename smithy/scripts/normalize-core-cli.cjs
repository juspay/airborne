// Repository adaptations applied after the upstream CLI generator.
const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2];
for (const file of ['action.js', 'index.js']) {
  const target = path.join(dir, file);
  let source = fs.readFileSync(target, 'utf8');
  source = source.replace(/export async function getBaseUrl\(\) \{[\s\S]*?\n\}/, `export async function getBaseUrl() {
  try {
    const config = JSON.parse(await fsPromises.readFile(configFilePath, "utf-8"));
    return config.baseUrl || "https://airborne.juspay.in";
  } catch (err) {
    if (err.code === "ENOENT") return "https://airborne.juspay.in";
    throw err;
  }
}`);
  // The generator emits bogus nested array paths (events[].undefined.id).
  // Require the array itself; the service validates its individual members.
  source = source.replace(/,"[^"\n]*\[\]\.undefined\.[^"\n]*"/g, '');
  fs.writeFileSync(target, source.split('\n').map(line => line.trimEnd()).join('\n'));
}
