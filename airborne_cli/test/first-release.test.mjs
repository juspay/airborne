import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstRelease } from '../src/init/first-release.js';
const opts = { endpoint: 'https://example.com', organisation: 'o', application: 'a', packageVersion: '2', appVersion: '1.0.0', token: 'fixture' };
test('first release sets up exact compatibility and never changes exposure', async () => {
 const calls = [];
 const result = await firstRelease(opts, async (url, init) => { calls.push({ url, body: init.body ? JSON.parse(init.body) : undefined }); return { ok: true, status: 200, json: async () => url.includes('/list?') ? { data: [] } : ({ id: 'prepared' }) }; });
 assert.equal(result.id, 'prepared'); assert.equal(calls.length, 3);
 assert.equal(calls[1].body.dimension, 'app_version');
 assert.deepEqual(calls[2].body.dimensions, { app_version: '1.0.0' });
 assert.equal(calls[2].body.package_id, 'version:2');
});
test('dimension conflict is repeat safe; other errors never create release', async () => {
 let calls = 0;
 await assert.rejects(firstRelease(opts, async () => { calls++; return { ok: false, status: 403, text: async () => 'denied' }; }), /403/);
 assert.equal(calls, 1);
 await firstRelease(opts, async (url) => { calls++; return { ok: true, json: async () => url.includes('/list?') ? { data: [{ dimension: 'app_version', dimension_type: 'standard' }] } : ({}) }; });
 assert.equal(calls, 3);
});
