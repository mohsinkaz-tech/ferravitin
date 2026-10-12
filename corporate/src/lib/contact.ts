export const contactInterests=['Pharmacy partnership','Practitioner enquiry','Retail and distribution','Research collaboration','General corporate enquiry'] as const;
export const contactLimits={name:120,organization:160,email:160,region:120,interest:100,message:2000,website:150} as const;
export type ContactDetails=Record<keyof typeof contactLimits,string>&{consent:boolean};
export type ContactLead=ContactDetails&{submissionId:string};
export function validateContact(value:unknown):ContactLead {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid enquiry.');
  const data=value as Record<string,unknown>,lead={} as ContactLead;
  for(const [key,max] of Object.entries(contactLimits)){
    const field=data[key];
    if(typeof field!=='string'||field.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(field))throw Error('Please check field lengths and remove unsupported characters.');
    lead[key as keyof typeof contactLimits]=field.trim();
  }
  if(!lead.name||!lead.organization||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))throw Error('Please enter your name, organization and a valid business email.');
  if(data.consent!==true)throw Error('Please consent to processing your enquiry.');
  if(lead.website||!contactInterests.includes(lead.interest as typeof contactInterests[number]))throw Error('Please check your enquiry category.');
  if(typeof data.submissionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId))throw Error('Please refresh the page and try again.');
  return {...lead,consent:true,submissionId:data.submissionId};
}
