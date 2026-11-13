const assert = require('node:assert/strict');
const sdk = require('../../airborne_server_clients/javascript/sdk/dist-cjs');
function client(status, type, body) {
  return new sdk.AirborneClient({endpoint:'http://localhost',maxAttempts:1,token:{token:'test'},
    requestHandler:{async handle() {return {response:{statusCode:status,headers:{'content-type':'application/json','x-amzn-errortype':type},body:Buffer.from(JSON.stringify(body))}};}}});
}
(async () => {
  for(const [status,type,code,Command,input] of [
    [429,'TooManyRequestsError','telemetry_rate_limited',sdk.IngestTelemetryReportsCommand,{receipt:'r',install_id:'i',events:[]}],
    [503,'ServiceUnavailableError','telemetry_unavailable',sdk.IngestTelemetryReportsCommand,{receipt:'r',install_id:'i',events:[]}],
    [403,'ApprovalRequiredError','approval_required',sdk.CreateDimensionCommand,{organisation:'o',application:'a'}],
    [409,'ConflictError','execution_failed',sdk.ApproveControlCenterDeploymentRequestCommand,{organisation:'o',application:'a',id:'r'}],
  ]) {
    await assert.rejects(client(status,type,{code,message:'refused',application:'a',request_id:'r',request_status:'failed'}).send(new Command(input)), error => {
      assert(error instanceof sdk[type], `${type}: ${error.name}: ${error.message}`); assert.equal(error.code,code);
      if(code==='execution_failed') {assert.equal(error.request_id,'r');assert.equal(error.request_status,'failed');}
      return true;
    });
  }
  const result=await client(200,'',{window_days:7,releases:[],blocked_package_versions:['1']}).send(new sdk.GetTelemetrySummaryCommand({organisation:'o',application:'a'}));
  assert.deepEqual(result.blocked_package_versions,['1']);
  const listed=await client(200,'',{data:[{id:'one',warnings:['targeting is broad']}]}).send(new sdk.ListReleasesCommand({organisation:'o',application:'a'}));
  assert.deepEqual(listed.data[0].warnings,['targeting is broad']);
  console.log('generated client contracts: 6 passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
