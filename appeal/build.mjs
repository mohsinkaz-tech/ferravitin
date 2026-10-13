import {cp,mkdir,readFile,rm} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
for(const required of ['بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ','Sahih Muslim 2588','CERF authorization pending','interest-form','share-whatsapp','share-sms','share-email'])if(!html.includes(required))throw Error('Missing campaign requirement: '+required);
const config=JSON.parse(await readFile('config.json','utf8'));if(!/^https:\/\/[a-z0-9]+\.execute-api\.ca-central-1\.amazonaws\.com\/register$/.test(config.registrationEndpoint))throw Error('Registration endpoint is not configured');
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','styles.css','campaign.js','config.json','assets'])await cp(file,'dist/'+file,{recursive:true});
console.log('Campaign build passed: required content, registration configuration and assets packaged.');

