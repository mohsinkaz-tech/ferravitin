/**
 * BioScience Global Google Sheets bridge.
 * In Apps Script: Project Settings -> Script Properties -> WEBHOOK_SHARED_SECRET,
 * NOTIFY_EMAIL (mohsin.kazi@biosciglobal.net).
 * Deploy as Web app, execute as owner, access Anyone.
 * The endpoint secret is checked on every lead submission; do not expose it to browser code.
 * Add appropriate anti-abuse/rate-limiting and privacy policy before public launch.
 * New sheet must have tabs "Leads" and "Articles". Column headers are created by setupSheets().
 */
function setupSheets() {
  const ss=SpreadsheetApp.getActive();
  [['Leads',['Timestamp','Name','Organization','Email','Region','Interest','Message','Consent']],
   ['Articles',['id','title','summary','url','date','status','scientificApproved','regulatoryApproved']]].forEach(([tab,headers])=>{
      let sheet=ss.getSheetByName(tab)||ss.insertSheet(tab);
      if(sheet.getLastRow()===0)sheet.appendRow(headers);
   });
}
function doPost(e) {
  try {
    const p=JSON.parse(e.postData.contents);
    const properties=PropertiesService.getScriptProperties();
    const expected=properties.getProperty('WEBHOOK_SHARED_SECRET');
    if(!expected||p.secret!==expected||p.type!=='lead')return output({ok:false});
    if(!p.consent||!p.email||!p.organization||!p.name)return output({ok:false});
    const s=SpreadsheetApp.getActive().getSheetByName('Leads');
    if(!s)return output({ok:false});
    const safe=x=> {let t=String(x||'').slice(0,2000);return /^[=+@\-]/.test(t)?"'"+t:t;};
    const row=[new Date(),p.name,p.organization,p.email,p.region,p.interest,p.message,'Yes'].map(safe);
    const lock=LockService.getScriptLock();lock.waitLock(15000);
    try{s.appendRow(row);}finally{lock.releaseLock();}
    const notify=properties.getProperty('NOTIFY_EMAIL')||'mohsin.kazi@biosciglobal.net';
    MailApp.sendEmail({to:notify,subject:'New Ferravitin B2B enquiry — '+safe(p.interest),body:'An enquiry was received. Review the restricted Google Sheet.\nFrom: '+safe(p.name)+'\nOrganization: '+safe(p.organization)+'\nEmail: '+safe(p.email)+'\nCategory: '+safe(p.interest)});
    return output({ok:true});
  }catch(err){return output({ok:false});}
}
function doGet(){
  // Deliberately public: read ONLY explicitly approved and published entries.
  const s=SpreadsheetApp.getActive().getSheetByName('Articles');
  if(!s||s.getLastRow()<2)return output({articles:[]});
  const values=s.getDataRange().getValues();
  const keys=values.shift().map(String);
  const rows=values.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])))
    .filter(a=>a.status==='Published'&&a.scientificApproved===true&&a.regulatoryApproved===true)
    .map(a=>({id:String(a.id),title:String(a.title),summary:String(a.summary),url:String(a.url),date:String(a.date),status:'Published',scientificApproved:true,regulatoryApproved:true}));
  return output({articles:rows});
}
function output(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
