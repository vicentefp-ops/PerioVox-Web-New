import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createJournalHandler} from './journal-http.mjs';
import {sourceHash,digest} from './journal-store.mjs';
import {translateArticle} from './journal-translation.mjs';
const root=path.resolve('.');
const text={title:'Explorar y registrar',summary:'Un ejemplo ficticio para comprobar el flujo editorial.',body:'## Registro por voz\n\nEste es un artículo ficticio para verificar el Journal. **Cada registro se revisa.**\n\nConsulta [PerioVox](https://periovox.ai/).',slug:'explorar-y-registrar',seoTitle:'Registro por voz | PerioVox',seoDescription:'Un ejemplo ficticio del registro periodontal por voz.',coverAlt:''};
const en={...text,title:'Examine and record',summary:'A fictional example to check the editorial workflow.',body:'## Voice charting\n\nThis is a fictional article for the Journal test. **Every record is reviewed.**\n\nSee [PerioVox](https://periovox.ai/).',slug:'examine-and-record',seoTitle:'Voice charting | PerioVox',seoDescription:'A fictional example of voice periodontal charting.'};
test('Journal authentication, persistence, publication and isolation',async t=>{
 const directory=await mkdtemp('/private/tmp/periovox-journal-test-');let calls=0,translationGate=null,failed=false;
 const service=createJournalHandler({root,dataDir:directory,renderPage:async props=>'<!doctype html>'+JSON.stringify(props),translate:async()=>{calls++;if(translationGate)await translationGate;if(failed)throw Object.assign(Error('Translation provider unavailable'),{status:502});return en}});
 t.after(async()=>{service.store.close();await rm(directory,{recursive:true,force:true})});
 await service.store.createUser('editor@example.test','Fictional-password-for-tests-only!');
 let cookie='',csrf='';
 async function call(url,method='GET',body,options={}){
  const raw=Buffer.isBuffer(body);const req=Readable.from(body===undefined?[]:[raw?body:Buffer.from(JSON.stringify(body))]);req.url=url;req.method=method;req.headers={host:options.host||'127.0.0.1:3201',...(cookie?{cookie}:{}),...(body!==undefined&&!raw?{'content-type':'application/json'}:{}),...(method!=='GET'&&method!=='HEAD'?{origin:options.origin||'http://127.0.0.1:3201'}:{}),...(csrf?{'x-journal-csrf':csrf}:{}),...options.headers};req.socket={remoteAddress:options.ip||'127.0.0.1'};
  const headers={};let output='';const res={statusCode:200,headersSent:false,setHeader(k,v){headers[k.toLowerCase()]=v},end(value=''){output+=value;this.headersSent=true}};
  const handled=await service.handler(req,res);let data;try{data=JSON.parse(output)}catch{}
  return {status:res.statusCode,headers,output,data,handled};
 }
 await t.test('private content requires authentication',async()=>{assert.equal((await call('/api/journal/articles')).status,401);assert.equal((await call('/api/journal/session')).data.authenticated,false)});
 await t.test('login enforces same origin and rejects wrong passwords',async()=>{assert.equal((await call('/api/journal/login','POST',{email:'editor@example.test',password:'wrong'},{origin:'https://attacker.test'})).status,403);assert.equal((await call('/api/journal/login','POST',{email:'editor@example.test',password:'wrong'})).status,401)});
 await t.test('server authenticates and sets protected cookie',async()=>{const r=await call('/api/journal/login','POST',{email:'editor@example.test',password:'Fictional-password-for-tests-only!'});assert.equal(r.status,200);assert.match(r.headers['set-cookie'],/HttpOnly; SameSite=Strict/);cookie=r.headers['set-cookie'].split(';')[0];csrf=r.data.csrf;assert.equal((await call('/api/journal/session')).data.authenticated,true);const row=service.store.db.prepare('SELECT * FROM users').get();assert.notEqual(row.password_hash,'Fictional-password-for-tests-only!');assert.equal(row.password_hash.length,128)});
 await t.test('writes require CSRF and cross-site requests are blocked',async()=>{assert.equal((await call('/api/journal/articles','POST',{es:text},{headers:{'x-journal-csrf':'invalid'}})).status,403);assert.equal((await call('/api/journal/articles','POST',{es:text},{origin:'https://attacker.test'})).status,403)});
 let article;
 await t.test('draft is durable and absent from public pages',async()=>{const r=await call('/api/journal/articles','POST',{es:text,category:'guides',author:'Equipo PerioVox'});assert.equal(r.status,201);article=r.data.article;assert.equal((await call('/es/journal/'+text.slug+'/')).status,404);assert.equal((await call('/es/journal/')).output.includes(text.title),false);assert.equal((await call('/api/journal/articles/'+article.id)).data.article.es.body,text.body);assert.equal((await stat(path.join(directory,'journal.sqlite'))).mode&0o777,0o600)});
 await t.test('stale saves are rejected',async()=>{assert.equal((await call('/api/journal/articles/'+article.id,'PUT',{...article,revision:0})).status,409)});
 await t.test('Spanish-only publication has no English article',async()=>{const r=await call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision,bilingual:false});assert.equal(r.status,200);article=r.data.article;assert.equal((await call('/es/journal/'+text.slug+'/')).status,200);assert.equal((await call('/journal/'+en.slug+'/')).status,404);assert.match((await call('/sitemap.xml')).output,/es\/journal\/explorar-y-registrar/);assert.equal(calls,0)});
 await t.test('draft changes do not change the published snapshot',async()=>{const r=await call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,title:'Cambios privados del borrador'}});article=r.data.article;const page=await call('/es/journal/'+text.slug+'/');assert.equal(page.output.includes('Cambios privados del borrador'),false);assert.equal(page.output.includes(text.title),true)});
 await t.test('Gemini key remains server-only',async()=>{const key='Fictional_Gemini_Key_Only_For_Testing';const r=await call('/api/journal/settings/gemini','POST',{apiKey:key,model:'gemini-3.8-flash'});assert.equal(r.status,200);assert.equal(r.data.translationReady,true);assert.equal(r.output.includes(key),false);assert.equal((await call('/api/journal/session')).output.includes(key),false);assert.equal((await stat(path.join(directory,'gemini.key'))).mode&0o777,0o600)});
 await t.test('Gemini authorization keys can be saved without legacy format limits',async()=>{
  const key='AQ.'+'Fictional.key_for_testing-Only_'.repeat(30);
  assert(key.length>256);
  const r=await call('/api/journal/settings/gemini','POST',{apiKey:' '+key+' ',model:'gemini-3.8-flash'});
  assert.equal(r.status,200);assert.equal(r.data.translationReady,true);
  assert.equal(await readFile(path.join(directory,'gemini.key'),'utf8'),key);
  assert.equal(r.output.includes(key),false);assert.equal((await call('/api/journal/session')).output.includes(key),false);
  assert.equal((await call('/api/journal/settings/gemini','POST',{apiKey:'',model:'gemini-3.8-flash'})).status,200);
  assert.equal(await readFile(path.join(directory,'gemini.key'),'utf8'),key);
  for(const apiKey of ['short','AQ.'+'x'.repeat(30)+'\r\nInjected: header','x'.repeat(4097)]){
   assert.equal((await call('/api/journal/settings/gemini','POST',{apiKey,model:'gemini-3.8-flash'})).status,400);
   assert.equal(await readFile(path.join(directory,'gemini.key'),'utf8'),key);
  }
 });
 await t.test('bilingual publication translates and stores both languages',async()=>{const r=await call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision});assert.equal(r.status,200);article=r.data.article;assert.equal(calls,1);assert.equal(article.translationSourceHash,sourceHash(article.es));assert.equal(article.published.en.title,en.title);assert.equal((await call('/journal/'+en.slug+'/')).status,200);const sitemap=(await call('/sitemap.xml')).output;assert.match(sitemap,/hreflang="en"/);assert.match(sitemap,/journal\/examine-and-record/)});
 await t.test('provider failure preserves both draft and previous publication',async()=>{article=(await call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,title:'Una nueva revisión pendiente'}})).data.article;failed=true;const r=await call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision});assert.equal(r.status,502);const saved=(await call('/api/journal/articles/'+article.id)).data.article;assert.equal(saved.es.title,'Una nueva revisión pendiente');assert.notEqual(saved.published.es.title,saved.es.title);failed=false});
 await t.test('concurrent edits cannot be overwritten by a late translation',async()=>{let release;translationGate=new Promise(resolve=>{release=resolve});const pending=call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision});await new Promise(resolve=>setTimeout(resolve,10));article=(await call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,title:'Edición posterior que debe conservarse'}})).data.article;release();assert.equal((await pending).status,409);translationGate=null;assert.equal(service.store.get(article.id).es.title,'Edición posterior que debe conservarse')});
 await t.test('renamed slugs redirect and duplicates are rejected',async()=>{article=(await call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,slug:'nueva-direccion'}})).data.article;article=(await call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision,bilingual:false})).data.article;const r=await call('/es/journal/'+text.slug+'/');assert.equal(r.status,301);assert.equal(r.headers.location,'/es/journal/nueva-direccion/');const duplicate=(await call('/api/journal/articles','POST',{es:{...text,slug:'nueva-direccion'}})).data.article;assert.equal((await call('/api/journal/articles/'+duplicate.id+'/publish','POST',{revision:duplicate.revision,bilingual:false})).status,409)});
 await t.test('unsafe images and uploads are rejected',async()=>{assert.equal((await call('/api/journal/articles','POST',{es:text,cover:'javascript:alert(1)'})).status,400);assert.equal((await call('/api/journal/uploads','POST',Buffer.from('<svg onload="alert(1)"></svg>'))).status,415)});
 await t.test('withdrawing removes article from both pages and sitemap',async()=>{const r=await call('/api/journal/articles/'+article.id+'/unpublish','POST',{revision:article.revision});assert.equal(r.status,200);assert.equal((await call('/es/journal/nueva-direccion/')).status,404);assert.equal((await call('/sitemap.xml')).output.includes('/es/journal/nueva-direccion/'),false)});
 await t.test('private admin has noindex and never embeds articles or credentials',async()=>{const r=await call('/journal/admin/');assert.equal(r.headers['x-robots-tag'],'noindex, nofollow');assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.output.includes(article.es.body),false)});
 await t.test('logout revokes the session token',async()=>{assert.equal((await call('/api/journal/logout','POST',{})).status,200);assert.equal((await call('/api/journal/articles')).status,401);cookie='';csrf=''});
 await t.test('too many login attempts are rate limited',async()=>{for(let i=0;i<5;i++)assert.equal((await call('/api/journal/login','POST',{email:'editor@example.test',password:'wrong'},{ip:'rate-test'})).status,401);assert.equal((await call('/api/journal/login','POST',{email:'editor@example.test',password:'wrong'},{ip:'rate-test'})).status,429)});
});
test('Gemini adapter validates actual provider-shaped responses',async()=>{
 let requested;
 const fetchImpl=async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(en)}]}}]})}};
 assert.equal((await translateArticle(text,{apiKey:'fictional',fetchImpl})).title,en.title);
 assert.match(requested.url,/generativelanguage\.googleapis\.com/);assert.equal(requested.options.headers['x-goog-api-key'],'fictional');assert(JSON.parse(requested.options.body).generationConfig.responseJsonSchema);
 await assert.rejects(()=>translateArticle(text,{apiKey:''}),/Configura la clave/);
 await assert.rejects(()=>translateArticle(text,{apiKey:'fictional',fetchImpl:async()=>({ok:false,status:429})}),/límite/);
 await assert.rejects(()=>translateArticle(text,{apiKey:'fictional',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})})}),/incompleta/);
 await assert.rejects(()=>translateArticle(text,{apiKey:'fictional',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({...en,body:'No links retained'})}]}}]})})}),/enlaces/);
});
test('real SSR renders safe articles, metadata and private admin',async()=>{
 const {renderJournalDocument}=await import('../dist-server/journal-entry.js');const snapshot={id:'fictional',es:{...text,body:text.body+'\n\n<script>alert(1)</script>'},en,author:'Equipo PerioVox',category:'guides',cover:'',publishedAt:'2026-10-12T10:00:00Z',modifiedAt:'2026-10-12T10:00:00Z'};
 const html=renderJournalDocument({lang:'es',posts:[snapshot],post:snapshot},root);assert.equal([...html.matchAll(/<h1\b/g)].length,1);assert.match(html,/<link rel="canonical" href="https:\/\/periovox.ai\/es\/journal\/explorar-y-registrar\//);assert.match(html,/@type":"BlogPosting/);assert.match(html,/hreflang="en"/);assert.equal(html.includes('<script>alert(1)</script>'),false);assert.match(html,/&lt;script&gt;/);assert.equal(JSON.parse(html.match(/<script id="journal-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).post.es.body,snapshot.es.body);assert.match(html,/\\u003cscript/);
 const spanish=renderJournalDocument({lang:'es',posts:[],post:{...snapshot,en:undefined}},root);assert.equal(spanish.includes('hreflang="en"'),false);
 const admin=renderJournalDocument({lang:'es',admin:true,posts:[]},root);assert.match(admin,/noindex,nofollow/);assert.equal(admin.includes('article-body'),false);assert.match(admin,/JournalAdmin-/);assert.equal(html.includes('JournalAdmin-'),false);
});

test('published rich text preserves nested formatting and safely renders images and links',async()=>{
 const {renderJournalDocument}=await import('../dist-server/journal-entry.js');
 const body='## Un título\n\nTexto **fuerte y *en cursiva*** con [enlace](https://periovox.ai/).\n\n- Primero\n  - Segundo\n\n> Una cita\n\n![Imagen del artículo](/media/example.png)\n\n[Enlace peligroso](javascript:alert%281%29)\n\n![Imagen externa](https://example.test/track.png)\n\n<img src=x onerror=alert(1)>';
 const snapshot={id:'fictional-rich-text',es:{...text,body},author:'Equipo de prueba',category:'guides',cover:'',publishedAt:'2026-10-13T10:00:00Z',modifiedAt:'2026-10-13T10:00:00Z'};
 const html=renderJournalDocument({lang:'es',posts:[],post:snapshot},root);
 const article=html.match(/<div class="journal-body">([\s\S]*?)<\/div>/)[1];
 assert.match(article,/<h2>Un título<\/h2>/);assert.match(article,/<strong>fuerte y <em>en cursiva<\/em><\/strong>/);
 assert.match(article,/<ul><li>Primero<ul><li>Segundo<\/li><\/ul><\/li><\/ul>/);
 assert.match(article,/<blockquote><p>Una cita<\/p><\/blockquote>/);
 assert.match(article,/<figcaption>Imagen del artículo<\/figcaption>/);
 assert.match(article,/src="\/media\/example.png"/);
 assert.equal(article.includes('href="javascript:'),false);assert.equal(article.includes('src="https://example.test'),false);
 assert.equal(article.includes('<img src=x'),false);assert.match(article,/&lt;img src=x/);
});
