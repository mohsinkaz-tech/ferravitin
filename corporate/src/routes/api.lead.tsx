import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/lead')({server:{handlers:{POST:async({request})=>{
const json=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
if(Number(request.headers.get('content-length')||0)>10000)return json({error:'Request too large'},413);
let d:Record<string,unknown>;try{d=await request.json() as Record<string,unknown>}catch{return json({error:'Invalid data'},400)}
const str=(k:string,max:number)=>typeof d[k]==='string'?(d[k] as string).trim().slice(0,max):'';
const name=str('name',120),organization=str('organization',160),email=str('email',160),region=str('region',120),interest=str('interest',100),message=str('message',2000);
if(!name||!organization||!/^\S+@\S+\.\S+$/.test(email)||!d.consent||str('website',150))return json({error:'Please complete required fields'},400);
if(!['Pharmacy partnership','Practitioner enquiry','Retail and distribution','Research collaboration','General corporate enquiry'].includes(interest))return json({error:'Invalid category'},400);
const webhook=process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const key=process.env.GOOGLE_SHEETS_SHARED_SECRET;
if(!webhook||!key)return json({error:'Enquiry delivery is not yet configured. Please email mohsin.kazi@biosciglobal.net.'},503);
try{
const url=new URL(webhook);if(url.protocol!=='https:'||!['script.google.com','script.googleusercontent.com'].includes(url.hostname))throw new Error('Invalid webhook destination');
const response=await fetch(webhook,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'lead',secret:key,name,organization,email,region,interest,message,consent:true,receivedAt:new Date().toISOString()})});
if(!response.ok)throw new Error('Upstream failed');
const payload=await response.json() as {ok?:boolean};if(!payload.ok)throw new Error('Lead not accepted');
return json({ok:true});
}catch{return json({error:'Delivery unavailable. Email mohsin.kazi@biosciglobal.net directly.'},502)}
}}}});
