export const leadStatuses=['New','Contacted','Qualified','Proposal sent','Won','Closed'] as const;
export type CorporateLead={id:string;receivedAt:string;name:string;organization:string;email:string;region:string;interest:string;message:string;notification:string;status:string;owner:string;followUp:string;notes:string;version:string;updatedAt:string;updatedBy:string};
export function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function validateLeadUpdate(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid update');const p=value as Record<string,unknown>;
  if(typeof p.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)||typeof p.version!=='string'||! /^(0|[0-9a-f-]{36})$/i.test(p.version)||!leadStatuses.includes(p.status as typeof leadStatuses[number]))throw Error('Invalid update');
  for(const [k,max] of [['owner',120],['notes',2000],['followUp',10]] as const)if(typeof p[k]!=='string'||p[k].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(p[k]))throw Error('Invalid update');
  if(p.followUp!==''&&!validDate(p.followUp as string))throw Error('Invalid follow-up date');
  return {id:p.id,version:p.version,status:p.status as string,owner:(p.owner as string).trim(),notes:(p.notes as string).trim(),followUp:p.followUp as string};
}
export function vancouverToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function leadIsDue(lead:CorporateLead,today=vancouverToday()){return Boolean(lead.followUp&&lead.followUp<=today&&!['Won','Closed'].includes(lead.status));}
