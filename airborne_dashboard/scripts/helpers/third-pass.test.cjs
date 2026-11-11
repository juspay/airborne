const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const { test } = require("./harness.cjs");
const root = path.resolve(__dirname, "../..");
function jsx(file, tag, attribute, text, scope) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selected;
  function walk(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const open = ts.isJsxElement(node) ? node.openingElement : node;
      if (
        open.tagName.getText(ast) === tag &&
        open.attributes.properties.some(
          (p) =>
            p.name?.getText(ast) === attribute &&
            (p.initializer?.getText(ast) === JSON.stringify(text) || p.initializer?.getText(ast) === text)
        )
      )
        selected = node.getText(ast);
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(selected);
  const js = ts.transpileModule(`module.exports=(${selected});`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    module: mod,
    exports: mod.exports,
    require,
    Cell: "div",
    EmptyState: "div",
    RollbackSensitiveChip: "span",
    ShieldCheck: "span",
    ...scope,
  });
  return mod.exports;
}
test("unreadable marker renders not reported, distinct from a known empty marker list", () => {
  const file = "components/control-center/request-card.tsx";
  const unknown = jsx(file, "Cell", "label", "Marker now", { app: { release_protections: null }, now: null });
  assert.equal(unknown.props.children, "not reported");
  const known = jsx(file, "Cell", "label", "Marker now", { app: { release_protections: [] }, now: null });
  assert.equal(known.props.children, "not rollback-sensitive");
});

test("approval queue says unknown when an application's auxiliary read failed", () => {
  const file = "app/dashboard/control-center/approvals/page.tsx";
  const element = jsx(file, "EmptyState", "icon", "{ShieldCheck}", { apps: [{ auxiliary_error: "deadline" }] });
  assert.equal(element.props.title, "Review state unknown");
  assert.match(element.props.message, /could not be read/);
});

test("approval feedback and queue headers have valid paragraph nesting", () => {
  for (const file of [
    "components/control-center/approval-policy-editor.tsx",
    "app/dashboard/control-center/approvals/page.tsx",
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function walk(node, parents = []) {
      if (ts.isJsxElement(node)) {
        const tag = node.openingElement.tagName.getText(ast);
        if (tag === "p")
          assert.ok(!parents.includes("p") && !parents.includes("span"), `invalid ${parents.join("/")}/p in ${file}`);
        parents = [...parents, tag];
      }
      ts.forEachChild(node, (child) => walk(child, parents));
    }
    walk(ast);
  }
});

test("first-release rollback preview describes bundled code instead of package v0", () => {
  const source = fs.readFileSync(path.join(root, "components/control-center/release-actions.tsx"), "utf8");
  const ast = ts.createSourceFile("actions.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "resultRow")
      expression = node.initializer.getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(expression);
  const js = ts.transpileModule(`module.exports=(${expression});`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    module: mod,
    exports: mod.exports,
    require,
    previewState: { status: "ready" },
    resulting: 0,
    action: "concluded_control",
    previewFailure: null,
    PkgLine: "div",
  });
  assert.equal(mod.exports.props.children, "Bundled code returns to 100%");
});

test("unknown markers remain unknown through emergency risk acceptance", () => {
  const { load } = require("./harness.cjs");
  const { protectionFor, requiresEmergencyRiskAcceptance } = load("lib/control-center/approval");
  assert.equal(protectionFor({ release_protections: null }, "one"), undefined);
  assert.equal(protectionFor({ release_protections: [] }, "one"), null);
  assert.equal(requiresEmergencyRiskAcceptance(undefined), true);
  assert.equal(requiresEmergencyRiskAcceptance("security"), true);
  assert.equal(requiresEmergencyRiskAcceptance(null), false);
});

test("an empty auxiliary-error diagnostic still shows the request-page warning", () => {
  const file = "app/dashboard/control-center/[orgId]/apps/[appId]/requests/[requestId]/page.tsx";
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function walk(node) {
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      let right = node.expression.right;
      while (ts.isParenthesizedExpression(right)) right = right.expression;
      if (
        ts.isJsxElement(right) &&
        right.openingElement.tagName.getText(ast) === "p" &&
        right.openingElement.attributes.properties.some(
          (p) => p.name?.getText(ast) === "role" && p.initializer?.getText(ast) === '"alert"'
        )
      )
        expression = node.expression.getText(ast);
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(expression);
  const code = ts.transpileModule(`module.exports=(${expression});`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  function render(error) {
    const mod = { exports: {} };
    vm.runInNewContext(code, {
      module: mod,
      exports: mod.exports,
      require,
      located: { app: { auxiliary_error: error } },
    });
    return mod.exports;
  }
  assert.equal(render("").type, "p");
  assert.equal(render(null), false);
});
