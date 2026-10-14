const SHAJARA_SHEET_ID = '1W7NmKlruQqEQJdIbckeBxoLPSeadwc799Ts0YoV2Zdk';
const INQUIRIES = ['Community collaboration','Institutional partnership','Media','General inquiry','Fundraiser support'];
function escapeHtml(value) {return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeCell(value) {const text=String(value||'');return /^[=+@-]/.test(text.trimStart()) ? "'"+text : text;}
function receipt(title,message) {return HtmlService.createHtmlOutput('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+' | Shajara Capital</title><body style="margin:0;background:#f7f8fa;font:16px/1.7 Arial;color:#041e4c"><main style="max-width:620px;margin:60px auto;padding:30px"><p style="font-size:13px;letter-spacing:2px;font-weight:bold">SHAJARA CAPITAL</p><h1>'+escapeHtml(title)+'</h1><p>'+escapeHtml(message)+'</p><a href="https://shajara.capital/" style="color:#1464c7">Return to Shajara Capital</a></main></body></html>');}
function doGet() {return receipt('Start a conversation','Please submit your inquiry using the form on the Shajara Capital website.');}
function doPost(e) {
  try {
    if(!e || !e.postData || e.postData.length>7000)return receipt('Please try again','The submission is too large or incomplete.');
    const p=e.parameter||{};
    const name=String(p.name||'').trim(), email=String(p.email||'').trim().toLowerCase(), organization=String(p.organization||'').trim(), message=String(p.message||'').trim(), inquiry=String(p.inquiry||'');
    if(p.website || !name || name.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || organization.length>150 || message.length>2000 || !INQUIRIES.includes(inquiry) || p.consent!=='yes' || !/^[a-f0-9-]{36}$/i.test(p.leadId||'') || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(name+email+organization+message))return receipt('Please check your details','Your inquiry was not registered. Return to the website, complete the required fields and give permission for us to reply.');
    const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return receipt('Please try again','The inquiry register is busy. Please submit again in a moment.');
    try {
      const sheet=SpreadsheetApp.openById(SHAJARA_SHEET_ID).getSheetByName('Leads');if(!sheet)throw Error('Missing leads tab');
      const last=sheet.getLastRow();
      if(last>1 && sheet.getRange(2,2,last-1,1).createTextFinder(p.leadId).matchEntireCell(true).findNext())return receipt('Thank you','Your inquiry has already been registered. We look forward to connecting with you.');
      const cache=CacheService.getScriptCache();const key='email-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,email)).slice(0,40);const count=Number(cache.get(key)||0);const total=Number(cache.get('hourly-intake')||0);if(count>=3 || total>=100)return receipt('Please try later','Please wait before submitting another inquiry.');
      sheet.appendRow([new Date().toISOString(),p.leadId,safeCell(name),safeCell(email),safeCell(organization),inquiry,safeCell(message),'Yes',p.updates==='yes'?'Yes':'No','shajara-capital-website','New']);cache.put(key,String(count+1),3600);cache.put('hourly-intake',String(total+1),3600);
      return receipt('Thank you for connecting','Your inquiry has been registered with Shajara Capital. We look forward to the conversation.');
    } finally {lock.releaseLock();}
  } catch(error) {return receipt('Registration is temporarily unavailable','Your inquiry could not be confirmed. Please return to the website and try again later.');}
}