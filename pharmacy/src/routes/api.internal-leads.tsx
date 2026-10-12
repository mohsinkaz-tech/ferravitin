import {createFileRoute} from '@tanstack/react-router';
import {authorizeLeadAccess,privateHeaders,sheetBridge} from '../lib/lead-access.server';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...privateHeaders,'Content-Type':'application/json'}});
export const Route=createFileRoute('/api/internal-leads')({server:{handlers:{
 GET:async({request})=>{const denied=await authorizeLeadAccess(request);if(denied)return denied;try{return json(await sheetBridge('listLeads'));}catch{return json({error:'Lead service unavailable. Check configuration.'},503);}},
 POST:async({request})=>{const denied=await authorizeLeadAccess(request);if(denied)return denied;
 if(request.headers.get('origin')!==new URL(request.url).origin || request.headers.get('content-type')!=='application/json')return json({error:'Invalid origin'},403);
 const text=await request.text();if(text.length>5000)return json({error:'Request too large'},413);
 try{const p=JSON.parse(text);if(typeof p.reference!=='string'||!/^FVP-\d{8}-[A-F0-9]{8}$/.test(p.reference)||!['New','Contacted','Terms sent','PO received','Won','Closed'].includes(p.status)||typeof p.notes!=='string'||p.notes.length>2000||typeof p.followUp!=='string'||(p.followUp!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(p.followUp))||typeof p.version!=='string')return json({error:'Invalid update'},400);
 return json(await sheetBridge('updateLead',{reference:p.reference,status:p.status,followUp:p.followUp,notes:p.notes,version:p.version}));}catch{return json({error:'Update failed or changed by another editor. Refresh before trying again.'},409);}}
}}});
