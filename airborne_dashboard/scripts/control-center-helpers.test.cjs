// Plain-node checks for the Control Center helpers in lib/control-center. Run with `npm run test:helpers`.
const fs = require("node:fs");
const path = require("node:path");
const { tests } = require("./helpers/harness.cjs");

const dir = path.join(__dirname, "helpers");
for (const f of fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".test.cjs"))
  .sort())
  require(path.join(dir, f));

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}\n`, e);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
