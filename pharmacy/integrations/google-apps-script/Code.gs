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
 'Daily bottles','Pregnancy bottles','Indicative CAD before tax',
 'Additional notes','Privacy consent','Nonbinding acknowledgement',
 'Purchase order template','Origin'
];
function doPost(e){
 try{
  if(!e||!e.postData||!e.postData.contents)throw new Error('Empty body');
  const p=JSON.parse(e.postData.contents);
  const props=PropertiesService.getScriptProperties();
  const expected=props.getProperty('SHARED_SECRET');
  const sheetId=props.getProperty('SHEET_ID');
  if(!expected||!sheetId||p.secret!==expected)throw new Error('Unauthorized');
  if(p.type!=='ferravitin_bc_pharmacy_order_request')throw new Error('Unknown lead type');
  if(!p.consent||!p.acknowledge)throw new Error('Missing consent');
  if(!p.pharmacy||!p.manager||!p.email||!p.phone||!p.city||!p.address)throw new Error('Required fields missing');
  if(!/^\S+@\S+\.\S+$/.test(String(p.email)))throw new Error('Invalid email');
  const dm=Number(p.dm),preg=Number(p.preg);
  if(!Number.isInteger(dm)||!Number.isInteger(preg)||dm<0||preg<0||dm+preg===0||dm>1000||preg>1000)throw new Error('Invalid quantities');
  const safe=(v)=>{const s=String(v??'').slice(0,1200);return /^[=+\-@]/.test(s)?("'"+s):s;};
  const doc=SpreadsheetApp.openById(sheetId);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
   let sh=doc.getSheetByName('Pharmacy Order Leads');
   if(!sh)sh=doc.insertSheet('Pharmacy Order Leads');
   if(sh.getLastRow()===0)sh.appendRow(HEADERS);
   const values=[p.receivedAt,p.reference,p.type,p.pharmacy,p.manager,p.email,p.phone,p.address,p.city,p.gst,dm,preg,Number((dm*50.99+preg*59.49).toFixed(2)),p.notes,'yes','yes',p.poTemplate,p.origin].map(safe);
   sh.appendRow(values);
   SpreadsheetApp.flush();
  }finally{lock.releaseLock();}
  const txt=[
    'New Ferravitin™ BC pharmacy order request',
    'Reference: '+p.reference,
    'Pharmacy: '+p.pharmacy,
    'Contact: '+p.manager,
    'Email: '+p.email,
    'Phone: '+p.phone,
    'Delivery: '+p.address+', '+p.city,
    'Daily Maintenance: '+dm+' bottles @ CAD $50.99',
    'Pregnancy Formula: '+preg+' bottles @ CAD $59.49',
    'Indicative total (before tax): CAD $'+(dm*50.99+preg*59.49).toFixed(2),
    'Notes: '+(p.notes||'—'),
    'Purchase order reference: BSG-PO-T001 v1.3',
    'Please send the current complete PO for signature. This online request is not a signed contract.'
  ].join('\n');
  MailApp.sendEmail({to:'nadeemzialeads@biosciglobal.net',subject:'Ferravitin™ pharmacy order request — '+p.reference,body:txt,name:'BioScience Global Pharmacy Leads'});
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
 }catch(err){
  console.error('Order webhook error: '+err);
  return ContentService.createTextOutput(JSON.stringify({ok:false})).setMimeType(ContentService.MimeType.JSON);
 }
}
