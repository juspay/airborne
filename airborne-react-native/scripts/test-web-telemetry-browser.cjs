// Builds independent host and OTA copies of the SDK and runs real cached OTA code in Chrome.
// NODE_PATH may point at esbuild and playwright installed outside the repository.
const {build}=require('esbuild');
const {chromium}=require('playwright');
const http=require('node:http');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fs=require('node:fs');
const chrome=process.env.CHROME_PATH || (process.platform==='darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : chromium.executablePath());
if (!fs.existsSync(chrome)) { console.log('SKIP browser telemetry: install Playwright Chromium or set CHROME_PATH'); process.exit(0); }
(async()=>{
 const bundle=async source=>(await build({stdin:{contents:source,resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser'})).outputFiles[0].text;
 const host=await bundle(`import {bootAirborne} from './src/web/loader'; window.boot=bootAirborne;`);
 const ota=await bundle(`import {markBootSuccess} from './src/index.web'; import {event} from './src/web/telemetry'; document.body.textContent='Healthy OTA rendered'; const analytics=document.createElement('script'); analytics.src='/analytics.js'; analytics.onload=()=>requestAnimationFrame(async()=>{await markBootSuccess('test'); event('test',window.__AIRBORNE__.test.releaseConfig,'package_downloaded');window.ack=true;}); document.head.appendChild(analytics); window.emitEvents=()=>['rollback','blocked_package','boot_failed','boot_started','boot_success'].forEach(kind=>event('test',window.__AIRBORNE__.test.releaseConfig,kind));`);
 const reports=[];
 const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'){let body='';for await(const c of req)body+=c;reports.push(...JSON.parse(body).events);res.end('{}');return;}
  res.setHeader('Content-Type', req.url.endsWith('.js')?'application/javascript':'text/html');res.end(req.url==='/ota.js'?ota:req.url==='/analytics.js'?"throw new Error('unrelated analytics failure')":'<html><body></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:chrome});
 try {
  const page=await browser.newPage();await page.goto(origin);await page.addScriptTag({content:host});
  const rc={version:'2',config:{version:'2',boot_timeout:100,release_config_timeout:100},package:{name:'test',version:'ota',index:{file_path:'ota.js',url:origin+'/ota.js',checksum:require('node:crypto').createHash('sha256').update(ota).digest('hex')},important:[],lazy:[]},resources:[],telemetry:{receipt:'receipt',expires_at:Date.now()/1000+3600,ingest_path:'/reports'}};
  await page.evaluate(async({rc,origin})=>{
   const cache=await caches.open('airborne:test:package:ota');const response=await fetch(origin+'/ota.js');const headers=new Headers(response.headers);headers.set('x-airborne-checksum',rc.package.index.checksum);const key=new URL(origin+'/ota.js');key.searchParams.append('airborne-sha',rc.package.index.checksum);await cache.put(key.toString(),new Response(await response.text(),{headers}));
   localStorage.setItem('airborne:test:state',JSON.stringify({current:rc,bundledVersion:"bundled"}));
   const bundled={...rc,package:{...rc.package,version:'bundled'}};
   await window.boot({namespace:'test',releaseConfigUrl:origin+'/offline',telemetryEnabled:true,bootGuardEnabled:true,bundled:{releaseConfig:bundled,baseUrl:origin}});
  },{rc,origin});
  await page.waitForFunction(()=>window.ack);
  const state=await page.evaluate(()=>({guard:JSON.parse(localStorage.getItem('airborne:test:state')).guard,telemetry:JSON.parse(localStorage.getItem('airborne:test:telemetry'))}));
  assert.equal(state.guard.pending,undefined);assert.equal(state.guard.lastGood.package.version,'ota');
  assert.equal(state.telemetry.pending,undefined,'OTA acknowledgement must clear telemetry pending');
  await page.waitForTimeout(500);
  assert(reports.some(e=>e.kind==='boot_success'),'real OTA copy must upload boot_success');
  assert(reports.some(e=>e.kind==='boot_started'));assert(reports.some(e=>e.kind==='package_downloaded'));
  await page.reload();await page.addScriptTag({content:host});
  await page.evaluate(async({rc,origin})=>window.boot({namespace:'test',releaseConfigUrl:origin+'/offline',telemetryEnabled:true,bootGuardEnabled:true,bundled:{releaseConfig:{...rc,package:{...rc.package,version:'bundled'}},baseUrl:origin}}),{rc,origin});
  await page.waitForFunction(()=>window.ack);await page.waitForTimeout(500);
  assert(!reports.some(e=>e.kind==='boot_failed'),'healthy reload must not emit boot_failed');
  await page.evaluate(()=>window.emitEvents());await page.waitForTimeout(500);
  for(const kind of ['rollback','blocked_package','boot_failed','boot_started','boot_success']) assert(reports.some(e=>e.kind===kind),kind+' must cross SDK copies');
  console.log('PASS real Chrome: independent SDK builds, cached OTA execution, acknowledgement, shared events and healthy reload',reports.map(e=>e.kind));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
