import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
const client=new SecretsManagerClient({region:'ca-central-1',maxAttempts:2});
type Config={webhookUrl:string;sharedSecret:string};
let cached:{value:Config;expires:number}|undefined;
export async function contactConfig():Promise<Config>{
  // The isolated purchase-order preview must never contact the production Sheet/email bridge.
  if(process.env.PURCHASE_ORDER_MODE==='simulation')throw Error('Contact delivery disabled in purchase-order simulation');
  if(process.env.GOOGLE_SHEETS_WEBHOOK_URL&&process.env.GOOGLE_SHEETS_SHARED_SECRET)return {webhookUrl:process.env.GOOGLE_SHEETS_WEBHOOK_URL,sharedSecret:process.env.GOOGLE_SHEETS_SHARED_SECRET};
  if(cached&&cached.expires>Date.now())return cached.value;
  const response=await client.send(new GetSecretValueCommand({SecretId:'ferravitin/prod/corporate/contact'}),{abortSignal:AbortSignal.timeout(5000)});
  const value=JSON.parse(response.SecretString||'{}') as Config;
  if(!value.webhookUrl||typeof value.sharedSecret!=='string'||value.sharedSecret.length<32)throw Error('Configuration unavailable');
  cached={value,expires:Date.now()+60000};return value;
}
