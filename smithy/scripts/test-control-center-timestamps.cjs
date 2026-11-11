const assert = require('node:assert/strict');
const sdk = require('../../airborne_server_clients/javascript/sdk/dist-cjs');
const stamp = '2026-11-10T12:34:56.123Z'; // chrono::Utc / utils::dt wire format
const client = body => new sdk.AirborneClient({endpoint:'http://localhost',maxAttempts:1,token:{token:'test'},requestHandler:{async handle(){return {response:{statusCode:200,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify(body))}}}}});
(async()=>{
 const response = {generated_at:stamp,organisations:[{name:'o',groups:[],ungrouped:[{application:'a',live:[{release_id:'1',package_version:1,config_version:'one',dimensions:{},concluded_at:stamp}],active:[{release_id:'2',package_version:2,status:'CREATED',traffic_percentage:0,experimental_variant:'exp',dimensions:{},created_at:stamp,created_by:'maker'}]}]}]};
 const overview = await client(response).send(new sdk.GetControlCenterOverviewCommand({}));
 assert.equal(overview.generated_at.toISOString(),stamp);
 assert.equal(overview.organisations[0].ungrouped[0].live[0].concluded_at.toISOString(),stamp);
 assert.equal(overview.organisations[0].ungrouped[0].active[0].created_at.toISOString(),stamp);
 const timeline = await client({events:[{action:'created',actor:'maker',created_at:stamp,payload:{},synthetic:true}]}).send(new sdk.GetControlCenterReleaseEventsCommand({organisation:'o',application:'a',release_id:'1'}));
 assert.equal(timeline.events[0].created_at.toISOString(),stamp);
 console.log('Control Center RFC3339 contracts: 4 timestamps PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
