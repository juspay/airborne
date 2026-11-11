import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allowLocalNetworking, initProject, isLocalHost } from '../src/init/project.js';
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
const local = { ...opts, endpoint: 'http://localhost:8099' };
const release = 'android/app/src/release';
test('a local HTTP endpoint gets Android release cleartext limited to local hosts, and init says so', t => {
 const dir = fixture(t);
 const out = initProject(dir, local);
 const xml = fs.readFileSync(path.join(dir, release, 'res/xml/network_security_config.xml'), 'utf8');
 assert.match(xml, /cleartextTrafficPermitted="true"/);
 for (const host of ['localhost', '127.0.0.1', '10.0.2.2']) assert.match(xml, new RegExp(`<domain includeSubdomains="false">${host.replaceAll('.', '\\.')}</domain>`));
 assert.doesNotMatch(xml, /example\.com|base-config/);
 assert.match(fs.readFileSync(path.join(dir, release, 'AndroidManifest.xml'), 'utf8'), /android:networkSecurityConfig="@xml\/network_security_config"/);
 assert.match(out, /cleartext HTTP to localhost, 127\.0\.0\.1, 10\.0\.2\.2 only/);
 assert.match(initProject(dir, local), /already initialized/);
});
test('a private-network endpoint is allowed by name; main manifest and debug build stay untouched', t => {
 const dir = fixture(t);
 const main = path.join(dir, 'android/app/src/main/AndroidManifest.xml');
 const before = fs.readFileSync(main, 'utf8');
 initProject(dir, { ...opts, endpoint: 'http://192.168.1.20:8099' });
 assert.match(fs.readFileSync(path.join(dir, release, 'res/xml/network_security_config.xml'), 'utf8'), />192\.168\.1\.20</);
 assert.equal(fs.readFileSync(main, 'utf8'), before);
 assert.equal(fs.existsSync(path.join(dir, 'android/app/src/debug')), false);
});
test('HTTPS adds no cleartext configuration; plain HTTP on a public host is refused loudly, not enabled', t => {
 const dir = fixture(t);
 assert.doesNotMatch(initProject(dir, opts), /cleartext|Warning/);
 assert.equal(fs.existsSync(path.join(dir, release)), false);
 const other = fixture(t);
 const plistBefore = fs.readFileSync(path.join(other, 'ios/Kharcha/Info.plist'), 'utf8');
 const out = initProject(other, { ...opts, endpoint: 'http://ota.example.com' });
 assert.match(out, /Warning: http:\/\/ota\.example\.com is plain HTTP on a non-local host[\s\S]*silently runs its bundled JS/);
 assert.equal(fs.existsSync(path.join(other, release)), false);
 assert.equal(fs.readFileSync(path.join(other, 'ios/Kharcha/Info.plist'), 'utf8'), plistBefore);
});
test('iOS local networking is added only where the template lacks it', t => {
 const dir = fixture(t);
 const plist = path.join(dir, 'ios/Kharcha/Info.plist');
 const kept = fs.readFileSync(plist, 'utf8');
 assert.match(kept, /NSAllowsLocalNetworking/);
 assert.match(initProject(dir, local), /already allows local networking; left unchanged/);
 assert.equal(fs.readFileSync(plist, 'utf8'), kept);
 const bare = '<plist><dict>\n\t<key>A</key>\n\t<string>b</string>\n</dict></plist>\n';
 assert.match(allowLocalNetworking(bare), /<key>NSAppTransportSecurity<\/key>\s*<dict>\s*<key>NSAllowsLocalNetworking<\/key>\s*<true\/>/);
 const strict = '<dict>\n\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<false/>\n\t</dict>\n</dict>';
 assert.match(allowLocalNetworking(strict), /NSAllowsLocalNetworking<\/key>\s*<true\/>/);
 const noLocal = '<dict>\n\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<false/>\n\t</dict>\n</dict>';
 assert.match(allowLocalNetworking(noLocal), /<key>NSAllowsLocalNetworking<\/key>\s*<true\/>[\s\S]*NSAllowsArbitraryLoads/);
 assert.equal(allowLocalNetworking(allowLocalNetworking(noLocal)), allowLocalNetworking(noLocal));
});
test('an existing network security configuration is reported, not overwritten', t => {
 const dir = fixture(t);
 const main = path.join(dir, 'android/app/src/main/AndroidManifest.xml');
 fs.writeFileSync(main, fs.readFileSync(main, 'utf8').replace('android:allowBackup', 'android:networkSecurityConfig="@xml/mine" android:allowBackup'));
 const out = initProject(dir, local);
 assert.match(out, /already has a network security configuration/);
 assert.equal(fs.existsSync(path.join(dir, release)), false);
});
test('isLocalHost recognises development hosts only', () => {
 for (const h of ['localhost', '127.0.0.1', '[::1]', '10.0.2.2', '192.168.0.4', '172.20.1.1', 'mac.local']) assert.equal(isLocalHost(h), true, h);
 for (const h of ['example.com', '8.8.8.8', '172.32.0.1', 'localhost.example.com', '11.0.0.1']) assert.equal(isLocalHost(h), false, h);
});
test('dry-run diff headers keep their slashes and notes name a missing Android SDK', t => {
 const dir = fixture(t);
 const diff = initProject(dir, { ...local, dryRun: true });
 assert.match(diff, /^diff --git a\/package\.json b\/package\.json$/m);
 assert.match(diff, /^--- a\/package\.json$/m);
 assert.match(diff, /^\+\+\+ b\/android\/app\/src\/release\/AndroidManifest\.xml$/m);
 assert.equal(fs.existsSync(path.join(dir, release)), false);
 const saved = { home: process.env.ANDROID_HOME, root: process.env.ANDROID_SDK_ROOT };
 delete process.env.ANDROID_HOME; delete process.env.ANDROID_SDK_ROOT;
 t.after(() => { if (saved.home) process.env.ANDROID_HOME = saved.home; if (saved.root) process.env.ANDROID_SDK_ROOT = saved.root; });
 assert.match(initProject(dir, { ...local, dryRun: true }), /ANDROID_HOME is not set[\s\S]*SDK location not found/);
 fs.writeFileSync(path.join(dir, 'android/local.properties'), 'sdk.dir=/x\n');
 assert.doesNotMatch(initProject(dir, { ...local, dryRun: true }), /ANDROID_HOME is not set/);
 process.env.ANDROID_HOME = '/sdk';
 fs.rmSync(path.join(dir, 'android/local.properties'));
 assert.doesNotMatch(initProject(dir, { ...local, dryRun: true }), /ANDROID_HOME is not set/);
});
