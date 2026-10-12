/** Dedicated corporate-only bridge. Install in a NEW bound Apps Script project.
 * Do not replace the pharmacy or existing Articles script. No public lead reads.
 */
const CONTACT_HEADERS=['Timestamp','Name','Organization','Email','Region','Interest','Message','Consent','Submission ID','Payload hash','Notification status','Notified at'];
const CONTACT_INTERESTS=['Pharmacy partnership','Practitioner enquiry','Retail and distribution','Research collaboration','General corporate enquiry'];
const MARKETING_HEADERS=['Lead status','Assigned owner','Follow-up date','Private notes','Updated at','Version','Updated by'];
function setupCorporateContact(){
  const properties=PropertiesService.getScriptProperties();
  if(!properties.getProperty('SPREADSHEET_ID'))properties.setProperty('SPREADSHEET_ID',SpreadsheetApp.getActive().getId());
  const sheet=contactSheet_();
  if(sheet.getLastRow()===0)sheet.appendRow(CONTACT_HEADERS);
  assertContactHeaders_(sheet);
  const existing=sheet.getRange(1,13,1,7).getValues()[0];
  if(existing.some(v=>v!==''&&v!==null)&&JSON.stringify(existing)!==JSON.stringify(MARKETING_HEADERS))throw Error('Unexpected dashboard columns');
  sheet.getRange(1,13,1,7).setValues([MARKETING_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,CONTACT_HEADERS.length+MARKETING_HEADERS.length).setFontWeight('bold').setBackground('#eeeeee');
  // Authorizes email without sending a message.
  MailApp.getRemainingDailyQuota();
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='retryContactNotifications'))ScriptApp.newTrigger('retryContactNotifications').timeBased().everyMinutes(5).create();
}
function contactSheet_(){
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)throw Error('Missing sheet configuration');
  const ss=SpreadsheetApp.openById(id);
  return ss.getSheetByName('Corporate Leads')||ss.insertSheet('Corporate Leads');
}
function assertContactHeaders_(sheet){
  if(JSON.stringify(sheet.getRange(1,1,1,CONTACT_HEADERS.length).getValues()[0])!==JSON.stringify(CONTACT_HEADERS))throw Error('Unexpected corporate sheet layout');
}
function validateCorporateLead_(p){
  if(!p||Array.isArray(p)||p.type!=='corporate-contact-v1'||p.consent!==true||typeof p.submissionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.submissionId))throw Error('Invalid lead');
  const limits={name:120,organization:160,email:160,region:120,interest:100,message:2000,website:150},lead={};
  Object.keys(limits).forEach(k=>{
    if(typeof p[k]!=='string'||p[k].length>limits[k]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(p[k]))throw Error('Invalid field');
    lead[k]=p[k].trim();
  });
  if(!lead.name||!lead.organization||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)||lead.website||!CONTACT_INTERESTS.includes(lead.interest))throw Error('Invalid field');
  return lead;
}
function sheetText_(value){return /^[\s]*[=+@\-]/.test(String(value))?"'"+String(value):String(value);}
function contactHash_(lead){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(lead)).map(n=>('0'+((n+256)%256).toString(16)).slice(-2)).join('');}
function doPost(e){
  let lock;
  try{
    if(!e||!e.postData||e.postData.contents.length>16000)return contactOutput_({ok:false});
    const p=JSON.parse(e.postData.contents),expected=PropertiesService.getScriptProperties().getProperty('WEBHOOK_SHARED_SECRET');
    if(p&&p.type==='corporate-dashboard-v1')return corporateDashboard_(p);
    if(!expected||expected.length<32||p.secret!==expected)return contactOutput_({ok:false});
    const lead=validateCorporateLead_(p),hash=contactHash_(lead);
    lock=LockService.getScriptLock();lock.waitLock(5000);
    const sheet=contactSheet_();assertContactHeaders_(sheet);
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,12).getValues():[];
    let row=rows.findIndex(r=>r[8]===p.submissionId)+2;
    if(row>=2){if(rows[row-2][9]!==hash)return contactOutput_({ok:false,code:'CONFLICT'});}
    else{
      const now=Date.now();
      const recent=rows.filter(r=>now-new Date(r[0]).getTime()<86400000);
      if(recent.length>=100||recent.filter(r=>String(r[3]).toLowerCase()===sheetText_(lead.email).toLowerCase()&&now-new Date(r[0]).getTime()<3600000).length>=5)return contactOutput_({ok:false,code:'RATE_LIMIT'});
      sheet.appendRow([new Date(),lead.name,lead.organization,lead.email,lead.region,lead.interest,lead.message,'Yes',p.submissionId,hash,'Pending',''].map((v,i)=>i===0?v:sheetText_(v)));
      SpreadsheetApp.flush();row=sheet.getLastRow();
    }
    const sent=notifyCorporateRow_(sheet,row);
    return contactOutput_({ok:true,saved:true,submissionId:p.submissionId,notification:sent?'sent':'pending'});
  }catch(error){return contactOutput_({ok:false});}
  finally{if(lock)lock.releaseLock();}
}
function notifyCorporateRow_(sheet,row){
  if(sheet.getRange(row,11).getValue()==='Sent')return true;
  try{
    const id=sheet.getRange(row,9).getValue();
    // Keep contact data in the restricted Sheet, rather than duplicating it in email.
    MailApp.sendEmail({to:'info@biosciglobal.net',subject:'New BioScience Global corporate enquiry',body:'A corporate website enquiry has been recorded.\nReference: '+id+'\nReview the restricted Corporate Leads tab: '+sheet.getParent().getUrl()+'\nDo not forward lead information outside authorized staff.'});
    sheet.getRange(row,11,1,2).setValues([['Sent',new Date()]]);SpreadsheetApp.flush();return true;
  }catch(error){return false;}
}
function retryContactNotifications(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
  try{
    const sheet=contactSheet_();assertContactHeaders_(sheet);
    if(sheet.getLastRow()<2)return;
    const states=sheet.getRange(2,11,sheet.getLastRow()-1,1).getValues();let count=0;
    for(let i=0;i<states.length&&count<20;i++)if(states[i][0]==='Pending'){count++;notifyCorporateRow_(sheet,i+2);}
  }finally{lock.releaseLock();}
}
function doGet(){return contactOutput_({ok:false});}
function contactOutput_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function corporateDashboard_(p){
  const expected=PropertiesService.getScriptProperties().getProperty('DASHBOARD_SHARED_SECRET');
  if(!expected||expected.length<40||p.secret!==expected)return contactOutput_({ok:false});
  const lock=LockService.getScriptLock();let locked=false;
  try{
    lock.waitLock(5000);locked=true;
    const sheet=contactSheet_();assertContactHeaders_(sheet);
    if(JSON.stringify(sheet.getRange(1,13,1,7).getValues()[0])!==JSON.stringify(MARKETING_HEADERS))return contactOutput_({ok:false,code:'SETUP_REQUIRED'});
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,19).getValues():[];
    if(p.action==='list'){
      if(!Number.isInteger(p.cursor)||p.cursor<0)return contactOutput_({ok:false});
      const end=p.cursor===0?rows.length:Math.min(p.cursor,rows.length),start=Math.max(0,end-100);
      return contactOutput_({ok:true,leads:rows.slice(start,end).reverse().map(marketingLead_),total:rows.length,nextCursor:start>0?start:null});
    }
    const statuses=['New','Contacted','Qualified','Proposal sent','Won','Closed'];
    if(p.action!=='update'||typeof p.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)||typeof p.version!=='string'||! /^(0|[0-9a-f-]{36})$/i.test(p.version)||!statuses.includes(p.status)||typeof p.actor!=='string'||!p.actor||p.actor.length>120)return contactOutput_({ok:false});
    for(const [k,max] of [['owner',120],['notes',2000],['followUp',10]])if(typeof p[k]!=='string'||p[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(p[k]))return contactOutput_({ok:false});
    if(p.followUp!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(p.followUp)||isNaN(new Date(p.followUp+'T00:00:00Z').getTime())||new Date(p.followUp+'T00:00:00Z').toISOString().slice(0,10)!==p.followUp))return contactOutput_({ok:false});
    const index=rows.findIndex(r=>r[8]===p.id);if(index<0||String(rows[index][17]||'0')!==p.version)return contactOutput_({ok:false,code:'CONFLICT'});
    const values=[p.status,p.owner.trim(),p.followUp,p.notes.trim(),new Date(),Utilities.getUuid(),p.actor].map(v=>v instanceof Date?v:sheetText_(v));
    sheet.getRange(index+2,13,1,7).setValues([values]);SpreadsheetApp.flush();
    return contactOutput_({ok:true,lead:marketingLead_(rows[index].slice(0,12).concat(values))});
  }catch{return contactOutput_({ok:false});}finally{if(locked)lock.releaseLock();}
}
function marketingLead_(r){
  const text=v=>String(v||'').replace(/^'(?=[\s]*[=+@\-])/,'');
  const iso=v=>v instanceof Date&&!isNaN(v.getTime())?v.toISOString():'';
  return {id:text(r[8]),receivedAt:iso(r[0]),name:text(r[1]),organization:text(r[2]),email:text(r[3]),region:text(r[4]),interest:text(r[5]),message:text(r[6]),notification:text(r[10]),status:text(r[12])||'New',owner:text(r[13]),followUp:r[14] instanceof Date?Utilities.formatDate(r[14],'America/Vancouver','yyyy-MM-dd'):text(r[14]),notes:text(r[15]),updatedAt:iso(r[16]),version:text(r[17])||'0',updatedBy:text(r[18])};
}
