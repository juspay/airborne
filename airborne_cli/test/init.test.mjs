import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject } from '../src/init/project.js';
const opts = { organisation: 'sample', application: 'sample-android', endpoint: 'https://example.com' };
function fixture(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airborne-test-')); fs.cpSync(new URL('./fixtures/bare', import.meta.url), dir, { recursive: true }); t.after(() => fs.rmSync(dir, { recursive: true })); return dir; }
test('dry-run writes nothing; recognized native scaffold receives hosts, dimensions and bundled config', t => {
 const dir = fixture(t);
 const before = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
 const diff = initProject(dir, { ...opts, dryRun: true });
 assert.match(diff, /\+.*AirborneReactNativeHost/); assert.match(diff, /\+.*AirborneDelegate/);
 assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), before);
 assert.equal(fs.existsSync(path.join(dir, 'airborne-config.json')), false);
 initProject(dir, opts);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'airborne-config.json'))).android.namespace, opts.application);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'airborne-config.json'))).android.index_file_path, 'index.android.bundle');
 assert.doesNotMatch(fs.readFileSync(path.join(dir, 'android/app/build.gradle'), 'utf8'), /^\s*bundleAssetName\s*=/m);
 assert.match(fs.readFileSync(path.join(dir, 'android/app/src/main/java/com/kharcha/MainApplication.kt'), 'utf8'), /app_version.*BuildConfig.VERSION_NAME/);
 assert.match(fs.readFileSync(path.join(dir, 'ios/Podfile'), 'utf8'), /resources_build_phase.add_file_reference/);
 assert.match(initProject(dir, opts), /already initialized/);
});
test('unknown shape refuses all writes with actionable manual instructions', t => {
 const dir = fixture(t); const file = path.join(dir, 'android/app/src/main/java/com/kharcha/MainActivity.kt');
 fs.writeFileSync(file, 'custom activity');
 const before = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
 assert.throws(() => initProject(dir, opts), /Unsupported.*[\s\S]*Manual integration/);
 assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), before);
 assert.equal(fs.existsSync(path.join(dir, 'airborne-config.json')), false);
});
test('refuses unsafe identity, conflicting existing configs and edited initialized files', t => {
 const dir = fixture(t);
 assert.throws(() => initProject(dir, { ...opts, application: '../bad' }), /Invalid application/);
 initProject(dir, opts);
 fs.appendFileSync(path.join(dir, 'ios/Podfile'), '\n# local edit');
 assert.throws(() => initProject(dir, opts), /Initialized file changed/);
});
test('platforms use distinct application scopes', t => {
 const dir = fixture(t); initProject(dir, opts);
 const config = JSON.parse(fs.readFileSync(path.join(dir, 'airborne-config.json')));
 assert.notEqual(config.android.namespace, config.ios.namespace);
 assert.match(fs.readFileSync(path.join(dir, 'ios/Kharcha/AppDelegate.swift'), 'utf8'), /sample-android-ios/);
});
test('factory-style RN 0.79 delegate is integrated without starting React before Airborne', t => {
 const dir = fixture(t); const file = path.join(dir, 'ios/Kharcha/AppDelegate.swift');
 fs.copyFileSync(new URL('../src/init/shapes/ios-079.swift', import.meta.url), file);
 initProject(dir, opts);
 const patched = fs.readFileSync(file, 'utf8');
 assert.match(patched, /ReactNativeDelegate\(customPath: indexBundleURL\)/);
 assert.match(patched, /func startApp\(indexBundleURL: URL\?\)/);
 assert.equal((patched.match(/factory.startReactNative\(/g) || []).length, 1);
});
test('custom Swift logic is refused before modifying any file', t => {
 const dir = fixture(t); const file = path.join(dir, 'ios/Kharcha/AppDelegate.swift');
 fs.appendFileSync(file, '\nfunc customStartup() {}\n');
 assert.throws(() => initProject(dir, opts), /Unsupported ios[\s\S]*Manual integration/);
 assert.equal(fs.existsSync(path.join(dir, '.airborne-init.json')), false);
});
test('checkout testing can explicitly select a local native SDK module', t => {
 const dir = fixture(t);
 const sdk = path.join(dir, 'native-sdk'); fs.mkdirSync(sdk); fs.writeFileSync(path.join(sdk, 'build.gradle'), '// fixture');
 fs.writeFileSync(path.join(dir, 'android/settings.gradle'), "include ':app'\n");
 initProject(dir, { ...opts, androidSdkProject: sdk });
 assert.match(fs.readFileSync(path.join(dir, 'android/settings.gradle'), 'utf8'), /include ':airborne'/);
 assert.match(fs.readFileSync(path.join(dir, 'android/build.gradle'), 'utf8'), /airborne_version/);
 assert.match(fs.readFileSync(path.join(dir, 'android/build.gradle'), 'utf8'), /substitute module\('io\.juspay:airborne'\) using project\(':airborne'\)/);
});

test('iOS init applies the repeat-safe Apple fmt consteval workaround in the pod install hook', t => {
 const dir = fixture(t); initProject(dir, opts);
 const podfile = fs.readFileSync(path.join(dir, 'ios/Podfile'), 'utf8');
 assert.match(podfile, /fmt\/include\/fmt\/base.h/);
 assert.match(podfile, /#if defined\(__apple_build_version__\) \|\| !defined\(__cpp_lib_is_constant_evaluated\)/);
 assert.ok(podfile.indexOf('fmt_header =') > podfile.indexOf('post_install do |installer|'));
});

test('checkout testing can explicitly select a local iOS SDK pod', t => {
 const dir = fixture(t); const sdk = path.join(dir, 'ios-sdk'); fs.mkdirSync(sdk); fs.writeFileSync(path.join(sdk, 'Airborne.podspec'), '# fixture');
 initProject(dir, { ...opts, iosSdkProject: sdk });
 assert.match(fs.readFileSync(path.join(dir, 'ios/Podfile'), 'utf8'), /pod 'Airborne', :path =>/);
 assert.throws(() => initProject(dir, opts), /Already initialized/);
});

test('an absent optional iOS SDK field in earlier init state means the default SDK', t => {
 const dir = fixture(t); initProject(dir, opts);
 const file = path.join(dir, '.airborne-init.json'); const state = JSON.parse(fs.readFileSync(file));
 delete state.iosSdkProject; fs.writeFileSync(file, JSON.stringify(state));
 assert.match(initProject(dir, opts), /already initialized/);
});

test('unsafe native endpoint syntax is refused before writing', t => {
 for (const endpoint of ['https://e.com/${x}/$&', 'https://e.com/a"b\\(x)']) {
  const dir = fixture(t);
  assert.throws(() => initProject(dir, { ...opts, endpoint }), /Endpoint/);
  assert.equal(fs.existsSync(path.join(dir, '.airborne-init.json')), false);
 }
});
test('failed rename restores originals and a rerun recovers', t => {
 const dir = fixture(t); const before = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
 const original = fs.renameSync; let calls = 0;
 fs.renameSync = (...args) => { if (++calls === 3) throw new Error('injected write failure'); return original(...args); };
 try { assert.throws(() => initProject(dir, opts), /injected write failure/); }
 finally { fs.renameSync = original; }
 assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), before);
 assert.equal(fs.existsSync(path.join(dir, '.airborne-init.json')), false);
 initProject(dir, opts); assert.match(initProject(dir, opts), /already initialized/);
});

test('unrelated dependency edits do not prevent rerun', t => {
 const dir = fixture(t); initProject(dir, opts);
 const file = path.join(dir, 'package.json'); const pkg = JSON.parse(fs.readFileSync(file));
 pkg.dependencies['example-unrelated'] = '1.0.0'; fs.writeFileSync(file, JSON.stringify(pkg));
 assert.match(initProject(dir, opts), /already initialized/);
});

test('an explicit empty USE_FRAMEWORKS disables frameworks instead of calling empty to_sym', t => {
 const dir = fixture(t); initProject(dir, opts);
 assert.match(fs.readFileSync(path.join(dir, 'ios/Podfile'), 'utf8'), /linkage = nil if linkage.empty\?/);
});


test('a terminated writer leaves recoverable state and a rerun completes', t => {
 const dir = fixture(t);
 const source = new URL('../src/init/project.js', import.meta.url).href;
 const code = `import fs from 'node:fs'; import {initProject} from ${JSON.stringify(source)};
 const write = fs.writeFileSync;
 fs.writeFileSync = (file, ...args) => {
  if (String(file).replace(/\\.airborne-stage$/, '').endsWith('/ios/release_config.json')) process.exit(87);
  return write(file, ...args);
 };
 initProject(${JSON.stringify(dir)}, ${JSON.stringify(opts)});`;
 const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
 assert.equal(child.status, 87, child.stderr);
 initProject(dir, opts);
 assert.match(initProject(dir, opts), /already initialized/);
});

test('recovery refuses linked paths without overwriting their targets', t => {
 const dir = fixture(t); const target = path.join(dir, 'private.txt');
 fs.writeFileSync(target, 'keep'); fs.symlinkSync(target, path.join(dir, 'linked.txt'));
 fs.writeFileSync(path.join(dir, '.airborne-init-pending.json'), JSON.stringify([{ file: 'linked.txt', before: Buffer.from('overwrite').toString('base64') }]));
 assert.throws(() => initProject(dir, opts), /Refusing linked recovery path/);
 assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
});

test('atomic replacement preserves existing private file permissions', t => {
 const dir = fixture(t); const file = path.join(dir, 'package.json');
 fs.chmodSync(file, 0o600); initProject(dir, opts);
 assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});
