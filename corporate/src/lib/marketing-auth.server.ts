import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
export type AdminConfig={username:string;passwordSha256:string;sessionSecret:string;dashboardBridgeSecret:string};
const client=new SecretsManagerClient({region:'ca-central-1',maxAttempts:2});
let cached:{value:AdminConfig;expires:number}|undefined;
export const adminHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'};
export const adminJson=(value:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{...adminHeaders,'Content-Type':'application/json',...extra}});
export async function adminConfig():Promise<AdminConfig>{
  if(cached&&cached.expires>Date.now())return cached.value;
  // Local test credentials may be supplied privately; never use a VITE_ variable.
  const raw=process.env.CORPORATE_ADMIN_CONFIG|| (await client.send(new GetSecretValueCommand({SecretId:'ferravitin/prod/corporate/marketing-admin'}),{abortSignal:AbortSignal.timeout(5000)})).SecretString;
  const value=JSON.parse(raw||'{}') as AdminConfig&{initialPassword?:string};
  if(!value.passwordSha256&&typeof value.initialPassword==='string'&&value.initialPassword.length>=32)value.passwordSha256=createHash('sha256').update(value.initialPassword).digest('hex');
  if(typeof value.username!=='string'||!value.username||value.username.length>120||! /^[a-f0-9]{64}$/.test(value.passwordSha256)||typeof value.sessionSecret!=='string'||value.sessionSecret.length<40||typeof value.dashboardBridgeSecret!=='string'||value.dashboardBridgeSecret.length<40)throw Error('Admin access unavailable');
  cached={value,expires:Date.now()+60000};return value;
}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function validPassword(username:string,password:string,config:AdminConfig){return equal(username,config.username)&&equal(createHash('sha256').update(password).digest('hex'),config.passwordSha256);}
const cookie='__Host-bsg_admin';
export function makeSession(config:AdminConfig,now=Date.now()){
  const body=Buffer.from(JSON.stringify({exp:now+8*3600000,nonce:randomUUID(),user:config.username})).toString('base64url');
  return body+'.'+createHmac('sha256',config.sessionSecret).update(body).digest('base64url');
}
export function validSession(token:string,config:AdminConfig,now=Date.now()){
  if(token.length>1024)return false;const parts=token.split('.');if(parts.length!==2||!equal(parts[1],createHmac('sha256',config.sessionSecret).update(parts[0]).digest('base64url')))return false;
  try{const p=JSON.parse(Buffer.from(parts[0],'base64url').toString());return p.user===config.username&&Number.isFinite(p.exp)&&p.exp>now&&p.exp<=now+8*3600000;}catch{return false;}
}
export function sessionToken(request:Request){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1)||'';}
export function sessionCookie(token:string){return `${cookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?28800:0}`;}
export async function authorizeAdmin(request:Request,load=adminConfig){
  const token=sessionToken(request);if(!token)return {denied:adminJson({error:'Please sign in.'},401)};
  try{const config=await load();if(!validSession(token,config))return {denied:adminJson({error:'Your session expired. Please sign in.'},401,{'Set-Cookie':sessionCookie('')})};return {config};}
  catch{return {denied:adminJson({error:'Admin access is not configured yet.'},503)};}
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin&&request.headers.get('sec-fetch-site')!=='cross-site';}
export async function adminBody(request:Request){
  if(!sameOrigin(request))throw Error('ORIGIN');if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw Error('INPUT');
  const reader=request.body?.getReader();if(!reader)throw Error('INPUT');let bytes=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>12000){await reader.cancel();throw Error('SIZE');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>;
}
