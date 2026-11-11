import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const page = fs.readFileSync(new URL('../../airborne_docs/docs/guides/first-ota.md', import.meta.url), 'utf8');
const androidSection = page.slice(page.indexOf('## Run the first OTA on Android'), page.indexOf('### Telemetry on the published SDK'));
const blocks = [...androidSection.matchAll(/```sh\n([\s\S]*?)```/g)].map(m => m[1].split('\n').map(l => l.replace(/^   /, '')));

// A command is a top-level line, or a heredoc counted once; the first block only sets up the shell.
function commands(lines) {
 let count = 0, stop = null;
 for (const line of lines) {
  if (stop) { if (line === stop) stop = null; continue; }
  if (!line.trim()) continue;
  count++;
  const heredoc = line.match(/<<'?(\w+)'?/);
  if (heredoc) stop = heredoc[1];
 }
 return count;
}

test('the title states the number of Android commands the page contains', () => {
 const claimed = Number(page.match(/^title: .*\((\d+) commands on Android\)/m)[1]);
 assert.equal(blocks.slice(1).reduce((n, b) => n + commands(b), 0), claimed);
 assert.match(page, new RegExp(`\\*\\*${claimed} commands on Android\\*\\*`));
});
test('every airborne-devkit command the page runs exists', () => {
 const used = new Set([...page.matchAll(/airborne-devkit ([a-z][a-z-]+)/g)].map(m => m[1]));
 const help = spawnSync(process.execPath, [new URL('../src/index.js', import.meta.url).pathname, '--help'], { encoding: 'utf8' }).stdout;
 for (const name of used) assert.match(help, new RegExp(`^  ${name}[ \\n]`, 'm'), `${name} is not a command`);
 for (const name of ['configure', 'init', 'login', 'publish', 'bundle', 'create-remote-files', 'create-remote-package', 'first-release', 'ramp-release', 'conclude-release']) assert.ok(used.has(name), name);
});
test('the page covers each prerequisite the first run needed', () => {
 for (const needle of ['ANDROID_HOME', 'adb reverse tcp:4566', '--version 0.79.2', 'Create Application', 'Tokens → Create New Token', 'one token per platform', 'does not send boot telemetry', 'Loading package version', 'ramp', 'conclude']) assert.ok(page.includes(needle), needle);
 assert.doesNotMatch(page, /not a five-command/);
});

test('the 13-command flow explicitly opts into concluding on each platform', () => {
 for (const platform of ['android','ios']) assert.ok(page.includes(`airborne-devkit publish -p ${platform} --conclude`));
 const result = spawnSync(process.execPath, [new URL('../src/index.js', import.meta.url).pathname, 'publish', '--help'], {encoding:'utf8'});
 assert.equal(result.status, 0);
 assert.match(result.stdout, /--conclude/);
});
