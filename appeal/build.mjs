import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
const html=await readFile('founding.html','utf8');
for(const required of ['بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ','Sahih Muslim 2588','CERF authorization pending','interest-form','share-whatsapp','share-sms','share-email'])if(!html.includes(required))throw Error('Missing campaign requirement: '+required);
const config=JSON.parse(await readFile('config.json','utf8'));if(!/^https:\/\/[a-z0-9]+\.execute-api\.ca-central-1\.amazonaws\.com\/register$/.test(config.registrationEndpoint))throw Error('Registration endpoint is not configured');
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','founding.html','styles.css','campaign.js','config.json','assets','share.html','share.css','share.js'])await cp(file,'dist/'+file,{recursive:true});
await rm('.amplify-hosting',{recursive:true,force:true});await mkdir('.amplify-hosting/static',{recursive:true});await cp('dist','.amplify-hosting/static',{recursive:true});
await writeFile('.amplify-hosting/deploy-manifest.json',JSON.stringify({version:1,routes:[{path:'/*',target:{kind:'Static',cacheControl:'public, max-age=60'}}],framework:{name:'Shajara Static Campaign',version:'1.0.0'}}));
console.log('Campaign build passed: required content, registration configuration and assets packaged.');