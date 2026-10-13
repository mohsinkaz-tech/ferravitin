import {useRef,useState} from 'react';
import {contactInterests,validateContact,type ContactDetails} from '@/lib/contact';
const empty:ContactDetails={name:'',organization:'',email:'',region:'',interest:'Pharmacy partnership',message:'',consent:false,website:''};
export function ContactForm(){
  const [details,setDetails]=useState(empty),[busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState<{error?:string;receipt?:string;pending?:boolean}>({});
  const id=useRef<string|null>(null),sending=useRef(false),status=useRef<HTMLDivElement>(null);
  function change(key:keyof ContactDetails,value:string|boolean){id.current=null;setDetails(previous=>({...previous,[key]:value}));setFeedback({});}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(sending.current)return;id.current ||= crypto.randomUUID();const payload={...details,submissionId:id.current};
    try{validateContact(payload);}catch(error){setFeedback({error:(error as Error).message});setTimeout(()=>status.current?.focus(),0);return;}
    sending.current=true;setBusy(true);setFeedback({});
    let errorMessage='We could not confirm delivery. Your details are still here. Retry once, or email info@biosciglobal.net.';
    try{
      const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
      const result=await response.json();
      if(!response.ok||result.ok!==true||result.submissionId!==id.current){if(typeof result.error==='string'&&result.error.length<=300)errorMessage=result.error;throw Error('Delivery not confirmed');}
      setFeedback({receipt:result.submissionId,pending:result.notification==='pending'});setDetails(empty);id.current=null;
    }catch{setFeedback({error:errorMessage});}
    finally{sending.current=false;setBusy(false);setTimeout(()=>status.current?.focus(),0);}
  }
  return <form className="contact-form" onSubmit={submit} aria-busy={busy}>
    <div><label htmlFor="bname">Full name *</label><input id="bname" autoComplete="name" value={details.name} onChange={e=>change('name',e.target.value)} required maxLength={120} disabled={busy}/></div>
    <div><label htmlFor="bcompany">Organization *</label><input id="bcompany" autoComplete="organization" value={details.organization} onChange={e=>change('organization',e.target.value)} required maxLength={160} disabled={busy}/></div>
    <div><label htmlFor="bemail">Business email *</label><input id="bemail" type="email" autoComplete="email" value={details.email} onChange={e=>change('email',e.target.value)} required maxLength={160} disabled={busy}/></div>
    <div><label htmlFor="bregion">Province, state or country</label><input id="bregion" value={details.region} onChange={e=>change('region',e.target.value)} maxLength={120} disabled={busy}/></div>
    <div><label htmlFor="binterest">Enquiry category *</label><select id="binterest" value={details.interest} onChange={e=>change('interest',e.target.value)} disabled={busy}>{contactInterests.map(value=><option key={value}>{value}</option>)}</select></div>
    <div className="hidden-trap" aria-hidden="true"><label htmlFor="bwebsite">Website</label><input id="bwebsite" tabIndex={-1} autoComplete="off" value={details.website} onChange={e=>change('website',e.target.value)} maxLength={150}/></div>
    <div className="wide"><label htmlFor="bmessage">Your message</label><textarea id="bmessage" value={details.message} onChange={e=>change('message',e.target.value)} rows={5} maxLength={2000} disabled={busy} placeholder="Please don't include personal medical information."/></div>
    <div className="wide check-row"><input type="checkbox" id="bconsent" checked={details.consent} onChange={e=>change('consent',e.target.checked)} required disabled={busy}/><label htmlFor="bconsent">I consent to BioScience Global processing these details to answer my enquiry. See our <a href="/privacy" style={{textDecoration:'underline'}}>privacy notice</a>.</label></div>
    <p className="wide small-note">This is a nonbinding expression of interest. Submitting it does not create a purchase order, contract or payment obligation. Commercial terms are shared privately with qualified partners.</p>
    <div className="wide"><button className="bsg-button" type="submit" disabled={busy}>{busy?'Sending…':'Send business enquiry ↗'}</button><div ref={status} tabIndex={-1} role={feedback.error?'alert':'status'} aria-live="polite" className={feedback.error?'contact-feedback error':feedback.receipt?'contact-feedback success':'small-note'}>
      {feedback.receipt&&<><h3>Thank you. Your enquiry has been received.</h3><p>{feedback.pending?'Your enquiry is safely recorded. The team notification is queued for delivery.':'Our team has been notified and will follow up by email.'}</p><p className="small-note">Reference: {feedback.receipt}</p></>}
      {feedback.error&&<><h3>Enquiry not confirmed</h3><p>{feedback.error}</p><a href="mailto:info@biosciglobal.net">Email info@biosciglobal.net</a></>}
    </div></div>
  </form>;
}
