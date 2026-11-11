import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowLocalNetworking, initProject} from '../src/init/project.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('empty ATS dictionaries are expanded without duplicate keys', () => {
 const out = allowLocalNetworking('<plist><dict><key>NSAppTransportSecurity</key><dict/></dict></plist>');
 assert.equal(out.match(/<key>NSAppTransportSecurity<\/key>/g).length,1);
 assert.match(out, /NSAllowsLocalNetworking/);
});
test('unsafe hostname is rejected before project writes', t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'airborne-host-'));
 t.after(()=>fs.rmSync(dir,{recursive:true}));
 assert.throws(()=>initProject(dir,{organisation:'o',application:'a',endpoint:'http://a&b.local:8080'}), /unsafe.*host/i);
 assert.deepEqual(fs.readdirSync(dir),[]);
});
