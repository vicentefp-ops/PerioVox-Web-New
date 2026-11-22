import {searchSnippets,applySearchSnippet} from '../server/journal-search-snippets.mjs';
const snippet=searchSnippets['choosing-voice-periodontal-charting-software'];
const upstreamUrl='https://journal-backend.periovox.ai/journal/choosing-voice-periodontal-charting-software/';
export default async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method||'GET')){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}
 let upstream;
 try{upstream=await fetch(upstreamUrl,{headers:{accept:'text/html','user-agent':'PerioVox-search-snippet'},redirect:'follow'})}
 catch{res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('Journal origin unavailable.');return}
 const html=applySearchSnippet(await upstream.text(),snippet);
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':upstream.ok?'no-cache':'no-store'};
 if(!upstream.ok)headers['X-Robots-Tag']='noindex';
 res.writeHead(upstream.ok?200:upstream.status,headers);
 res.end(req.method==='HEAD'?'':html);
}
