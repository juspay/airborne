import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {MAX_RAMP_PERCENTAGE, describeFailure, parseRampPercentage, resolveVariant, runLifecycle} from '../src/utils/lifecycle.js';

const args = {organisation: 'org', application: 'app', token: 't', releaseId: '42'};
function recorder(overrides = {}) {
 const calls = [];
 const make = name => async (_file, options) => {calls.push([name, options]); return {success: true, ...(overrides[name] || {})};};
 const actions = Object.fromEntries(['RampReleaseAction', 'ConcludeReleaseAction', 'DiscardReleaseAction', 'RollbackReleaseAction', 'GetReleaseAction'].map(n => [n, make(n)]));
 return {actions, calls};
}
const release = {experiment: {experiment_variants: {control: '42-control', experimentals: ['42-experimental_3']}}};

test('ramp percentage must be a whole number inside the range the experiment service accepts', () => {
 assert.equal(MAX_RAMP_PERCENTAGE, 50);
 for (const ok of ['0', '5', ' 50 ', 50]) assert.equal(parseRampPercentage(ok), Number(ok));
 for (const bad of ['51', '100', '-1', '1.5', 'abc', '', '5%', '1e1']) assert.throws(() => parseRampPercentage(bad), /0 to 50/, bad);
});
test('an over-limit ramp is refused before anything is sent', async () => {
 const {actions, calls} = recorder();
 await assert.rejects(runLifecycle('ramp', {...args, percentage: '60'}, actions), /0 to 50/);
 assert.deepEqual(calls, []);
});
test('ramp, discard and rollback map their arguments', async () => {
 const {actions, calls} = recorder();
 await runLifecycle('ramp', {...args, percentage: '25', reason: 'go'}, actions);
 await runLifecycle('discard', args, actions);
 await runLifecycle('rollback', {...args, reason: 'crash', emergency: true}, actions);
 assert.deepEqual(calls, [
  ['RampReleaseAction', {organisation: 'org', application: 'app', token: 't', release_id: '42', traffic_percentage: 25, change_reason: 'go'}],
  ['DiscardReleaseAction', {organisation: 'org', application: 'app', token: 't', release_id: '42'}],
  ['RollbackReleaseAction', {organisation: 'org', application: 'app', token: 't', release_id: '42', reason: 'crash', emergency: true, confirm_sensitive_risk: false}],
 ]);
});
test('conclude resolves control and release to the ids the server generated', async () => {
 const {actions, calls} = recorder({GetReleaseAction: release});
 await runLifecycle('conclude', {...args, variant: 'control'}, actions);
 await runLifecycle('conclude', {...args, variant: 'release'}, actions);
 await runLifecycle('conclude', {...args, variant: '42-experimental_3'}, actions);
 const chosen = calls.filter(c => c[0] === 'ConcludeReleaseAction').map(c => c[1].chosen_variant);
 assert.deepEqual(chosen, ['42-control', '42-experimental_3', '42-experimental_3']);
 const lookups = calls.filter(c => c[0] === 'GetReleaseAction');
 assert.equal(lookups.length, 2);
 assert.deepEqual(lookups[0][1], {organisation: 'org', application: 'app', token: 't', releaseId: '42'});
});
test('conclude refuses an ambiguous release choice and sends nothing', async () => {
 const two = {experiment: {experiment_variants: {control: 'c', experimentals: ['a', 'b']}}};
 const {actions, calls} = recorder({GetReleaseAction: two});
 await assert.rejects(runLifecycle('conclude', {...args, variant: 'release'}, actions), /2 experimental variants/);
 await assert.rejects(resolveVariant('release', '42', recorder({GetReleaseAction: {}}).actions, {}), /no experiment/);
 assert.equal(calls.filter(c => c[0] === 'ConcludeReleaseAction').length, 0);
});
test('server failures are described with status, code and operation', () => {
 assert.equal(describeFailure({$metadata: {httpStatusCode: 409}, code: 'unresolved', message: 'paused', operation_id: 'op1'}), 'HTTP 409: unresolved: paused (operation op1)');
 assert.equal(describeFailure({$response: {statusCode: 403}, code: 'approval_required', message: 'raise a request'}), 'HTTP 403: approval_required: raise a request');
 assert.equal(describeFailure(new Error('boom')), 'boom');
});

// Process level: needs the devkit's dependencies; skipped on a bare checkout.
let installed = true;
try {createRequire(import.meta.url).resolve('commander');} catch {installed = false;}
const devkit = new URL('../src/index.js', import.meta.url).pathname;
const cli = (...argv) => spawnSync(process.execPath, [devkit, ...argv], {encoding: 'utf8', env: {...process.env, CI: ''}});
test('lifecycle commands exit nonzero on bad input', {skip: !installed && 'devkit dependencies not installed'}, () => {
 for (const argv of [
  ['ramp-release', '1', '-p', 'web', '--percentage', '60'],
  ['ramp-release', '1', '-p', 'web'],
  ['conclude-release', '1', '-p', 'web'],
  ['rollback-release', '1', '-p', 'web'],
  ['ramp-release', '1', '--percentage', '5'],
 ]) {
  const r = cli(...argv);
  assert.notEqual(r.status, 0, argv.join(' '));
 }
 assert.match(cli('ramp-release', '1', '-p', 'web', '--percentage', '60').stderr, /0 to 50/);
 assert.equal(cli('ramp-release', '--help').status, 0);
});
