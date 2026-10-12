import {createHash} from 'node:crypto';
import {validateContact} from './contact';
import {contactConfig} from './contact-config.server';
const attempts=new Map<string,{count:number;expires:number}>();
const origins=new Set(['https://www.biosciglobal.ca','https://biosciglobal.ca','https://www.biosciglobal.net','https://biosciglobal.net','https://amplify-production.d3l733upn467ky.amplifyapp.com']);
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleContact(request:Request,dependencies={config:contactConfig,fetch:globalThis.fetch}):Promise<Response>{
  const origin=request.headers.get('origin');
  const local=process.env.NODE_ENV!=='production'&&origin===new URL(request.url).origin&&['localhost','127.0.0.1'].includes(new URL(request.url).hostname);
  if(!origin||(!origins.has(origin)&&!local)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Please submit from our contact page.'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return json({error:'Please submit a valid enquiry.'},415);
  // Burst limits per compute instance. Apps Script also applies durable shared limits.
  const now=Date.now();for(const [key,value] of attempts)if(value.expires<=now)attempts.delete(key);
  const address=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const key=createHash('sha256').update(address).digest('hex');
  const bucket=attempts.get(key)||{count:0,expires:now+60000};
  if(++bucket.count>10||attempts.size>=5000)return json({error:'Too many attempts. Wait a minute and try again.'},429);
  attempts.set(key,bucket);
  let input:unknown;
  try{
    if(Number(request.headers.get('content-length'))>12000)return json({error:'Enquiry too large.'},413);
    const reader=request.body?.getReader();if(!reader)return json({error:'Invalid enquiry.'},400);
    let size=0;const chunks:Uint8Array[]=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();return json({error:'Enquiry too large.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch{return json({error:'Invalid enquiry data.'},400);}
  let lead;try{lead=validateContact(input);}catch(error){return json({error:(error as Error).message},400);}
  let config;
  try{
    config=await dependencies.config();const url=new URL(config.webhookUrl);
    if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash||url.username||url.password||config.sharedSecret.length<32)throw Error('Invalid config');
  }catch{return json({error:'Online enquiries are temporarily unavailable. Please email info@biosciglobal.net.'},503);}
  try{
    const response=await dependencies.fetch(config.webhookUrl,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...lead,type:'corporate-contact-v1',secret:config.sharedSecret}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Upstream unavailable');
    const result=await response.json() as {ok?:boolean;saved?:boolean;submissionId?:string;notification?:string;code?:string};
    if(result.code==='RATE_LIMIT')return json({error:'Too many enquiries. Try later or email info@biosciglobal.net.'},429);
    if(result.ok!==true||result.saved!==true||result.submissionId!==lead.submissionId||!['sent','pending'].includes(result.notification||''))throw Error('Unconfirmed delivery');
    return json({ok:true,submissionId:lead.submissionId,notification:result.notification});
  }catch{return json({error:'We could not confirm delivery. Your details are still here. Retry once, or email info@biosciglobal.net.'},502);}
}
