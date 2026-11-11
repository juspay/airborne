const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test } = require("./harness.cjs");
function render(roles) {
  const file = path.resolve(__dirname, "../../components/control-center/abandon-rollback.tsx");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod,
    exports: mod.exports,
    require: (name) => {
      if (name.startsWith("react")) return require(name);
      if (name.includes("app-context")) return { useAppContext: () => ({ getOrgAccess: () => roles }) };
      if (name.includes("/ui/"))
        return new Proxy(
          {},
          {
            get:
              () =>
              ({ children }) =>
                React.createElement("div", null, children),
          }
        );
      return {};
    },
  });
  return renderToStaticMarkup(
    React.createElement(mod.exports.AbandonRollback, { org: "scratch", app: "test", releaseId: "r" })
  );
}
test("abandon rollback is visible only to organisation administrators", () => {
  assert.match(render(["owner"]), /Abandon rollback/);
  assert.doesNotMatch(render(["read"]), /Abandon rollback/);
  assert.match(render(["read"]), /organisation admin/);
});
