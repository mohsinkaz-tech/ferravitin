import {test,expect} from 'bun:test';
import {createHash,randomUUID} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {makeSession,validSession,validPassword,sessionCookie,type AdminConfig} from '../src/lib/marketing-auth.server';
import {handleAdminSession,handleMarketingLeads} from '../src/lib/marketing-api.server';
import {validateLeadUpdate,leadIsDue,type CorporateLead} from '../src/lib/marketing';
const config:AdminConfig={username:'test-admin@example.com',passwordSha256:createHash('sha256').update('test-password').digest('hex'),sessionSecret:'test-session-secret-123456789012345678901234567890',dashboardBridgeSecret:'test-bridge-secret-123456789012345678901234567890'};
let ip=0;
function request(path:string,body?:unknown,extra:Record<string,string>={},method=body?'POST':'GET'){return new Request('https://www.biosciglobal.ca'+path,{method,headers:{Origin:'https://www.biosciglobal.ca','Content-Type':'application/json','x-forwarded-for':`198.51.100.${++ip}`,...extra},body:body?JSON.stringify(body):undefined});}
const cookie=()=>({'Cookie':'__Host-bsg_admin='+makeSession(config)});
test('password and session authentication rejects wrong passwords, tampering, expiry and key rotation',()=>{
  expect(validPassword(config.username,'test-password',config)).toBe(true);expect(validPassword(config.username,'wrong',config)).toBe(false);
  const token=makeSession(config,1000);expect(validSession(token,config,2000)).toBe(true);expect(validSession(token+'x',config,2000)).toBe(false);expect(validSession(token,config,1000+8*3600000)).toBe(false);expect(validSession(token,{...config,sessionSecret:'changed'},2000)).toBe(false);
  expect(sessionCookie(token)).toContain('HttpOnly; Secure; SameSite=Strict');expect(sessionCookie('')).toContain('Max-Age=0');
});
test('login sets a secure cookie, rejects foreign origins and logs out without returning credentials',async()=>{
  const good=await handleAdminSession(request('/api/marketing-session',{username:config.username,password:'test-password'}),async()=>config);expect(good.status).toBe(200);expect(good.headers.get('set-cookie')).toContain('__Host-bsg_admin=');expect(await good.json()).toEqual({ok:true,username:config.username});
  expect((await handleAdminSession(request('/api/marketing-session',{username:config.username,password:'bad'}),async()=>config)).status).toBe(401);
  expect((await handleAdminSession(request('/api/marketing-session',{}, {Origin:'https://evil.example'}),async()=>config)).status).toBe(403);
  const out=await handleAdminSession(request('/api/marketing-session',undefined,{},'DELETE'));expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
});
test('private reads never call the bridge without a valid session',async()=>{
  let calls=0;const deps={load:async()=>config,bridge:async()=>{calls++;return {ok:true,leads:[],total:0,nextCursor:null};}};
  const denied=await handleMarketingLeads(request('/api/marketing-leads'),deps);expect(denied.status).toBe(401);expect(calls).toBe(0);expect(denied.headers.get('cache-control')).toContain('no-store');
  expect((await handleMarketingLeads(request('/api/marketing-leads',undefined,cookie()),deps)).status).toBe(200);expect(calls).toBe(1);
});
test('authenticated diagnostics distinguish configuration, deployment and bridge errors without leaking credentials',async()=>{
  for(const code of ['CONTACT_CONFIG','CONFIG','GOOGLE_TIMEOUT','GOOGLE_HTTP','GOOGLE_DEPLOYMENT','GOOGLE_AUTH_OR_VERSION','SETUP_REQUIRED','BRIDGE']){
    const response=await handleMarketingLeads(request('/api/marketing-leads',undefined,cookie()),{load:async()=>config,bridge:async()=>{throw Error(code);}});
    expect(response.status).toBe(503);const data=await response.json();expect(data.code).toBe(code);expect(data.error).not.toContain(config.dashboardBridgeSecret);expect(data.error).not.toContain(config.sessionSecret);
  }
});
test('updates validate dates, field limits and origin and report edit conflicts',async()=>{
  const update={id:randomUUID(),version:'0',status:'Qualified',owner:'Admin',followUp:'2026-10-13',notes:'Call next week'};
  for(const change of [{followUp:'2026-02-30'},{status:'Bad'},{notes:'x'.repeat(2001)},{version:'invalid'}])expect(()=>validateLeadUpdate({...update,...change})).toThrow();
  const deps={load:async()=>config,bridge:async()=>{throw Error('CONFLICT');}};
  expect((await handleMarketingLeads(request('/api/marketing-leads',update,{...cookie(),Origin:'https://evil.example'}),deps)).status).toBe(403);
  expect((await handleMarketingLeads(request('/api/marketing-leads',update,cookie()),deps)).status).toBe(409);
  expect(leadIsDue({followUp:'2026-10-12',status:'New'} as CorporateLead,'2026-10-12')).toBe(true);expect(leadIsDue({followUp:'2026-10-12',status:'Won'} as CorporateLead,'2026-10-12')).toBe(false);
});
function sheetBridge(){
  const id=randomUUID(),rows:any[][]=[['Timestamp','Name','Organization','Email','Region','Interest','Message','Consent','Submission ID','Payload hash','Notification status','Notified at','Lead status','Assigned owner','Follow-up date','Private notes','Updated at','Version','Updated by'],[new Date(),'Test','Test org','test@example.com','BC','General corporate enquiry','Message','Yes',id,'hash','Sent',new Date(),'','','','','','','']];
  const sheet={getLastRow:()=>rows.length,getRange:(r:number,c:number,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>rows[r-1+i].slice(c-1,c-1+m)),setValues:(values:any[][])=>values.forEach((row,i)=>row.forEach((v,j)=>rows[r-1+i][c-1+j]=v))})};
  const context:any={PropertiesService:{getScriptProperties:()=>({getProperty:(k:string)=>k==='DASHBOARD_SHARED_SECRET'?config.dashboardBridgeSecret:'unused'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},Utilities:{getUuid:()=>randomUUID()},ContentService:{MimeType:{JSON:'json'},createTextOutput:(v:string)=>({setMimeType:()=>JSON.parse(v)})},Date,JSON};
  runInNewContext(readFileSync(new URL('../integrations/google/CorporateContact.gs',import.meta.url),'utf8'),context);
  return {id,rows,submit:(p:any)=>context.doPost({postData:{contents:JSON.stringify({type:'corporate-dashboard-v1',secret:config.dashboardBridgeSecret,...p})}}),context};
}
test('private Google bridge lists and updates original lead without changing intake columns',()=>{
  const b=sheetBridge(),original=b.rows[1].slice(0,12);const list=b.submit({action:'list',cursor:0});expect(list.ok).toBe(true);expect(list.leads[0].status).toBe('New');expect(list.leads[0].version).toBe('0');
  const update={action:'update',id:b.id,version:'0',status:'Contacted',owner:'Uzma',followUp:'2026-10-13',notes:'=HYPERLINK("bad")',actor:config.username};
  const saved=b.submit(update);expect(saved.ok).toBe(true);expect(saved.lead.status).toBe('Contacted');expect(saved.lead.notes).toBe(update.notes);expect(b.rows[1][15]).toStartWith("'");expect(b.rows[1].slice(0,12)).toEqual(original);expect(saved.lead.updatedBy).toBe(config.username);expect(b.submit(update).code).toBe('CONFLICT');
  expect(b.submit({action:'list',cursor:0,secret:'wrong'}).ok).toBe(false);expect(b.submit({action:'list',cursor:0,secret:'unused'}).ok).toBe(false);expect(b.context.doGet()).toEqual({ok:false});
});
