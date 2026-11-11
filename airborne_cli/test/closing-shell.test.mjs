import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {executeReactNativeBundleCommand} from '../src/utils/file.js';
test('bundle runner preserves quotes and spaces as literal arguments and cwd', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(), "airborne ' quoted "));
 t.after(()=>fs.rmSync(dir,{recursive:true}));
 const entry="entry '; touch INJECTED; #.js";
 const result=await executeReactNativeBundleCommand({file:process.execPath,args:['-e','console.log(JSON.stringify([process.cwd(),process.argv[1]]))',entry],cwd:dir});
 assert.equal(result.success,true);
 assert.deepEqual(JSON.parse(result.output),[fs.realpathSync(dir),entry]);
 assert.equal(fs.existsSync(path.join(dir,'INJECTED')),false);
});
test('web build receives literal output environment and quoted cwd', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(), "airborne web ' "));
 t.after(()=>fs.rmSync(dir,{recursive:true}));
 const result=await executeReactNativeBundleCommand({file:process.execPath,args:['-e','console.log(process.env.AIRBORNE_INDEX_FILE)'],cwd:dir,env:{AIRBORNE_INDEX_FILE:"index ' quoted.js"}});
 assert.equal(result.success,true);
 assert.equal(result.output.trim(),"index ' quoted.js");
});
