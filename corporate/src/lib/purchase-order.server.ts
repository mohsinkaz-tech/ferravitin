import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

// Server-only domain foundation. No HTTP handler trusts caller-supplied identities.
// Provider evidence is constructed by trusted adapters after authenticated API reads.
export type Actor = {sub:string; role:'sales'|'approver'|'finance'|'client'|'integration'; organizationId?:string};
export type Line = {sku:string; quantity:number; unitMinor:number};
export type Snapshot = {seller:string; organizationId:string; signerSub:string; currency:'CAD'|'USD'; lines:Line[]; taxMinor:number; shippingMinor:number; termsVersion:string; termsSha256:string; expiresAt:number};
export type Order = {id:string; version:number; status:'draft'|'review'|'signed'|'awaiting_payment'|'paid'|'cancelled'; snapshot:Snapshot; digest:string; createdBy:string; approvedBy?:string; agreementId?:string; checkoutId?:string; processor?:'shopify'|'stripe'; signature?:{signedPdfSha256:string; auditPdfSha256:string}; paymentId?:string};
export type Audit = {orderId:string; version:number; action:string; actorSub:string; at:number; previousHash:string; hash:string};
export type Effect = {id:string; orderId:string; version:number; kind:'sheet_status'|'staff_notification'|'receipt'; state:'pending'};
export class WorkflowError extends Error {}
const fail=(code:string):never=>{throw new WorkflowError(code);};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f]/.test(value);
const money=(value:number)=>Number.isSafeInteger(value)&&value>=0&&value<=100_000_000;
export function totalMinor(snapshot:Snapshot){
  const total=snapshot.lines.reduce((sum,line)=>sum+line.quantity*line.unitMinor,0)+snapshot.taxMinor+snapshot.shippingMinor;
  if(!Number.isSafeInteger(total)||total<=0||total>100_000_000)fail('INVALID_TOTAL');return total;
}
export function validateSnapshot(input:Snapshot,now=Date.now()):Snapshot {
  if(!input||input.seller!=='Bioclean Innovations Inc. dba BioScience Global'||!['CAD','USD'].includes(input.currency)||![input.organizationId,input.signerSub,input.termsVersion].every(text)||!/^\w[\w.-]*$/.test(input.termsVersion)||!/^[a-f0-9]{64}$/.test(input.termsSha256)||!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=now||input.expiresAt>now+90*86400000)fail('INVALID_SNAPSHOT');
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>100||!money(input.taxMinor)||!money(input.shippingMinor))fail('INVALID_AMOUNT');
  const skus=new Set<string>();for(const line of input.lines){if(!text(line.sku)||!/^[A-Za-z0-9._-]+$/.test(line.sku)||skus.has(line.sku)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000||!money(line.unitMinor)||line.unitMinor===0)fail('INVALID_LINE');skus.add(line.sku);}
  // Whitelist and normalize fields before hashing. Extra caller properties never enter a signed revision.
  const snapshot:Snapshot={seller:input.seller,organizationId:input.organizationId,signerSub:input.signerSub,currency:input.currency,lines:input.lines.map(({sku,quantity,unitMinor})=>({sku,quantity,unitMinor})),taxMinor:input.taxMinor,shippingMinor:input.shippingMinor,termsVersion:input.termsVersion,termsSha256:input.termsSha256,expiresAt:input.expiresAt};totalMinor(snapshot);return snapshot;
}
export function mayRead(actor:Actor,order:Order){return ['sales','approver','finance'].includes(actor.role)||(actor.role==='client'&&actor.organizationId===order.snapshot.organizationId&&actor.sub===order.snapshot.signerSub);}
export function sheetStatus(order:Order){return {orderId:order.id,version:order.version,status:order.status};}
export function sheetCell(value:string){return /^[=+@\-\t\r\n]/.test(value)?"'"+value:value;}

export type Command =
 | {kind:'revise'; snapshot:Snapshot}
 | {kind:'approve'; legalTermsSha256:string; qualifiedOrganizationId:string; agreementId:string}
 | {kind:'signature'; evidence:{agreementId:string; status:'SIGNED'; digest:string; signerSub:string; signedPdfSha256:string; auditPdfSha256:string}}
 | {kind:'checkout'; processor:'shopify'|'stripe'; checkoutId:string; digest:string; currency:string; amountMinor:number; test:true}
 | {kind:'payment'; evidence:{processor:'shopify'|'stripe'; checkoutId:string; paymentId:string; digest:string; currency:string; amountMinor:number; paid:boolean; test:boolean}}
 | {kind:'cancel'};
export function transition(current:Order,actor:Actor,command:Command,now=Date.now()):Order {
  const order=structuredClone(current);
  if(!text(actor.sub))fail('UNAUTHENTICATED');
  if(command.kind==='revise'){
    if(actor.role!=='sales'||order.status!=='draft')fail('FORBIDDEN');order.snapshot=validateSnapshot(command.snapshot,now);order.digest=hash(order.snapshot);
  }else if(command.kind==='approve'){
    if(actor.role!=='approver'||actor.sub===order.createdBy||order.status!=='draft')fail('FORBIDDEN');
    if(order.snapshot.expiresAt<=now||command.legalTermsSha256!==order.snapshot.termsSha256||command.qualifiedOrganizationId!==order.snapshot.organizationId||!text(command.agreementId))fail('APPROVAL_GATE');
    order.status='review';order.approvedBy=actor.sub;order.agreementId=command.agreementId;
  }else if(command.kind==='signature'){
    const e=command.evidence;if(actor.role!=='integration'||order.status!=='review'||order.snapshot.expiresAt<=now)fail('SIGNATURE_GATE');
    if(e.status!=='SIGNED'||e.agreementId!==order.agreementId||e.digest!==order.digest||e.signerSub!==order.snapshot.signerSub||![e.signedPdfSha256,e.auditPdfSha256].every(s=>/^[a-f0-9]{64}$/.test(s)))fail('SIGNATURE_MISMATCH');
    order.status='signed';order.signature={signedPdfSha256:e.signedPdfSha256,auditPdfSha256:e.auditPdfSha256};
  }else if(command.kind==='checkout'){
    if(actor.role!=='integration'||order.status!=='signed'||order.snapshot.expiresAt<=now||command.test!==true||!['shopify','stripe'].includes(command.processor)||!text(command.checkoutId)||command.digest!==order.digest||command.currency!==order.snapshot.currency||command.amountMinor!==totalMinor(order.snapshot))fail('CHECKOUT_GATE');
    order.status='awaiting_payment';order.checkoutId=command.checkoutId;order.processor=command.processor;
  }else if(command.kind==='payment'){
    const e=command.evidence;if(actor.role!=='integration'||order.status!=='awaiting_payment'||e.test!==true||!e.paid||!text(e.paymentId)||e.processor!==order.processor||e.checkoutId!==order.checkoutId||e.digest!==order.digest||e.currency!==order.snapshot.currency||e.amountMinor!==totalMinor(order.snapshot))fail('PAYMENT_MISMATCH');
    // Reconcile late successful payment even after quote expiry; never lose a received payment.
    order.status='paid';order.paymentId=e.paymentId;
  }else if(command.kind==='cancel'){
    if(actor.role!=='approver'||!['draft','review','signed'].includes(order.status))fail('CANCEL_GATE');order.status='cancelled';
  }else fail('UNKNOWN_COMMAND');
  order.version++;return order;
}

// Test-only atomic repository. Production must use DynamoDB TransactWriteItems:
// version condition + inbox key + order + audit + outbox in the same transaction.
// Never instantiate this repository in an Amplify HTTP request.
export class SimulationRepository {
  #orders=new Map<string,Order>(); #inbox=new Map<string,string>(); #audit:Audit[]=[]; #outbox:Effect[]=[];
  create(id:string,actor:Actor,input:Snapshot,now=Date.now()){
    if(actor.role!=='sales'||!text(actor.sub)||!text(id)||this.#orders.has(id))fail('CREATE_GATE');const snapshot=validateSnapshot(input,now);
    const order:Order={id,version:0,status:'draft',snapshot,digest:hash(snapshot),createdBy:actor.sub};this.#orders.set(id,order);this.#record(order,actor,'create',now);return structuredClone(order);
  }
  read(id:string,actor:Actor){const order=this.#orders.get(id);if(!order||!mayRead(actor,order))fail('NOT_FOUND');return structuredClone(order);}
  apply(id:string,version:number,eventKey:string,actor:Actor,command:Command,now=Date.now()){
    if(!text(eventKey))fail('INVALID_EVENT');const key=id+':'+actor.sub+':'+eventKey,fingerprint=hash(command);
    if(this.#inbox.has(key)){if(this.#inbox.get(key)!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return {duplicate:true};}
    const current=this.#orders.get(id);if(!current||current.version!==version)throw new WorkflowError('VERSION_CONFLICT');
    const next=transition(current,actor,command,now);this.#orders.set(id,next);this.#inbox.set(key,fingerprint);this.#record(next,actor,command.kind,now);return {duplicate:false,order:structuredClone(next)};
  }
  #record(order:Order,actor:Actor,action:string,at:number){
    const previousHash=this.#audit.filter(e=>e.orderId===order.id).at(-1)?.hash||'0'.repeat(64);
    const event={orderId:order.id,version:order.version,action,actorSub:actor.sub,at,previousHash};this.#audit.push({...event,hash:hash(event)});
    for(const kind of ['sheet_status','staff_notification',...(order.status==='paid'?['receipt']:[])] as Effect['kind'][]){this.#outbox.push({id:`${order.id}:${order.version}:${kind}`,orderId:order.id,version:order.version,kind,state:'pending'});}
  }
  inspect(){return structuredClone({audit:this.#audit,outbox:this.#outbox});}
}
export function verifyShopifyHmac(raw:Uint8Array,header:string|null,secret:string){
  if(secret.length<32||!header||!/^[A-Za-z0-9+/]{43}=$/.test(header))return false;
  const supplied=Buffer.from(header,'base64'),expected=createHmac('sha256',secret).update(raw).digest();return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
export function adobeChallenge(request:Request,expectedClientId:string){
  // Adobe's client ID echo is an intent challenge, NOT proof that an event is authentic.
  // POST events must trigger an OAuth-authenticated agreement/documents/audit API read.
  const id=request.headers.get('x-adobesign-clientid');if(!expectedClientId||id!==expectedClientId)return new Response(null,{status:403});
  return Response.json({xAdobeSignClientId:id},{headers:{'Cache-Control':'no-store','X-AdobeSign-ClientId':id}});
}
export function purchaseOrdersUnavailable(){return Response.json({code:'PURCHASE_ORDERS_NOT_ACTIVATED',message:'Private ordering is awaiting secure account, legal and provider activation. Public enquiries are nonbinding.'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});}
