const campaignUrl='https://www.biosciglobal.ca/shaukat-khanum.html';
const invite=`I’m inviting 10 partners to join me in supporting Shaukat Khanum, with an intended pledge of CAD $500–$1,000 each. Register interest here: ${campaignUrl}\nRegistration is non-binding and is not a donation. Actual donations are made separately through CERF’s donation page. This is an independent community invitation. — Mohsin Kazi`;
document.querySelector('#share-whatsapp').href='https://wa.me/?text='+encodeURIComponent(invite);
document.querySelector('#share-sms').href='sms:'+( /iPad|iPhone|iPod/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent(invite);
document.querySelector('#share-email').href='mailto:?subject='+encodeURIComponent('Join me: 10 Partners for Hope')+'&body='+encodeURIComponent(invite);
document.querySelector('#copy-invite').addEventListener('click',async()=>{
  const status=document.querySelector('#share-status');
  try{await navigator.clipboard.writeText(invite);status.textContent='Invitation copied. Paste it into your message.';}
  catch{const field=document.querySelector('#invite-copy');field.hidden=false;field.value=invite;field.focus();field.select();status.textContent='Select and copy the invitation below.';}
});
const form=document.querySelector('#interest-form'),status=document.querySelector('#form-status');
let submissionId=null,busy=false;
form.addEventListener('input',()=>{if(!busy){submissionId=null;status.hidden=true;}});
form.elements.channel.addEventListener('change',()=>{
  form.elements.phone.required=form.elements.channel.value!=='Email';
  document.querySelector('#phone-requirement').textContent=form.elements.phone.required?'*':'(optional)';
});
form.addEventListener('submit',async(event)=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));
  const show=(state,title,message)=>{status.replaceChildren();status.hidden=false;status.dataset.state=state;status.setAttribute('role',state==='error'?'alert':'status');const heading=document.createElement('h3');heading.textContent=title;const p=document.createElement('p');p.textContent=message;status.append(heading,p);status.focus();};
  if(!['500','750','1000','conversation'].includes(values.amount)||!['Email','WhatsApp','SMS','Phone call'].includes(values.channel)||!values.name.trim()||values.website||form.elements.consent.checked!==true){show('error','Please check your details.','Enter your name, choose a pledge amount, and accept the contact consent.');return;}
  if(values.channel!=='Email'&&!values.phone.trim()){show('error','Please add your phone number.','A phone number is needed for your selected contact method.');form.elements.phone.focus();return;}
  submissionId ||= crypto.randomUUID();
  const source=new URLSearchParams(location.search).get('source')||'direct';
  const payload={submissionId,name:values.name.trim(),organization:values.organization.trim()||'Individual campaign partner',email:values.email.trim(),region:'Canada — campaign enquiry',interest:'General corporate enquiry',website:values.website,consent:true,message:`CAMPAIGN: 10 Partners for Hope / Shaukat Khanum\nRegistration: non-binding interest, not a donation.\nIntended pledge: ${values.amount==='conversation'?'Discuss first':'CAD '+values.amount}\nPreferred contact: ${values.channel}\nPhone: ${values.phone.trim()||'Not supplied'}\nSource: ${source.slice(0,80)}\nNote: ${values.note.trim()}`};
  const button=form.querySelector('button[type=submit]');busy=true;button.disabled=true;button.textContent='Saving your interest…';form.setAttribute('aria-busy','true');
  // Freeze the same payload until delivery is confirmed; retries keep its reference.
  for(const el of form.elements)el.disabled=true;
  try{
    const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
    const result=await response.json();
    if(!response.ok||result.ok!==true||result.submissionId!==submissionId||!['sent','pending'].includes(result.notification))throw Error(typeof result.error==='string'&&result.error.length<350?result.error:'Delivery was not confirmed. Please retry once with the same details, or email Mohsin.');
    show('success','Your interest is registered.',result.notification==='pending'?'Your details are saved. The team notification is queued; Mohsin can follow up using your preferred method.':'Your details are saved and the BioScience Global team has been notified. Mohsin can follow up using your preferred method.');
    const reference=document.createElement('p');reference.className='reference';reference.textContent='Registration reference: '+submissionId;status.append(reference);
    const disclaimer=document.createElement('p');disclaimer.textContent='No payment has been made. This is a non-binding interest registration, not a confirmed sponsorship or donation.';status.append(disclaimer);
    const donate=document.createElement('a');donate.href='https://cerfcanada.com/donate/';donate.target='_blank';donate.rel='noopener noreferrer';donate.textContent='Make a separate donation through CERF ↗';status.append(donate);
    form.hidden=true;form.reset();submissionId=null;
  }catch(error){show('error','Registration not confirmed.',error instanceof Error&&error.name!=='TimeoutError'?error.message:'The request timed out. Your details remain here. Retry once or email Mohsin.');const fallback=document.createElement('a');fallback.href='mailto:mohsin.kazi@biosciglobal.net?subject='+encodeURIComponent('10 Partners for Hope — interest registration')+'&body='+encodeURIComponent(payload.message+'\nName: '+payload.name+'\nEmail: '+payload.email+'\nReference: '+submissionId);fallback.textContent='Email your interest to Mohsin';status.append(fallback);}
  finally{busy=false;for(const el of form.elements)el.disabled=false;button.textContent='Register my interest ↗';form.setAttribute('aria-busy','false');}
});
