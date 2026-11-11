import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
test('core CLI uses the hosted endpoint, a shared .config, or a per-project AIRBORNE_BASE_URL that wins over both', async () => {
 const source=fs.readFileSync(new URL('../../airborne-core-cli/action.js',import.meta.url),'utf8');
 for (const [configured,env,expected] of [[undefined,undefined,'https://airborne.juspay.in'],['http://127.0.0.1:8096',undefined,'http://127.0.0.1:8096'],['http://127.0.0.1:8096',{AIRBORNE_BASE_URL:'http://localhost:8099'},'http://localhost:8099'],[undefined,{AIRBORNE_BASE_URL:'http://localhost:8099'},'http://localhost:8099']]) {
  const context=vm.createContext({console,process:{env:{...(env||{})}}});
  const mod=new vm.SourceTextModule(source,{context,initializeImportMeta(meta){meta.url=import.meta.url;}});
  await mod.link(async spec=>{
   let values;
   if(spec==='fs') values={default:fs,promises:{async readFile(){if(configured)return JSON.stringify({baseUrl:configured});throw Object.assign(Error('missing'),{code:'ENOENT'});}}};
   else if(spec==='path')values={default:path,dirname:path.dirname};
   else if(spec==='url')values={fileURLToPath};
   else if(spec==='airborne-server-sdk') {
    const names=source.match(/import \{([^}]+)\} from "airborne-server-sdk"/)[1].split(',').map(v=>v.trim());
    values=Object.fromEntries(names.map(name=>[name,class {}]));
   } else throw Error(spec);
   return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});
  });
  await mod.evaluate();
  assert.equal(await mod.namespace.getBaseUrl(),expected);
 }
});
