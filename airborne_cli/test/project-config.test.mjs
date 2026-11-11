import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readProjectConfig,writeProjectConfig} from '../src/utils/project-config.js';

test('configure repairs malformed project settings', t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airborne-config-repair-'));
 t.after(() => fs.rmSync(dir, {recursive:true}));
 fs.mkdirSync(path.join(dir,'.airborne'));
 fs.writeFileSync(path.join(dir,'.airborne/config.json'), '{');
 writeProjectConfig(dir, {baseUrl:'http://localhost:8099'});
 assert.equal(readProjectConfig(dir).baseUrl,'http://localhost:8099');
});
