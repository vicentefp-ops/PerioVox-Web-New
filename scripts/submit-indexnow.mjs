import assert from 'node:assert/strict';
const origin='https://periovox.ai',key=process.env.INDEXNOW_KEY;
if(!key||!/^[a-zA-Z0-9-]{8,128}$/.test(key))throw Error('Set INDEXNOW_KEY on the server before submitting.');
const keyLocation=origin+'/'+key+'.txt';
const proof=await fetch(keyLocation,{signal:AbortSignal.timeout(20000)});
assert.equal(proof.status,200,'Domain verification file unavailable');
assert.equal((await proof.text()).trim(),key,'Domain verification does not match');
const pages=new Set(),seen=new Set();
async function sitemap(url){
 assert.equal(new URL(url).origin,origin,'Sitemaps must remain on the website');
 if(seen.has(url))return;seen.add(url);
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
 const xml=await response.text(),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
 if(xml.includes('<sitemapindex')){for(const child of urls)await sitemap(child);}
 else for(const page of urls){const parsed=new URL(page);assert.equal(parsed.origin,origin);assert(!/^\/(?:api\/|journal\/admin|journal-media\/)/.test(parsed.pathname));pages.add(page);}
}
await sitemap(origin+'/sitemap.xml');assert(pages.size>0&&pages.size<=10000);
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host:'periovox.ai',key,keyLocation,urlList:[...pages]}),signal:AbortSignal.timeout(30000)});
if(![200,202].includes(response.status))throw Error('IndexNow returned HTTP '+response.status);
console.log(JSON.stringify({submittedAt:new Date().toISOString(),urls:pages.size,status:response.status,domainProofChecked:true,keyValidationPending:response.status===202,indexingConfirmed:false}));
