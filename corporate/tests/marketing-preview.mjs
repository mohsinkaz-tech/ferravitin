// Local UI test fixture ONLY. Never used by production routes or deployment.
// Start the built Amplify Nitro server on 3000, then run this proxy on 127.0.0.1:4100.
import http from 'node:http';
const samples=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',receivedAt:'2026-10-12T18:00:00Z',name:'QA Sample Contact',organization:'Sample Research Partner — QA only',email:'qa@example.com',region:'British Columbia',interest:'Research collaboration',message:'Synthetic test enquiry used to verify the dashboard interface. This is not a real lead.',notification:'Sent',status:'New',owner:'',followUp:'2026-10-12',notes:'',version:'0',updatedAt:'',updatedBy:''},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',receivedAt:'2026-10-11T18:00:00Z',name:'QA Sample Contact Two',organization:'Sample Retail Partner — QA only',email:'qa-two@example.com',region:'Ontario',interest:'Retail and distribution',message:'Synthetic retail enquiry.',notification:'Sent',status:'Qualified',owner:'QA Admin',followUp:'',notes:'Test fixture only.',version:'0',updatedAt:'',updatedBy:''}];
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/marketing-')){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.url.startsWith('/api/marketing-session'))return res.end(JSON.stringify({ok:true,username:'qa-preview@example.com'}));
    if(req.method==='POST'){let body='';for await(const part of req)body+=part;const update=JSON.parse(body),lead=samples.find(l=>l.id===update.id);Object.assign(lead,update,{version:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',updatedBy:'qa-preview@example.com',updatedAt:new Date().toISOString()});return res.end(JSON.stringify({ok:true,lead}));}
    return res.end(JSON.stringify({ok:true,leads:samples,total:samples.length,nextCursor:null}));
  }
  const target=await fetch('http://127.0.0.1:3000'+req.url);const headers=Object.fromEntries(target.headers);delete headers['content-length'];delete headers['content-encoding'];delete headers['transfer-encoding'];res.writeHead(target.status,headers);res.end(Buffer.from(await target.arrayBuffer()));
});
server.listen(4100,'127.0.0.1',()=>console.log('Synthetic QA preview at http://127.0.0.1:4100/internal/marketing'));
