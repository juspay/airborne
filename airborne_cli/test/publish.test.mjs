import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundleRelease, detectAppVersion, publishRelease } from '../src/utils/publish.js';

const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airborne-publish-')); t.after(() => fs.rmSync(dir, { recursive: true })); return dir; };
function harness({ failAt, appVersion = '1.0' } = {}) {
 const calls = [];
 const release = { package: { version: '1', index: { file_path: 'index.android.bundle' } } };
 const step = (name, fn) => async (...args) => { calls.push(name); if (failAt === name) throw Object.assign(new Error(`${name} refused`), failAt === 'ramp' ? { $metadata: { httpStatusCode: 403 }, code: 'approval_required' } : {}); return fn?.(...args); };
 const deps = {
  token: () => 'tok', endpoint: () => 'http://localhost:8099',
  readConfig: async () => ({ organisation: 'quickstart', namespace: 'my-android' }),
  readRelease: async () => release,
  bundle: step('bundle'),
  register: step('upload', (config, rel, options) => { calls.push(`upload:${options.upload}:${config.tag}`); }),
  createPackage: step('package', (config, rel) => { rel.package.version = '7'; }),
  prepareRelease: step('release', async args => { calls.push(`release:${args.packageVersion}:${args.appVersion}:${args.endpoint}`); return { id: 'rel-1' }; }),
  lifecycle: step('ramp', async (kind, args) => { calls.push(`${kind}:${args.releaseId}:${args.percentage ?? args.variant}:${args.organisation}/${args.application}`); }),
 };
 deps.lifecycle = async (kind, args) => {
  if (failAt === kind) throw Object.assign(new Error(`${kind} refused`), { $metadata: { httpStatusCode: 403 }, code: 'approval_required' });
  calls.push(`${kind}:${args.releaseId}:${args.percentage ?? args.variant}:${args.organisation}/${args.application}`);
 };
 return { calls, deps, options: { directory: '/proj', platform: 'android', appVersion } };
}

test('publish runs bundle, upload, package, release, ramp and conclude in order, using the server-assigned package version', async () => {
 const { calls, deps, options } = harness();
 const result = await publishRelease({ ...options, tag: 'nightly', conclude: true }, deps);
 assert.deepEqual(calls, ['bundle', 'upload', 'upload:true:nightly', 'package', 'release', 'release:7:1.0:http://localhost:8099', 'ramp:rel-1:50:quickstart/my-android', 'conclude:rel-1:release:quickstart/my-android']);
 assert.deepEqual(result, { platform: 'android', organisation: 'quickstart', application: 'my-android', packageVersion: '7', appVersion: '1.0', releaseId: 'rel-1', state: 'concluded', ramp: 50 });
});
test('--prepare-only leaves the release at zero traffic; --no-conclude stops after the ramp; --ramp sets the share', async () => {
 let h = harness();
 assert.equal((await publishRelease({ ...h.options, prepareOnly: true }, h.deps)).state, 'created');
 assert.equal(h.calls.some(c => c.startsWith('ramp')), false);
 h = harness();
 const ramped = await publishRelease({ ...h.options, conclude: false, ramp: 10 }, h.deps);
 assert.equal(ramped.state, 'ramped'); assert.equal(ramped.ramp, 10);
 assert.equal(h.calls.some(c => c.startsWith('conclude')), false);
 await assert.rejects(publishRelease({ ...harness().options, ramp: 80 }, harness().deps), /0 to 50/);
});
test('a failing stage is named, stops everything after it and says what already exists', async () => {
 for (const [failAt, stage] of [['bundle', 'bundling'], ['upload', 'uploading files'], ['package', 'creating the package'], ['release', 'preparing the release']]) {
  const h = harness({ failAt });
  await assert.rejects(publishRelease(h.options, h.deps), new RegExp(`Publish stopped while ${stage}: ${failAt} refused`));
  assert.equal(h.calls.at(-1), failAt, `${failAt} is the last call`);
 }
 const h = harness({ failAt: 'ramp' });
 await assert.rejects(publishRelease(h.options, h.deps), /stopped while ramping: HTTP 403: approval_required: ramp refused\. The release rel-1 exists/);
 assert.equal(h.calls.some(c => c.startsWith('conclude')), false);
 const c = harness({ failAt: 'conclude' });
 await assert.rejects(publishRelease({ ...c.options, conclude: true }, c.deps), /stopped while concluding[\s\S]*rel-1 exists/);
});
test('publish refuses before touching anything when there is no server, no login or no app version', async () => {
 let h = harness();
 await assert.rejects(publishRelease(h.options, { ...h.deps, endpoint: () => undefined }), /airborne-devkit configure --base-url/);
 assert.deepEqual(h.calls, []);
 h = harness();
 await assert.rejects(publishRelease(h.options, { ...h.deps, token: () => { throw new Error('Your Airborne access token has expired'); } }), /has expired/);
 assert.deepEqual(h.calls, []);
 h = harness();
 await assert.rejects(publishRelease({ ...h.options, appVersion: undefined, directory: '/nonexistent' }, h.deps), /Pass --app-version/);
 assert.deepEqual(h.calls, []);
});
test('an expired token rejected mid-publish is explained as a login problem', async () => {
 const h = harness();
 h.deps.register = async () => { throw new Error('Failed to verify OIDC token: ExpiredSignature'); };
 await assert.rejects(publishRelease(h.options, h.deps), /Publish stopped while uploading files: Your Airborne access token has expired[\s\S]*airborne-devkit login/);
});

test('the app version is read from the binary\'s own version, as the SDK reports it', t => {
 const dir = temp(t);
 fs.mkdirSync(path.join(dir, 'android/app'), { recursive: true });
 fs.writeFileSync(path.join(dir, 'android/app/build.gradle'), 'android {\n  defaultConfig {\n    versionCode 1\n    versionName "1.0"\n  }\n}\n');
 assert.equal(detectAppVersion(dir, 'android'), '1.0');
 fs.writeFileSync(path.join(dir, 'android/app/build.gradle'), 'versionName = "2.3.4"\n');
 assert.equal(detectAppVersion(dir, 'android'), '2.3.4');
 fs.writeFileSync(path.join(dir, 'android/app/build.gradle'), 'versionName rootProject.ext.version\n');
 assert.equal(detectAppVersion(dir, 'android'), null);
 fs.mkdirSync(path.join(dir, 'ios/App.xcodeproj'), { recursive: true });
 const pbx = path.join(dir, 'ios/App.xcodeproj/project.pbxproj');
 fs.writeFileSync(pbx, 'MARKETING_VERSION = 1.0;\n\t\t\t\tMARKETING_VERSION = 1.0;\n');
 assert.equal(detectAppVersion(dir, 'ios'), '1.0');
 fs.writeFileSync(pbx, 'MARKETING_VERSION = 1.0;\nMARKETING_VERSION = 2.0;\n');
 assert.equal(detectAppVersion(dir, 'ios'), null);
 assert.equal(detectAppVersion(dir, 'web'), null);
});
test('bundle creates the release config the first time and rewrites it afterwards, so it works right after init', async () => {
 const calls = [];
 const deps = exists => ({ read: async () => ({ namespace: 'my-android' }), exists: async () => exists, update: async (c, o) => calls.push(['update', o.boot_timeout]), create: async (c, o) => calls.push(['create', o.boot_timeout, o.release_config_timeout]) });
 await bundleRelease('/p', 'android', {}, deps(true));
 await bundleRelease('/p', 'android', { bootTimeout: 9000 }, deps(true));
 await bundleRelease('/p', 'android', {}, deps(false));
 assert.deepEqual(calls, [['update', undefined], ['update', 9000], ['create', 4000, 4000]]);
});

test('iOS release config written by init needs no xcodeproj Ruby script; other projects still run it', async t => {
 const { iosResourceWiredByPodfile, writeReleaseConfig } = await import('../src/utils/release.js');
 const dir = temp(t);
 fs.mkdirSync(path.join(dir, 'ios'));
 assert.equal(iosResourceWiredByPodfile(dir), false);
 fs.writeFileSync(path.join(dir, 'ios/Podfile'), "target 'App' do\nend\n");
 assert.equal(iosResourceWiredByPodfile(dir), false);
 await assert.rejects(writeReleaseConfig({ package: {} }, 'ios', 'ns', dir), /xcodeproj' Ruby gem[\s\S]*do not need it/);
 fs.writeFileSync(path.join(dir, 'ios/Podfile'), "target 'App' do\nend\n# Airborne fallback resource\npost_integrate do |installer|\nend\n");
 assert.equal(iosResourceWiredByPodfile(dir), true);
 await writeReleaseConfig({ package: { name: 'ns' } }, 'ios', 'ns', dir);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'ios/release_config.json'), 'utf8')).package.name, 'ns');
});

 test('publish defaults to a ramp and prints the exact conclude command', async () => {
 const h = harness();
 const result = await publishRelease(h.options, h.deps);
 assert.equal(result.state, 'ramped');
 assert.equal(h.calls.some(c => c.startsWith('conclude')), false);
 assert.equal(result.concludeCommand, 'airborne-devkit conclude-release rel-1 -p android --variant release');
 });
 test('approval required at creation names the existing package and dashboard flow', async () => {
 const h = harness();
 h.deps.prepareRelease = async () => { throw Object.assign(new Error('approval_required'), {code: 'approval_required', $metadata: {httpStatusCode:403}}); };
 await assert.rejects(publishRelease(h.options,h.deps), /package 7.*requires approval.*dashboard/s);
 assert.equal(h.calls.some(c => c.startsWith('ramp')), false);
 });
