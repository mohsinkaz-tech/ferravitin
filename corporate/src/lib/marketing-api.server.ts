import {createHash} from 'node:crypto';
import {adminBody,adminConfig,adminJson,authorizeAdmin,makeSession,sameOrigin,sessionCookie,validPassword,type AdminConfig} from './marketing-auth.server';
import {contactConfig} from './contact-config.server';
import {validateLeadUpdate} from './marketing';
const attempts=new Map<string,{count:number;expires:number}>();
export async function handleAdminSession(request:Request,load=adminConfig){
  if(request.method==='GET'){const access=await authorizeAdmin(request,load);return access.denied||adminJson({ok:true,username:access.config!.username});}
  if(!sameOrigin(request))return adminJson({error:'Please use the dashboard sign-in page.'},403);
  if(request.method==='DELETE')return adminJson({ok:true},200,{'Set-Cookie':sessionCookie('')});
  const now=Date.now();for(const [key,bucket] of attempts)if(bucket.expires<=now)attempts.delete(key);
  const key=createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').digest('hex');const bucket=attempts.get(key)||{count:0,expires:now+15*60000};
  if(++bucket.count>5||attempts.size>=5000)return adminJson({error:'Too many sign-in attempts. Wait 15 minutes and try again.'},429);attempts.set(key,bucket);
  let data;try{data=await adminBody(request);}catch{return adminJson({error:'Invalid sign-in request.'},400);}
  if(typeof data.username!=='string'||typeof data.password!=='string'||data.username.length>120||data.password.length>256)return adminJson({error:'Enter a valid username and password.'},400);
  try{const config=await load();if(!validPassword(data.username,data.password,config))return adminJson({error:'The username or password is incorrect.'},401);
    attempts.delete(key);return adminJson({ok:true,username:config.username},200,{'Set-Cookie':sessionCookie(makeSession(config))});
  }catch{return adminJson({error:'Admin access is not configured yet.'},503);}
}
export async function marketingBridge(action:string,fields:Record<string,unknown>,config:AdminConfig){
  let contact;try{contact=await contactConfig();}catch{throw Error('CONTACT_CONFIG');}
  let url;try{url=new URL(contact.webhookUrl);}catch{throw Error('CONFIG');}
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.username||url.password)throw Error('CONFIG');
  let response;try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...fields,type:'corporate-dashboard-v1',action,secret:config.dashboardBridgeSecret,actor:config.username}),signal:AbortSignal.timeout(20000)});}catch{throw Error('GOOGLE_TIMEOUT');}
  if(!response.ok)throw Error('GOOGLE_HTTP');
  let result;try{result=await response.json();}catch{throw Error('GOOGLE_DEPLOYMENT');}
  if(!result.ok){if(result.code==='CONFLICT')throw Error('CONFLICT');if(result.code==='SETUP_REQUIRED')throw Error('SETUP_REQUIRED');throw Error('GOOGLE_AUTH_OR_VERSION');}return result;
}
export const marketingConnectionErrors:Record<string,string>={
  CONTACT_CONFIG:'The corporate contact configuration is incomplete or unreadable. Check webhookUrl and sharedSecret in the AWS corporate contact secret.',
  CONFIG:'The configured Google URL is invalid. Use the deployed script.google.com Web app URL ending in /exec, without query parameters.',
  GOOGLE_TIMEOUT:'Google did not respond in time. Retry, then check Apps Script Executions for failures.',
  GOOGLE_HTTP:'Google rejected the web-app request. Check that the deployment executes as Me and allows Anyone.',
  GOOGLE_DEPLOYMENT:'Google returned a sign-in or HTML page instead of the bridge response. Check the /exec URL and web-app access settings.',
  GOOGLE_AUTH_OR_VERSION:'Google did not accept the dashboard request. Check DASHBOARD_SHARED_SECRET matches the AWS dashboardBridgeSecret, and deploy the latest CorporateContact.gs version.',
  SETUP_REQUIRED:'The deployed Google script could not find the dashboard columns. Run setupCorporateContact in the corporate Sheet project, then deploy the latest version.',
  BRIDGE:'Google returned an unexpected lead response. Verify webhookUrl points to the corporate deployment and deploy the latest CorporateContact.gs version.'
};
export async function handleMarketingLeads(request:Request,dependencies={load:adminConfig,bridge:marketingBridge}){
  const access=await authorizeAdmin(request,dependencies.load);if(access.denied)return access.denied;
  try{
    if(request.method==='GET'){
      const cursor=new URL(request.url).searchParams.get('cursor')||'0';if(!/^\d{1,7}$/.test(cursor))return adminJson({error:'Invalid page.'},400);
      const result=await dependencies.bridge('list',{cursor:Number(cursor)},access.config!);
      if(!Array.isArray(result.leads)||!Number.isInteger(result.total))throw Error('BRIDGE');return adminJson(result);
    }
    let data;try{data=await adminBody(request);}catch(error){return adminJson({error:'Invalid update request.'},(error as Error).message==='ORIGIN'?403:400);}
    let update;try{update=validateLeadUpdate(data);}catch{return adminJson({error:'Check the status, date, owner and note length.'},400);}
    return adminJson(await dependencies.bridge('update',update,access.config!));
  }catch(error){const code=(error as Error).message;return adminJson({error:code==='CONFLICT'?'This lead changed since you opened it. Refresh and review before saving again.':marketingConnectionErrors[code]||'The corporate lead connection is unavailable. Check Google activation and dashboard configuration.',code:code in marketingConnectionErrors?code:code==='CONFLICT'?'CONFLICT':'UNAVAILABLE'},code==='CONFLICT'?409:503);}
}
