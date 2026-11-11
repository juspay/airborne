// Copyright 2026 Juspay Technologies. Apache-2.0.
const ts=require('typescript'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync(__dirname+'/../src/web/telemetry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const store=new Map(),requests=[];let status=503,offline=false;
 const c={exports:{},crypto:require('node:crypto').webcrypto,URL,AbortSignal,Date,Map,Set,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},window:{addEventListener(){}},setTimeout(){},fetch:async(url,init)=>{requests.push(JSON.parse(init.body));if(offline)throw new Error('offline');return {ok:status>=200&&status<300,status};}};
 vm.runInNewContext(source,c);
 c.exports.configureTelemetry({namespace:'test',releaseConfigUrl:'https://server/release/test',telemetryEnabled:true});await Promise.resolve();
 const rc={telemetry:{receipt:'receipt',expires_at:Date.now()/1000+3600,ingest_path:'/reports'}};
 for(let i=0;i<140;i++)c.exports.event('test',rc,'package_downloaded');
 const state=()=>JSON.parse(store.get('airborne:test:telemetry'));
 assert.equal(state().queue.length,128);
 await c.exports.flush('test');assert.equal(requests.at(-1).events.length,32);assert.equal(state().queue.length,128);
 offline=true;await c.exports.flush('test');assert.equal(state().queue.length,128);
 offline=false;status=400;await c.exports.flush('test');assert.equal(state().queue.length,96);
 status=200;await c.exports.flush('test');assert.equal(state().queue.length,64);
 const expired=state();expired.queue.forEach(e=>e.expires=1);store.set('airborne:test:telemetry',JSON.stringify(expired));await c.exports.flush('test');assert.equal(state().queue.length,0);
 c.exports.configureTelemetry({namespace:'test',telemetryEnabled:false});c.exports.event('test',rc,'boot_started');assert.equal(state().queue.length,0);
 console.log('PASS telemetry queue: cap 128, batch 32, offline/503 retry, 400 drop, success removal, expiry, opt out');
})().catch(e=>{console.error(e);process.exitCode=1});
