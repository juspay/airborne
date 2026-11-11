const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const React = require("react");
const { test } = require("./harness.cjs");
function tree() {
  const file = path.resolve(__dirname, "../../components/control-center/approval-policy-editor.tsx");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const stub = () => null;
  vm.runInNewContext(code, {
    module: mod,
    exports: mod.exports,
    require: (name) => {
      if (name === "react") return { ...React, useState: (x) => [x, stub], useEffect: stub };
      if (name.startsWith("react/")) return require(name);
      if (name.includes("/hooks")) return new Proxy({}, { get: () => () => ({}) });
      if (name.endsWith("/approval")) return { validatePolicy: () => [] };
      if (name.endsWith("/types")) return { DEFAULT_APPROVAL_POLICY: { enabled: false } };
      if (name.endsWith("/format")) return { platformLabel: () => "Web" };
      return new Proxy({}, { get: (_, key) => key });
    },
  });
  return mod.exports.ApplyPolicyToGroupDialog({
    open: true,
    onOpenChange: stub,
    org: "scratch",
    groupName: "test",
    members: [{ application: "app" }],
    pendingByApp: {},
    policiesByApp: {},
    stateReady: false,
  });
}
function nodes(x) {
  if (!x || typeof x !== "object") return [];
  return [x, ...React.Children.toArray(x.props?.children).flatMap(nodes)];
}
test("a group policy dialog blocks writes and states unknown when auxiliary reads fail", () => {
  const xs = nodes(tree());
  const apply = xs.find((x) => x.type === "Button" && x.props.onClick && !x.props.variant);
  assert.equal(apply.props.disabled, true);
  assert.ok(xs.some((x) => String(x.props?.children).includes("Approval state could not be verified")));
});
