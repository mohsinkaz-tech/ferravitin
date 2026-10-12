import {SecretsManagerClient, GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import {createHash, timingSafeEqual} from 'node:crypto';
const client = new SecretsManagerClient({region:'ca-central-1',maxAttempts:2});
const cache = new Map<string,{value:string,expires:number}>();
export async function runtimeSecret(name:string) {
 const hit=cache.get(name); if(hit && hit.expires>Date.now())return hit.value;
 const result=await client.send(new GetSecretValueCommand({SecretId:name}),{abortSignal:AbortSignal.timeout(8000)});
 if(!result.SecretString)throw Error('Configuration unavailable');
 cache.set(name,{value:result.SecretString,expires:Date.now()+60000});return result.SecretString;
}
export const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Vary':'Authorization','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
export async function authorizeLeadAccess(request:Request):Promise<Response|null>{
 if(new URL(request.url).protocol!=='https:' && process.env.NODE_ENV==='production')return new Response('HTTPS required',{status:403,headers:privateHeaders});
 const raw=request.headers.get('authorization')||'';
 if(!raw.startsWith('Basic ')||raw.length>1024)return denied();
 try{
 const config=JSON.parse(await runtimeSecret('ferravitin/prod/pharmacy/dashboard-auth')) as {username:string,passwordSha256:string,bridgeSecret:string};
 if(!config.username || !/^[a-f0-9]{64}$/.test(config.passwordSha256)||!config.bridgeSecret||config.bridgeSecret.length<40)throw Error('Invalid configuration');
 const supplied=Buffer.from(raw.slice(6),'base64').toString('utf8');const i=supplied.indexOf(':');
 const digest=createHash('sha256').update(supplied.slice(i+1)).digest();
 if(i<1 || supplied.slice(0,i)!==config.username || !timingSafeEqual(digest,Buffer.from(config.passwordSha256,'hex')))return denied();
 return null;
 }catch{return new Response('Internal access temporarily unavailable',{status:503,headers:privateHeaders});}
}
function denied(){return new Response('Authorized internal access required',{status:401,headers:{...privateHeaders,'WWW-Authenticate':'Basic realm="Ferravitin internal", charset="UTF-8"'}});}
export async function sheetBridge(action:string,fields:Record<string,unknown>={}){
 const config=JSON.parse(await runtimeSecret('ferravitin/prod/pharmacy/dashboard-auth')) as {bridgeSecret:string};
 const url=process.env.GOOGLE_ORDER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxV1jBTF1pyZiSz7MFflbMXs8681CvEYfuFcEo61_s517f4bHJ2e4Fe-o5q_YnvLirWHA/exec';
 const target=new URL(url);if(target.protocol!=='https:'||target.hostname!=='script.google.com')throw Error('Invalid configuration');
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...fields,action,secret:config.bridgeSecret}),signal:AbortSignal.timeout(25000)});
 const result=await response.json();if(!response.ok||!result.ok)throw Error('Lead service unavailable');return result;
}
