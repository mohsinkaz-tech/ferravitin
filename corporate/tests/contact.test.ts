import {expect,test} from 'bun:test';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {handleContact} from '../src/lib/contact-handler.server';
import {validateContact} from '../src/lib/contact';
const lead=()=>({name:'Test Contact',organization:'Test Organization',email:'contact@example.com',region:'BC',interest:'General corporate enquiry',message:'Test only',consent:true,website:'',submissionId:randomUUID()});
let address=0;
function request(body:unknown,headers:Record<string,string>={}){return new Request('https://www.biosciglobal.ca/api/lead',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://www.biosciglobal.ca','x-forwarded-for':`192.0.2.${++address}`,...headers},body:JSON.stringify(body)});}
const config=async()=>({webhookUrl:'https://script.google.com/macros/s/test/exec',sharedSecret:'test-secret-only-12345678901234567890'});
test('strict validation rejects truthy consent, arrays, excessive fields, bot fields and invalid email',()=>{
  for(const change of [{consent:'yes'},{name:' '},{email:'a@@b.com'},{message:'x'.repeat(2001)},{website:'bot'},{interest:'Other'},{name:'a\u0000'}])expect(()=>validateContact({...lead(),...change})).toThrow();
  expect(()=>validateContact(null)).toThrow();expect(()=>validateContact([])).toThrow();
});
test('rejects foreign origin, content type and streamed oversized body before delivery',async()=>{
  expect((await handleContact(request(lead(),{Origin:'https://evil.example'}))).status).toBe(403);
  expect((await handleContact(request(lead(),{'Content-Type':'text/plain'}))).status).toBe(415);
  expect((await handleContact(request({message:'x'.repeat(13000)}))).status).toBe(413);
});
test('returns unavailable instead of fabricated success without configuration',async()=>{
  const response=await handleContact(request(lead()),{config:async()=>{throw Error('missing')},fetch:fetch});expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).toContain('info@biosciglobal.net');
});
test('only confirms matching saved receipt and surfaces pending notification',async()=>{
  for(const notification of ['sent','pending']){
    const value=lead();let delivered:any;
    const fake=async(_url:any,init:any)=>{delivered=JSON.parse(init.body);return Response.json({ok:true,saved:true,submissionId:value.submissionId,notification});};
    const response=await handleContact(request(value),{config,fetch:fake as typeof fetch});expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,submissionId:value.submissionId,notification});expect(delivered.type).toBe('corporate-contact-v1');expect(delivered.secret).toBe((await config()).sharedSecret);
  }
  for(const result of [{ok:true},{ok:false},{ok:true,saved:true,submissionId:'wrong',notification:'sent'}])expect((await handleContact(request(lead()),{config,fetch:(async()=>Response.json(result)) as typeof fetch})).status).toBe(502);
  expect((await handleContact(request(lead()),{config,fetch:(async()=>new Response('<html>signin</html>')) as typeof fetch})).status).toBe(502);
});
test('burst protection returns 429 and never delivers excess requests',async()=>{
  const headers={'x-forwarded-for':'192.0.2.250'};
  for(let i=0;i<10;i++)await handleContact(request(lead(),headers),{config:async()=>{throw Error('missing')},fetch});
  expect((await handleContact(request(lead(),headers))).status).toBe(429);
});
function bridge(){
  const rows:any[][]=[['Timestamp','Name','Organization','Email','Region','Interest','Message','Consent','Submission ID','Payload hash','Notification status','Notified at']];
  let mailFails=false;const emails:any[]=[];
  const sheet={getLastRow:()=>rows.length,appendRow:(r:any[])=>rows.push(r),getParent:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/test'}),getRange:(row:number,col:number,n=1,m=1)=>({getValues:()=>Array.from({length:n},(_,i)=>rows[row-1+i].slice(col-1,col-1+m)),getValue:()=>rows[row-1][col-1],setValues:(values:any[][])=>values.forEach((r,i)=>r.forEach((v,j)=>rows[row-1+i][col-1+j]=v))})};
  const context:any={PropertiesService:{getScriptProperties:()=>({getProperty:(key:string)=>key==='WEBHOOK_SHARED_SECRET'?'test-secret-only-12345678901234567890':'test'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},LockService:{getScriptLock:()=>({waitLock:()=>{},tryLock:()=>true,releaseLock:()=>{}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg:any,s:string)=>Array.from(createHash('sha256').update(s).digest())},MailApp:{sendEmail:(value:any)=>{if(mailFails)throw Error('quota');emails.push(value);}},ContentService:{MimeType:{JSON:'json'},createTextOutput:(value:string)=>({setMimeType:()=>JSON.parse(value)})},Date,JSON};
  runInNewContext(readFileSync(new URL('../integrations/google/CorporateContact.gs',import.meta.url),'utf8'),context);
  const submit=(value:any)=>context.doPost({postData:{contents:JSON.stringify({type:'corporate-contact-v1',secret:'test-secret-only-12345678901234567890',...value})}});
  return {rows,emails,submit,context,failMail:(fail:boolean)=>{mailFails=fail}};
}
test('bridge writes one lead per retry, escapes spreadsheet formulas and sends to requested mailbox',()=>{
  const b=bridge(),value={...lead(),name:'=IMPORTXML("bad")'};
  expect(b.submit(value)).toMatchObject({ok:true,saved:true,notification:'sent'});expect(b.submit(value).ok).toBe(true);
  expect(b.rows).toHaveLength(2);expect(b.rows[1][1]).toStartWith("'");expect(b.emails).toHaveLength(1);expect(b.emails[0].to).toBe('info@biosciglobal.net');expect(b.emails[0].body).not.toContain(value.email);
  expect(b.submit({...value,message:'different'}).code).toBe('CONFLICT');expect(b.context.doGet()).toEqual({ok:false});
});
test('mail failure retains row and retry trigger sends notification without another lead',()=>{
  const b=bridge(),value=lead();b.failMail(true);expect(b.submit(value)).toMatchObject({ok:true,saved:true,notification:'pending'});expect(b.rows[1][10]).toBe('Pending');
  b.failMail(false);b.context.retryContactNotifications();expect(b.rows[1][10]).toBe('Sent');expect(b.emails).toHaveLength(1);expect(b.submit(value).notification).toBe('sent');expect(b.rows).toHaveLength(2);
});
test('bridge validates independently and rate limits new leads without blocking retry receipts',()=>{
  const b=bridge();expect(b.submit({...lead(),secret:'wrong'}).ok).toBe(false);for(let i=0;i<5;i++)expect(b.submit(lead()).ok).toBe(true);
  expect(b.submit(lead()).code).toBe('RATE_LIMIT');expect(b.submit({...lead(),consent:'yes'}).ok).toBe(false);
  expect(b.submit({...lead(),secret:'wrong'}).ok).toBe(false);
});
