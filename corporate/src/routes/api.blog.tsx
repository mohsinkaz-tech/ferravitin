import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/blog')({server:{handlers:{GET:async()=>{
const url=process.env.GOOGLE_BLOG_FEED_URL;
const result=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=180'}});
if(!url)return result({articles:[]});
try{const u=new URL(url);if(u.protocol!=='https:'||!['script.google.com','script.googleusercontent.com'].includes(u.hostname))throw new Error('bad URL');const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('unavailable');const raw=await response.json() as {articles?:Record<string,unknown>[]};const articles=(raw.articles||[]).filter(a=>a.status==='Published'&&a.regulatoryApproved===true&&a.scientificApproved===true).slice(0,30).map(a=>({id:String(a.id||'').slice(0,80),title:String(a.title||'').slice(0,160),summary:String(a.summary||'').slice(0,350),url:String(a.url||'').startsWith('https://')?String(a.url):'',date:String(a.date||'').slice(0,30)}));return result({articles})}catch{return result({articles:[]})}
}}}});
