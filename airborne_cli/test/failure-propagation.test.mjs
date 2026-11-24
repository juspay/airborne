import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
// Link real helper source against isolated server actions: no network or credentials.
async function load(name) {
 const context=vm.createContext({console:{log(){},error(){}},process,Buffer});
 const source=fs.readFileSync(new URL('../src/utils/'+name,import.meta.url),'utf8');
 const module=new vm.SourceTextModule(source,{context,identifier:new URL('../src/utils/'+name,import.meta.url).href});
 await module.link(async spec=>{
  let exports;
  if(spec==='fs')exports={default:fs};
  else if(spec==='path')exports={default:path};
  else if(spec==='child_process')exports={execSync(){throw Error('command failed');}};
  else if(spec==='./common.js')exports={hexToBase64:v=>v,sha256FileHex:async()=>{throw Error('checksum failed');}};
  else if(spec==='airborne-core-cli/action')exports={UploadFileAction:async()=>{throw Error('server rejected upload');},CreateFileAction:async()=>{throw Error('server rejected file');},CreatePackageAction:async()=>{throw Error('server rejected package');}};
  else if(spec==='./file.js')exports={readFileMapping:async()=>({id:'index'})};
  else if(spec==='./release.js')exports={writeReleaseConfig:async()=>{}};
  else throw Error('Unexpected import '+spec);
  const stub=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context});return stub;
 });
 await module.evaluate();return module.namespace;
}
test('failed uploads and file creations reject instead of reporting successful completion',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'airborne-cli-failure-'));
 try {const m=await load('file.js');const config={directory_path:dir,organisation:'scratch',namespace:'scratch',tag:'test'};
 await assert.rejects(m.uploadFiles([{file_path:'missing.bundle'}],config));
 await assert.rejects(m.createFiles([{file_path:'missing.bundle'}],config,'http://localhost/'));
 } finally {fs.rmSync(dir,{recursive:true});}
});
test('server package rejection reaches command caller',async()=>{
 const m=await load('package.js');await assert.rejects(m.createPackageFromLocalRelease({directory_path:'/tmp'}, {package:{index:{file_path:'index.bundle'}}}),/server rejected package/);
});
test('a rejected package command exits nonzero in a Node process',()=>{
 const loader=fs.readFileSync(new URL(import.meta.url),'utf8').split("test('failed uploads")[0]
  .replace("new URL('../src/utils/'+name,import.meta.url)","new URL('"+new URL('../src/utils/',import.meta.url).href+"'+name)")
  .replace("new URL('../src/utils/'+name,import.meta.url)","new URL('"+new URL('../src/utils/',import.meta.url).href+"'+name)");
 const child=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',loader+"\nconst m=await load('package.js');await m.createPackageFromLocalRelease({}, {package:{index:{file_path:'index.bundle'}}});"],{encoding:'utf8'});
 assert.equal(child.status,1);assert.match(child.stderr,/server rejected package/);
});
