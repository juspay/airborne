import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { checkToken, explainAuthFailure, isAuthFailure, tokenExpiry } from '../src/utils/auth.js';
import { loadToken, requireToken, saveToken } from '../src/utils/common.js';
import { missingUploadMessage } from '../src/utils/package.js';

const jwt = exp => `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airborne-auth-')); t.after(() => fs.rmSync(dir, { recursive: true })); return dir; };

test('an expired token is reported with the time and the login command, before any request is made', () => {
 const now = Date.parse('2026-11-01T12:00:00Z');
 assert.equal(checkToken({ access_token: 'a', expires_at: '2026-11-01T12:30:00Z' }, now), 'a');
 assert.throws(() => checkToken({ access_token: 'a', expires_at: '2026-11-01T11:51:00Z' }, now), /has expired \(it expired at 2026-11-01T11:51:00\.000Z\)[\s\S]*airborne-devkit login --client_id[\s\S]*client secret/);
 assert.throws(() => checkToken(null, now), /Not logged in[\s\S]*airborne-devkit login/);
 assert.throws(() => checkToken({}, now), /Not logged in/);
});
test('tokens saved before expires_at existed fall back to the JWT exp claim; opaque tokens are left to the server', () => {
 const now = Date.parse('2026-11-01T12:00:00Z');
 assert.equal(tokenExpiry({ access_token: jwt(Date.parse('2026-11-01T11:00:00Z') / 1000) }), Date.parse('2026-11-01T11:00:00Z'));
 assert.throws(() => checkToken({ access_token: jwt(Date.parse('2026-11-01T11:00:00Z') / 1000) }, now), /expired/);
 assert.equal(checkToken({ access_token: 'opaque' }, now), 'opaque');
});
test('login records when the token stops working, and later commands read it', async t => {
 const dir = temp(t);
 await saveToken('tok', 'ref', dir, 600);
 const saved = loadToken(dir);
 assert.ok(Math.abs(Date.parse(saved.expires_at) - Date.parse(saved.saved_at) - 600000) < 1000);
 assert.equal(requireToken(dir), 'tok');
 fs.writeFileSync(path.join(dir, '.airborne/credentials.json'), JSON.stringify({ ...saved, expires_at: '2020-01-01T00:00:00Z' }));
 assert.throws(() => requireToken(dir), /has expired/);
 assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.airborne/);
});
test('the server\'s raw expiry error becomes a login instruction; other errors pass through', () => {
 const raw = 'Failed to verify OIDC token: ExpiredSignature';
 assert.equal(isAuthFailure(raw), true);
 assert.match(explainAuthFailure(raw), /has expired[\s\S]*airborne-devkit login/);
 assert.match(explainAuthFailure(new Error('releases: HTTP 401 {"message":"nope"}')), /server rejected the access token[\s\S]*airborne-devkit login/);
 assert.equal(explainAuthFailure('ENOENT: no such file'), 'ENOENT: no such file');
 const already = explainAuthFailure(raw);
 assert.equal(explainAuthFailure(already), already);
});
test('a missing upload names the step, tag and file instead of calling the package "missing upload"', t => {
 const dir = temp(t);
 const config = { directory_path: dir, organisation: 'quickstart', namespace: 'my-android', tag: 'first-ota', platform: 'android' };
 const none = missingUploadMessage('index.android.bundle', config);
 assert.match(none, /No uploaded record of "index\.android\.bundle" for organisation quickstart, application my-android, tag "first-ota"/);
 assert.match(none, /create-remote-files -p android --upload -t first-ota first/);
 assert.match(none, /fix any error it printed/);
 fs.mkdirSync(path.join(dir, '.airborne'));
 fs.writeFileSync(path.join(dir, '.airborne/mappings.json'), JSON.stringify({ quickstart: { 'my-android': { v1: { 'index.android.bundle': { id: 'x' } } } } }));
 assert.match(missingUploadMessage('index.android.bundle', config), /recorded under tag "v1"; pass -t v1/);
 assert.doesNotMatch(missingUploadMessage('index.android.bundle', { ...config, tag: undefined }), /-t first-ota/);
});

test('configure keeps the server in the project and never writes into the CLI checkout', t => {
 const dir = temp(t);
 const cli = new URL('../src/index.js', import.meta.url).pathname;
 const shared = new URL('../../airborne-core-cli/.config', import.meta.url).pathname;
 const before = fs.existsSync(shared) ? fs.readFileSync(shared, 'utf8') : null;
 const out = spawnSync(process.execPath, [cli, 'configure', '--base-url', 'http://localhost:8099/'], { cwd: dir, encoding: 'utf8' });
 assert.equal(out.status, 0, out.stderr);
 assert.match(out.stdout, /Base URL for this project set to http:\/\/localhost:8099 /);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.airborne/config.json'), 'utf8')), { baseUrl: 'http://localhost:8099' });
 assert.equal(fs.existsSync(shared) ? fs.readFileSync(shared, 'utf8') : null, before);
 const other = temp(t);
 const bad = spawnSync(process.execPath, [cli, 'configure', '--base-url', 'ftp://x', other], { encoding: 'utf8' });
 assert.equal(bad.status, 1); assert.match(bad.stderr, /http\(s\) origin/);
 assert.equal(fs.existsSync(path.join(other, '.airborne/config.json')), false);
});
test('login goes to the project\'s server, records the token lifetime and says how long it lasts', async t => {
 const dir = temp(t);
 const cli = new URL('../src/index.js', import.meta.url).pathname;
 const seen = [];
 const server = http.createServer((req, res) => {
  seen.push(`${req.method} ${req.url}`);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ access_token: 'abc', token_type: 'Bearer', expires_in: 540, refresh_token: 'r', refresh_expires_in: 1800 }));
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 t.after(() => server.close());
 const url = `http://127.0.0.1:${server.address().port}`;
 const run = args => new Promise(resolve => {
  const child = spawn(process.execPath, [cli, ...args], { cwd: dir });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => stdout += d); child.stderr.on('data', d => stderr += d);
  child.on('close', status => resolve({ status, stdout, stderr }));
 });
 assert.equal((await run(['configure', '--base-url', url])).status, 0);
 const login = await run(['login', '--client_id', 'a', '--client_secret', 'b']);
 assert.equal(login.status, 0, login.stderr);
 assert.equal(seen.length, 1);
 assert.equal(seen[0], "POST /api/token/issue");
 assert.match(login.stdout, new RegExp(`Login successful for ${url.replaceAll('.', '\\.')}\\. The access token is valid for about 9 minutes`));
 const saved = JSON.parse(fs.readFileSync(path.join(dir, '.airborne/credentials.json'), 'utf8'));
 assert.equal(saved.access_token, 'abc');
 assert.ok(Math.abs(Date.parse(saved.expires_at) - Date.parse(saved.saved_at) - 540000) < 1000);
});

test('publish stage and existing release survive action auth formatting', () => {
 const message = 'Publish stopped while ramping: HTTP 401: ExpiredSignature. The release rel-123 exists; finish it with conclude-release.';
 assert.equal(explainAuthFailure(new Error(message)), message);
});
