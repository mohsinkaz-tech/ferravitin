/*
Ferravitin™ BC pharmacy order intake
Deploy as Google Apps Script Web App: Execute as me; Access: Anyone.
REQUIRED Script Properties (Project Settings): SHEET_ID, SHARED_SECRET.
Set SHEET_ID to the ID of a Google Sheet controlled by BioScience Global.
Set SHARED_SECRET to a long random secret, and use same value as website secret GOOGLE_ORDER_SHARED_SECRET.
Do NOT put secrets in the web page, client JavaScript, or repository.
*/
const HEADERS = [
 'Received at (UTC)','Reference','Lead type','Pharmacy','Contact',
 'Email','Phone','Delivery address','BC city','GST or licence',
 'Daily bottles','Pregnancy bottles','MSRP reference CAD before tax',
 'Additional notes','Privacy consent','Nonbinding acknowledgement',
 'Purchase order template','Origin'
];
const EXTRA_HEADERS=['Pipeline status','Follow-up date','Private follow-up notes','Updated at','Acknowledgement email','Internal notification'];
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function safe_(value){const s=String(value??'').slice(0,2000);return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
function sheet_(props){const doc=SpreadsheetApp.openById(props.getProperty('SHEET_ID'));let sh=doc.getSheetByName('Pharmacy Order Leads');if(!sh)sh=doc.insertSheet('Pharmacy Order Leads');if(!sh.getLastRow())sh.appendRow(HEADERS);const existing=sh.getRange(1,19,1,EXTRA_HEADERS.length).getDisplayValues()[0];if(existing.some((v,i)=>v && v!==EXTRA_HEADERS[i]))throw Error('Pipeline columns conflict');sh.getRange(1,19,1,EXTRA_HEADERS.length).setValues([EXTRA_HEADERS]);return sh;}
function doPost(e){
 try{
 if(!e?.postData?.contents || e.postData.contents.length>16000)return output_({ok:false});
 const p=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties();
 const internal=['listLeads','updateLead'].includes(p.action);
 const expected=props.getProperty(internal?'DASHBOARD_SHARED_SECRET':'SHARED_SECRET');
 if(!expected||!props.getProperty('SHEET_ID')||p.secret!==expected)return output_({ok:false});
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const sh=sheet_(props);
 if(internal)return internal_(sh,p);
 if(p.type!=='ferravitin_bc_pharmacy_order_request'||p.consent!==true||p.acknowledge!==true||!/^FVP-\d{8}-[A-F0-9]{8}$/.test(p.reference))return output_({ok:false});
 if(!['pharmacy','manager','email','phone','city','address'].every(k=>typeof p[k]==='string'&&p[k].trim()))return output_({ok:false});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)||p.email.length>160)return output_({ok:false});
 const dm=Number(p.dm),preg=Number(p.preg);if(!Number.isInteger(dm)||!Number.isInteger(preg)||dm<0||preg<0||dm+preg===0||dm>1000||preg>1000)return output_({ok:false});
 let row=0;if(sh.getLastRow()>1){const refs=sh.getRange(2,2,sh.getLastRow()-1,1).getValues();row=refs.findIndex(r=>r[0]===p.reference)+2;if(row===1)row=0;}
 if(!row){sh.appendRow([p.receivedAt,p.reference,p.type,p.pharmacy,p.manager,p.email,p.phone,p.address,p.city,p.gst,dm,preg,(dm*59.99+preg*69.99).toFixed(2),p.notes,'yes','yes',p.poTemplate,p.origin,'New','','',new Date().toISOString()+' / '+Utilities.getUuid(),'pending','pending'].map(safe_));row=sh.getLastRow();SpreadsheetApp.flush();}
 sendPending_(sh,row,props);
 return output_({ok:true,acknowledgement:sh.getRange(row,23).getValue()==='sent'?'sent':'pending'});
 }finally{lock.releaseLock();}
 }catch(_){console.error('Intake operation failed');return output_({ok:false});}
}
function internal_(sh,p){
 if(p.action==='listLeads'){
 const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,24).getDisplayValues():[];
 return output_({ok:true,leads:rows.map(r=>({reference:r[1],pharmacy:r[3],contact:r[4],email:r[5],phone:r[6],city:r[8],dm:r[10],preg:r[11],status:r[18]||'New',followUp:r[19],notes:r[20],version:r[21],acknowledgement:r[22]}))});
 }
 if(!['New','Contacted','Terms sent','PO received','Won','Closed'].includes(p.status)||typeof p.notes!=='string'||p.notes.length>2000||typeof p.followUp!=='string'||(p.followUp&&!/^\d{4}-\d{2}-\d{2}$/.test(p.followUp)))return output_({ok:false});
 if(sh.getLastRow()<2)return output_({ok:false});
 const refs=sh.getRange(2,2,sh.getLastRow()-1,1).getValues();const row=refs.findIndex(r=>r[0]===p.reference)+2;if(row<2)return output_({ok:false});
 if(sh.getRange(row,22).getDisplayValue()!==p.version)return output_({ok:false});
 sh.getRange(row,19,1,4).setValues([[p.status,safe_(p.followUp),safe_(p.notes),new Date().toISOString()+' / '+Utilities.getUuid()]]);SpreadsheetApp.flush();return output_({ok:true});
}
function sendPending_(sh,row,props){
 const r=sh.getRange(row,1,1,24).getDisplayValues()[0];
 if(r[22]!=='sent'){
 try{MailApp.sendEmail({to:r[5],replyTo:'nadeem.zia@biosciglobal.net',name:'BioScience Global',subject:'Ferravitin pre-order interest received — '+r[1],body:[
 'Thank you for registering your Ferravitin BC pharmacy pre-order interest.',
 'Reference: '+r[1], 'Pharmacy: '+r[3],
 'Proposed Daily Maintenance bottles: '+r[10], 'Proposed Pregnancy Formula bottles: '+r[11],
 'This acknowledges receipt of nonbinding interest only. It is not an accepted purchase order, invoice, reservation, payment request or guarantee of delivery.',
 'Public MSRP is a retail reference only. Negotiated pharmacy pricing, payment and delivery terms will be discussed privately and require a separate agreement.',
 'Nadeem Zia will follow up. Contact nadeem.zia@biosciglobal.net and quote your reference.'
 ].join('\n\n')});sh.getRange(row,23).setValue('sent');}catch(_){sh.getRange(row,23).setValue('pending');}
 }
 if(r[23]!=='sent'){
 try{MailApp.sendEmail({to:props.getProperty('NOTIFICATION_EMAIL')||'bcpharmacyorders@biosciglobal.net',name:'BioScience Global Pharmacy Leads',subject:'New Ferravitin pharmacy interest — '+r[1],body:['Reference: '+r[1],'Pharmacy: '+r[3],'Contact: '+r[4],'Email: '+r[5],'Phone: '+r[6],'City: '+r[8],'Daily bottles: '+r[10],'Pregnancy bottles: '+r[11],'Nonbinding interest. Review the authenticated internal dashboard; discuss commercial terms privately.'].join('\n')});sh.getRange(row,24).setValue('sent');}catch(_){sh.getRange(row,24).setValue('pending');}
 }
 SpreadsheetApp.flush();
}
// Install one time-based trigger (every 10 minutes) for this function.
// At-least-once mail: a crash after send but before marking can duplicate mail.
function retryPendingEmails(){const props=PropertiesService.getScriptProperties();const lock=LockService.getScriptLock();lock.waitLock(20000);try{const sh=sheet_(props);let attempts=0;for(let row=2;row<=sh.getLastRow()&&attempts<20;row++){const states=sh.getRange(row,23,1,2).getValues()[0];if(states.includes('pending')){sendPending_(sh,row,props);attempts++;}}}finally{lock.releaseLock();}}
