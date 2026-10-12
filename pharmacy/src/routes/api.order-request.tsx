import {runtimeSecret} from '../lib/lead-access.server';
import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/order-request')({server:{handlers:{POST:async({request})=>{
const reply=(obj:Record<string,unknown>,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
if(Number(request.headers.get('content-length')||0)>13000)return reply({error:'Request too large.'},413);
let d:Record<string,unknown>;
try{d=await request.json() as Record<string,unknown>}catch{return reply({error:'Invalid form data.'},400)}
const field=(k:string,max:number)=>typeof d[k]==='string'?(d[k] as string).trim().slice(0,max):'';
const pharmacy=field('pharmacy',150),manager=field('manager',120),email=field('email',160),phone=field('phone',35),address=field('address',180),city=field('city',90),gst=field('gst',80),notes=field('notes',1200);
const dm=Number(d.dm),preg=Number(d.preg);
if(field('website',120))return reply({error:'Invalid request.'},400);
if(!pharmacy||!manager||!/^\S+@\S+\.\S+$/.test(email)||!phone||!address||!city||d.consent!==true||d.acknowledge!==true)return reply({error:'Complete all required fields and consents.'},400);
if(!Number.isSafeInteger(dm)||!Number.isSafeInteger(preg)||dm<0||preg<0||dm>1000||preg>1000||(dm+preg===0))return reply({error:'Choose a valid quantity.'},400);
// The webhook address is public configuration; the shared secret is never bundled.
const url=process.env.GOOGLE_ORDER_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxV1jBTF1pyZiSz7MFflbMXs8681CvEYfuFcEo61_s517f4bHJ2e4Fe-o5q_YnvLirWHA/exec';
let secret: string | undefined;
try {
  secret = await runtimeSecret('ferravitin/prod/pharmacy/google-order-shared-secret');
} catch {
  return reply({error:'Secure order intake is temporarily unavailable. Please contact nadeem.zia@biosciglobal.net.'},503);
}
if(!url||!secret)return reply({error:'Secure order intake is not configured. Please contact nadeem.zia@biosciglobal.net.'},503);
const reference='FVP-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
const payload={type:'ferravitin_bc_pharmacy_order_request',secret,reference,pharmacy,manager,email,phone,address,city,gst,dm,preg,msrpReferenceCAD:Number((dm*59.99+preg*69.99).toFixed(2)),notes,consent:true,acknowledge:true,receivedAt:new Date().toISOString(),poTemplate:'Private purchase-order terms provided on request',origin:'ferravitin-bc-pharmacy-partner'};
try{
const target=new URL(url);
if(target.protocol!=='https:'||!['script.google.com','script.googleusercontent.com'].includes(target.hostname))throw Error('Invalid webhook');
const upstream=await fetch(url,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain; charset=utf-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
if(!upstream.ok)throw Error('Webhook HTTP error');
const body=await upstream.json() as {ok?:boolean,acknowledgement?:string};
if(!body.ok)throw Error('Sheet rejected request');
return reply({ok:true,reference,acknowledgement:body.acknowledgement==='sent'?'sent':'pending'});
}catch{return reply({error:'The order could not be delivered. Please email nadeem.zia@biosciglobal.net directly.'},502)}
}}}});
