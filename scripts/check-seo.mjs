import assert from 'node:assert/strict';
import {readFile,access,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const origin='https://periovox.ai';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=s=>decode(s.replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<style\b[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]))}
const results=[];
try{
 const {siteRoutes,metadata}=await server.ssrLoadModule('/src/entry-server.tsx');
 const titles=new Set();const descriptions=new Set();const linked=new Map();const languages=new Map();
 for(const route of siteRoutes){
  const file=`dist${route.path}index.html`;const html=await readFile(file,'utf8');const expected=metadata(route);
  const title=decode(html.match(/<title>([^<]+)<\/title>/)?.[1]??'');const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  const links=[...html.matchAll(/<link\b[^>]+>/g)].map(m=>attrs(m[0]));const metas=[...html.matchAll(/<meta\b[^>]+>/g)].map(m=>attrs(m[0]));
  const description=metas.find(m=>m.name==='description')?.content;
  assert.equal(title,expected.title,`Wrong title: ${file}`);assert(title.length<=65,`Long title (${title.length}): ${title}`);assert(!titles.has(title),`Duplicate title: ${file}`);titles.add(title);
  assert.equal(description,expected.description);assert(description.length<=160,`Long description (${description.length}): ${file}`);assert(!descriptions.has(description),`Duplicate description: ${file}`);descriptions.add(description);
  assert.equal(h1.length,1,`One H1 required: ${file}`);if(route.guide)assert.equal(text(h1[0][1]),route.guide.h1);
  assert(html.startsWith(`<!doctype html><html lang="${route.lang}">`),`Wrong document language: ${file}`);
  assert.equal(links.filter(l=>l.rel==='canonical').length,1);assert.equal(links.find(l=>l.rel==='canonical').href,expected.url);
  if(route.kind!=='journal'){
   const config=JSON.parse(await readFile('vercel.json','utf8'));
   for(const source of [...(route.path==='/'?[]:[route.path.replace(/\/$/,'')]),route.path+'index.html'])assert(config.redirects.some(r=>r.source===source&&r.destination===route.path&&r.permanent===true),`Missing canonical redirect: ${source}`);
  }
  await access('dist'+new URL(expected.image).pathname);
  const alternates=links.filter(l=>l.rel==='alternate');assert.equal(alternates.length,3);
  const en=origin+(route.lang==='en'?route.path:route.alternate);const es=origin+(route.lang==='es'?route.path:route.alternate);
  assert.equal(alternates.find(l=>l.hreflang==='en')?.href,en);assert.equal(alternates.find(l=>l.hreflang==='es')?.href,es);assert.equal(alternates.find(l=>l.hreflang==='x-default')?.href,en);
  assert.equal(metas.find(m=>m.property==='og:url')?.content,expected.url);assert.equal(metas.find(m=>m.property==='og:title')?.content,title);
  assert(!metas.find(m=>m.name==='robots').content.includes('noindex'));
  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);const schema=JSON.parse(scripts[0][1]);const nodes=schema['@graph'];
  const software=nodes.find(n=>[].concat(n['@type']).includes('SoftwareApplication'));assert.equal(software.offers.price,0);assert.equal(software.isAccessibleForFree,true);assert.deepEqual(software.inLanguage,['es','en','fr']);assert(!software.aggregateRating&&!software.review,'Do not fabricate reviews');
  const faq=nodes.find(n=>n['@type']==='FAQPage');if(faq)for(const q of faq.mainEntity){assert(text(html).includes(q.name),`FAQ question absent: ${file}`);assert(text(html).includes(q.acceptedAnswer.text),`FAQ answer absent: ${file}`)}
  if(route.guide){assert(nodes.some(n=>n['@type']==='Article'));assert(nodes.some(n=>n['@type']==='BreadcrumbList'))}
  const anchors=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m=>decode(m[1]));const targets=[];
  for(const href of anchors){
   if(!href.startsWith('/')&&!href.startsWith('#')&&!href.startsWith(origin))continue;
   const url=new URL(href,expected.url);if(url.origin!==origin)continue;
   if(url.pathname===route.path&&url.hash){assert(html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`Broken anchor ${href}: ${file}`)}
   const page=siteRoutes.find(r=>r.path===url.pathname);
   if(page){targets.push(page.path);if(url.hash){const targetHtml=await readFile(`dist${page.path}index.html`,'utf8');assert(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`Broken cross-page anchor: ${href}`)}}
   else if(url.pathname!=='/'&&url.pathname!=='/journal/admin/'){await access('dist'+url.pathname)}
  }
  linked.set(route.path,targets);languages.set(route.path,alternates);
  for(const match of html.matchAll(/<(?:img|video|script|link)\b[^>]+>/g)){
   const a=attrs(match[0]);const asset=a.src??(a.rel==='stylesheet'||a.rel==='preload'||a.rel==='modulepreload'?a.href:undefined);
   if(asset?.startsWith('/'))await access('dist'+asset);
   if(match[0].startsWith('<img')){assert('alt'in a,`Image alt missing: ${file}`);assert(a.width&&a.height,`Image dimensions missing: ${file}`)}
  }
  const styles=links.filter(l=>l.rel==='stylesheet');assert(styles.length>=2,`Missing SSR styles: ${file}`);
  if(route.kind!=='home')assert(!links.some(l=>l.rel==='modulepreload'&&/\/App-/.test(l.href)),'Guides must not preload motion/video bundle');
  const words=text(html).split(/\s+/).length;if(route.guide)assert(words>=450,`Guide too short: ${file}`);
  if(route.kind==='home'){assert(html.includes('/media/comparativa-3.webp'));assert(html.includes('/media/comparativa-4.webp'));assert(html.includes('/media/conversation-loop.mp4'));assert(html.includes('data-conversion="start_free"'))}
  results.push({path:route.path,language:route.lang,title,titleLength:title.length,descriptionLength:description.length,words,h1:text(h1[0][1]),canonical:expected.url,status:'pass'});
 }
 for(const route of siteRoutes){assert(siteRoutes.some(r=>r.path===route.alternate&&r.alternate===route.path),`Nonreciprocal translation: ${route.path}`)}
 const seen=new Set();function crawl(path){if(seen.has(path))return;seen.add(path);for(const target of linked.get(path)??[])crawl(target)}crawl('/');assert.equal(seen.size,siteRoutes.length,'Orphan pages');
 const sitemap=await readFile('dist/sitemap.xml','utf8');const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.deepEqual(new Set(urls),new Set(siteRoutes.map(r=>origin+r.path)));
 const robots=await readFile('dist/robots.txt','utf8');assert(robots.includes('Allow: /'));assert(robots.includes('Sitemap: '+origin+'/sitemap.xml'));
 const llms=await readFile('dist/llms.txt','utf8');for(const route of siteRoutes)assert(llms.includes(origin+route.path));
 const missing=await readFile('dist/404.html','utf8');assert(missing.includes('noindex,follow'));
 await writeFile('review/seo-validation.json',JSON.stringify({checkedAt:new Date().toISOString(),pages:results,reachablePages:seen.size,checks:['unique metadata','one H1','static content','canonical URLs','reciprocal hreflang','valid JSON-LD and truthful free offer','visible FAQ consistency','internal links and anchors','no orphan pages','asset files and dimensions','SSR styles','guide bundle separation','sitemap coverage','robots.txt','supplementary llms.txt','404 noindex'],browserVisualVerification:'not performed: browser control previously blocked'},null,2)+'\n');
 console.log(`SEO checks passed: ${results.length} pages, ${seen.size} reachable, no broken internal links or assets.`);
 console.table(results.map(({path,titleLength,descriptionLength,words,status})=>({path,titleLength,descriptionLength,words,status})));
}finally{await server.close()}
