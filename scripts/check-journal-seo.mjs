// Render only fictional fixtures. Never read Journal storage, credentials or patient data.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {JSDOM} from 'jsdom';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const origin='https://periovox.ai';
const text={title:'Fictional "SEO" & language fixture',summary:'A fictional article used only to test metadata.',body:'Test fixture, not medical guidance.',slug:'seo-fixture',seoTitle:'',seoDescription:'',coverAlt:'Fictional "image" & caption'};
const base={id:'seo-fixture',es:{...text,slug:'prueba-seo'},author:'Equipo PerioVox',category:'guides',cover:'/media/hero-poster.jpg',publishedAt:'2026-01-01T12:00:00.000Z',modifiedAt:'2026-01-02T12:00:00.000Z'};
try{
 const {renderJournalDocument}=await server.ssrLoadModule('/src/journal-entry.tsx');
 const fixtures=[
  {name:'Spanish only',lang:'es',post:base},
  {name:'Bilingual Spanish',lang:'es',post:{...base,en:{...text}}},
  {name:'Bilingual English',lang:'en',post:{...base,en:{...text}}},
  {name:'Manual metadata',lang:'es',post:{...base,es:{...base.es,seoTitle:'Manual title | PerioVox',seoDescription:'A manually approved description.'}}},
  {name:'Spanish collection',lang:'es'},
  {name:'English collection',lang:'en'}
 ];
 for(const fixture of fixtures){
  const {lang,post}=fixture;
  const html=renderJournalDocument({lang,post,posts:post?[post]:[]},process.cwd());
  const document=new JSDOM(html).window.document;
  const path=(lang==='es'?'/es/journal/':'/journal/')+(post?post[lang].slug+'/':'');
  const url=origin+path;
  const meta=(key)=>document.querySelector('meta[name="'+key+'"],meta[property="'+key+'"]')?.content;
  assert.equal(document.documentElement.lang,lang,fixture.name);
  assert.equal(document.querySelectorAll('h1').length,1,fixture.name);
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1);
  assert.equal(document.querySelector('link[rel="canonical"]').href,url);
  assert.equal(meta('og:url'),url);
  assert(!meta('robots').includes('noindex'));
  const graph=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'];
  const page=graph.find(n=>n['@id']===url+'#webpage');
  assert.equal(page.mainEntity['@id'],url+(post?'#article':'#articles'));
  assert(graph.some(n=>n['@id']===page.mainEntity['@id']),'mainEntity must resolve within graph');
  if(post){
   const current=post[lang];
   const article=graph.find(n=>n['@type']==='BlogPosting');
   assert.equal(article.url,url);
   assert.equal(article.headline,current.title);
   assert.equal(article.datePublished,post.publishedAt);
   assert.equal(article.dateModified,post.modifiedAt);
   assert.equal(meta('twitter:image:alt'),current.coverAlt);
   assert.equal(meta('og:image:alt'),current.coverAlt);
   assert.equal(meta('twitter:title'),document.title);
   assert.equal(meta('og:title'),document.title);
   assert.equal(meta('twitter:description'),meta('description'));
   if(current.seoTitle)assert.equal(document.title,current.seoTitle);
   if(current.seoDescription)assert.equal(meta('description'),current.seoDescription);
   assert.equal(document.querySelectorAll('link[hreflang="en"]').length,post.en?1:0,'No invented English translation');
   assert.equal(meta('og:locale:alternate'),post.en?(lang==='es'?'en_US':'es_ES'):undefined);
   assert.equal(document.querySelector('link[hreflang="x-default"]').href,origin+(post.en?'/journal/'+post.en.slug+'/':'/es/journal/'+post.es.slug+'/'));
   const crumbs=graph.find(n=>n['@type']==='BreadcrumbList').itemListElement;
   assert.equal(crumbs.at(-1).item,url);
   assert(!article.reviewedBy,'No invented clinical reviewer');
  }
 }
 const admin=new JSDOM(renderJournalDocument({lang:'es',posts:[],admin:true},process.cwd())).window.document;
 assert.equal(admin.querySelector('meta[name="robots"]').content,'noindex,nofollow');
 assert.equal(admin.querySelector('link[rel="canonical"]'),null);
 console.log('Journal SEO checks passed: 6 public fixtures + private editor noindex; no live data accessed.');
}finally{await server.close()}
