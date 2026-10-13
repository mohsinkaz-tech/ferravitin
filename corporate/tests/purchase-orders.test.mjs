import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {SimulationRepository,validateSnapshot,totalMinor,verifyShopifyHmac,adobeChallenge,purchaseOrdersUnavailable,sheetStatus,sheetCell} from '../src/lib/purchase-order.server.ts';
const now=1791900000000;
const sales={sub:'sales-1',role:'sales'},approver={sub:'approver-1',role:'approver'},integration={sub:'adapter',role:'integration'};
const snapshot=()=>({seller:'Bioclean Innovations Inc. dba BioScience Global',organizationId:'synthetic-org',signerSub:'synthetic-client',currency:'CAD',lines:[{sku:'TEST-ONLY',quantity:2,unitMinor:1234}],taxMinor:123,shippingMinor:1000,termsVersion:'simulation-v1',termsSha256:'a'.repeat(64),expiresAt:now+60000});
function setup(){const repo=new SimulationRepository();let order=repo.create('test-order',sales,snapshot(),now);const apply=(actor,command,key=command.kind)=>{const result=repo.apply(order.id,order.version,key,actor,command,now);if(result.order)order=result.order;return result;};return {repo,apply,get order(){return order;}};}
const approve=()=>({kind:'approve',legalTermsSha256:'a'.repeat(64),qualifiedOrganizationId:'synthetic-org',agreementId:'test-agreement'});
function signed(s){s.apply(approver,approve());s.apply(integration,{kind:'signature',evidence:{agreementId:'test-agreement',status:'SIGNED',digest:s.order.digest,signerSub:'synthetic-client',signedPdfSha256:'b'.repeat(64),auditPdfSha256:'c'.repeat(64)}});}
function checkout(s){signed(s);s.apply(integration,{kind:'checkout',processor:'shopify',checkoutId:'test-checkout',digest:s.order.digest,currency:'CAD',amountMinor:3591,test:true});}
test('integer money validates SKU, quantity, currency, overflow and expiry',()=>{
 assert.equal(totalMinor(snapshot()),3591);for(const change of [{currency:'EUR'},{taxMinor:-1},{expiresAt:now},{lines:[{sku:'',quantity:1,unitMinor:1}]},{lines:[{sku:'TEST',quantity:1.1,unitMinor:1}]},{lines:[{sku:'TEST',quantity:10000,unitMinor:100000000}]}])assert.throws(()=>validateSnapshot({...snapshot(),...change},now));
});
test('only assigned client can read; clones cannot mutate signed data',()=>{
 const s=setup();assert.throws(()=>s.repo.read(s.order.id,{sub:'outsider',role:'client',organizationId:'synthetic-org'}));const copy=s.repo.read(s.order.id,{sub:'synthetic-client',role:'client',organizationId:'synthetic-org'});copy.snapshot.lines[0].unitMinor=1;assert.equal(s.repo.read(s.order.id,sales).snapshot.lines[0].unitMinor,1234);
});
test('qualification, legal hash and separate approver are required',()=>{
 const s=setup();assert.throws(()=>s.apply({...approver,sub:sales.sub},approve()));assert.throws(()=>s.apply(approver,{...approve(),qualifiedOrganizationId:'other'}));assert.throws(()=>s.apply(approver,{...approve(),legalTermsSha256:'d'.repeat(64)}));s.apply(approver,approve());assert.throws(()=>s.apply(sales,{kind:'revise',snapshot:snapshot()}));
});
test('signature must bind agreement, signer, revision and archived evidence',()=>{
 const s=setup();s.apply(approver,approve());assert.throws(()=>s.apply(integration,{kind:'signature',evidence:{agreementId:'other',status:'SIGNED',digest:s.order.digest,signerSub:'synthetic-client',signedPdfSha256:'b'.repeat(64),auditPdfSha256:'c'.repeat(64)}}));
});
test('checkout forbidden before signing, live mode and changed total',()=>{
 const s=setup(),c={kind:'checkout',processor:'shopify',checkoutId:'test',digest:s.order.digest,currency:'CAD',amountMinor:3591,test:true};assert.throws(()=>s.apply(integration,c));signed(s);assert.throws(()=>s.apply(integration,{...c,test:false}));assert.throws(()=>s.apply(integration,{...c,amountMinor:3590}));
});
test('payment reconciliation checks processor, checkout, amount, currency and test status',()=>{
 const s=setup();checkout(s);const e={processor:'shopify',checkoutId:'test-checkout',paymentId:'test-payment',digest:s.order.digest,currency:'CAD',amountMinor:3591,paid:true,test:true};for(const change of [{processor:'stripe'},{checkoutId:'other'},{amountMinor:1},{currency:'USD'},{paid:false},{test:false},{digest:'bad'}])assert.throws(()=>s.apply(integration,{kind:'payment',evidence:{...e,...change}}));s.apply(integration,{kind:'payment',evidence:e});assert.equal(s.order.status,'paid');assert.equal(s.repo.inspect().outbox.filter(x=>x.kind==='receipt').length,1);
});
test('duplicates create no new audit or receipt; conflicting payload and stale versions fail',()=>{
 const s=setup();s.apply(approver,approve(),'event-1');const before=s.repo.inspect();assert.deepEqual(s.repo.apply(s.order.id,0,'event-1',approver,approve(),now),{duplicate:true});assert.deepEqual(s.repo.inspect(),before);assert.throws(()=>s.repo.apply(s.order.id,0,'event-1',approver,{kind:'cancel'},now));assert.throws(()=>s.repo.apply(s.order.id,0,'event-2',approver,{kind:'cancel'},now));
});
test('audit hash chain and Sheets projection exclude commercial details',()=>{
 const s=setup();signed(s);const audit=s.repo.inspect().audit;assert.equal(audit[1].previousHash,audit[0].hash);assert.deepEqual(Object.keys(sheetStatus(s.order)),['orderId','version','status']);assert.equal(sheetCell('=SUM(1,2)'),"'=SUM(1,2)");
});
test('Shopify raw-body HMAC rejects altered bodies and invalid headers',()=>{
 const raw=Buffer.from('{"id":"test"}'),secret='s'.repeat(32),signature=createHmac('sha256',secret).update(raw).digest('base64');assert.equal(verifyShopifyHmac(raw,signature,secret),true);assert.equal(verifyShopifyHmac(Buffer.from('{}'),signature,secret),false);assert.equal(verifyShopifyHmac(raw,'invalid',secret),false);
});
test('Adobe challenge echoes only configured client id; ordering stays disabled',async()=>{
 assert.equal(adobeChallenge(new Request('https://test'), 'app-id').status,403);const response=adobeChallenge(new Request('https://test',{headers:{'x-adobesign-clientid':'app-id'}}),'app-id');assert.equal(response.status,200);assert.equal((await response.json()).xAdobeSignClientId,'app-id');const closed=purchaseOrdersUnavailable();assert.equal(closed.status,503);assert.match(closed.headers.get('cache-control'),/no-store/);
});
