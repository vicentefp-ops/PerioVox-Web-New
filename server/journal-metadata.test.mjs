import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,symlink} from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createJournalHandler} from './journal-http.mjs';
import {sourceHash} from './journal-store.mjs';
import {generateArticleMetadata,readArticleImage,validateMetadata} from './journal-metadata.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const es={title:'Prueba del editor',summary:'Un artículo ficticio para comprobar el flujo editorial.',body:'Este texto ficticio comprueba cómo se prepara una publicación.',slug:'prueba-del-editor',seoTitle:'',seoDescription:'',coverAlt:''};
const en={...es,title:'Editor test',summary:'A fictional article to check the editorial workflow.',body:'This fictional text checks how an article is prepared.',slug:'editor-test'};
const generated={seoTitle:'Prueba del editor | PerioVox',seoDescription:'Un ejemplo ficticio para comprobar el flujo editorial de PerioVox Journal.',coverAlt:'Un pequeño cuadrado blanco.'};
const provider=value=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})});

test('metadata adapter sends the actual image and validates only requested fields',async()=>{
 let request;
 const result=await generateArticleMetadata(es,{apiKey:'fictional-test-key',language:'es',fields:['seoTitle','coverAlt'],image:{mimeType:'image/png',data:png.toString('base64')},fetchImpl:async(url,options)=>{request={url,options};return provider({...generated,unexpected:'ignored'})}});
 assert.deepEqual(result,{seoTitle:generated.seoTitle,coverAlt:generated.coverAlt});
 assert.equal(request.url.includes('fictional-test-key'),false);
 assert.equal(request.options.headers['x-goog-api-key'],'fictional-test-key');
 const body=JSON.parse(request.options.body);
 assert.deepEqual(body.contents[0].parts[1].inlineData,{mimeType:'image/png',data:png.toString('base64')});
 assert.deepEqual(body.generationConfig.responseJsonSchema.required,['seoTitle','coverAlt']);
 assert.equal(body.generationConfig.responseJsonSchema.additionalProperties,false);
 assert.match(body.systemInstruction.parts[0].text,/untrusted source material/);
 assert.deepEqual(validateMetadata({seoTitle:'  Título\n de prueba  '},['seoTitle']),{seoTitle:'Título de prueba'});
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:''}),error=>error.status===409);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fields:['coverAlt']}),error=>error.status===400);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fields:['unknown']}),error=>error.status===400);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fetchImpl:async()=>({ok:false,status:429})}),/límite/);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})})}),/incompleta/);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fetchImpl:async()=>provider({...generated,seoTitle:'x'.repeat(66)})}),/demasiado largo/);
 await assert.rejects(()=>generateArticleMetadata(es,{apiKey:'fake',fetchImpl:async()=>provider({seoTitle:'Título'})}),/incompletos/);
});

test('cover reader only loads permitted local image bytes',async t=>{
 const directory=await mkdtemp('/private/tmp/periovox-metadata-image-');t.after(()=>rm(directory,{recursive:true,force:true}));
 const root=path.join(directory,'site'),dataDir=path.join(directory,'data');
 await mkdir(path.join(root,'public/media'),{recursive:true});await mkdir(path.join(dataDir,'uploads'),{recursive:true});
 await writeFile(path.join(root,'public/media','cover.png'),png);
 await writeFile(path.join(dataDir,'uploads','ab12-cd34.png'),png);
 assert.deepEqual(await readArticleImage('/media/cover.png',{root,dataDir}),{mimeType:'image/png',data:png.toString('base64')});
 assert.equal((await readArticleImage('/journal-media/ab12-cd34.png',{root,dataDir})).data,png.toString('base64'));
 for(const cover of ['https://attacker.test/image.png','/media/../secret.png','/journal-media/../../secret.png','/media/missing.png'])await assert.rejects(()=>readArticleImage(cover,{root,dataDir}),error=>error.status===400);
 await writeFile(path.join(directory,'outside.png'),png);await symlink(path.join(directory,'outside.png'),path.join(root,'public/media','escape.png'));
 await assert.rejects(()=>readArticleImage('/media/escape.png',{root,dataDir}),error=>error.status===400);
 await writeFile(path.join(root,'public/media','invalid.png'),'<svg/>');
 await assert.rejects(()=>readArticleImage('/media/invalid.png',{root,dataDir}),/PNG, JPG o WebP/);
 await writeFile(path.join(root,'public/media','large.png'),Buffer.alloc(8*1024*1024+1));
 await assert.rejects(()=>readArticleImage('/media/large.png',{root,dataDir}),/8 MB/);
});

async function fixture(t,{ready=true,generateMetadata,translate}={}){
 const directory=await mkdtemp('/private/tmp/periovox-metadata-http-');
 const service=createJournalHandler({root:path.resolve('.'),dataDir:directory,renderPage:async()=>'<html/>',generateMetadata:generateMetadata||(async(_text,{fields})=>Object.fromEntries(fields.map(field=>[field,generated[field]]))),translate:translate||(async()=>({...en,...generated}))});
 t.after(async()=>{service.store.close();await rm(directory,{recursive:true,force:true})});
 if(ready)await writeFile(path.join(directory,'gemini.key'),'fictional-test-key-with-no-access');
 const session=service.store.newSession('editor@example.test');
 async function call(url,method='GET',body,headers={}){
  const raw=Buffer.isBuffer(body);const req=Readable.from(body===undefined?[]:[raw?body:Buffer.from(JSON.stringify(body))]);
  req.url=url;req.method=method;req.socket={remoteAddress:'127.0.0.1'};req.headers={host:'127.0.0.1:3201',cookie:'pv_journal='+session.token,origin:'http://127.0.0.1:3201','x-journal-csrf':session.csrf,...(body!==undefined&&!raw?{'content-type':'application/json'}:{}),...headers};
  let output='';const res={statusCode:200,headersSent:false,setHeader(){},end(value=''){output+=value;this.headersSent=true}};
  await service.handler(req,res);return {status:res.statusCode,data:JSON.parse(output)};
 }
 const create=async(values={})=>(await call('/api/journal/articles','POST',{es:{...es},...values})).data.article;
 const metadata=(article,options={})=>call('/api/journal/articles/'+article.id+'/metadata','POST',{revision:article.revision,language:'es',scope:'all',...options});
 const publish=(article,bilingual=false)=>call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision,bilingual});
 const upload=async()=>(await call('/api/journal/uploads','POST',png)).data.url;
 return {service,call,create,metadata,publish,upload};
}

test('metadata endpoint authenticates, preserves manual fields and avoids duplicate calls',async t=>{
 const calls=[];const f=await fixture(t,{generateMetadata:async(_text,options)=>{calls.push(options);return generated}});
 let article=await f.create({es:{...es,seoTitle:'Mi título manual'}});
 const url='/api/journal/articles/'+article.id+'/metadata',body={revision:article.revision,scope:'seo'};
 assert.equal((await f.call(url,'POST',body,{cookie:''})).status,401);
 assert.equal((await f.call(url,'POST',body,{'x-journal-csrf':'invalid'})).status,403);
 assert.equal((await f.call(url,'POST',body,{origin:'https://attacker.test'})).status,403);
 const result=await f.metadata(article,{scope:'seo'});assert.equal(result.status,200);article=result.data.article;
 assert.equal(article.es.seoTitle,'Mi título manual');assert.equal(article.es.seoDescription,generated.seoDescription);
 assert.deepEqual(calls[0].fields,['seoDescription']);assert.deepEqual(result.data.filledFields,['seoDescription']);
 const duplicate=await f.metadata(article,{scope:'seo'});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.data.filledFields,[]);assert.equal(calls.length,1);
 assert.equal((await f.metadata(article,{language:'fr'})).status,400);assert.equal((await f.metadata(article,{scope:'unknown'})).status,400);assert.equal((await f.metadata(article,{scope:'image'})).status,400);
 assert.equal((await f.metadata({...article,revision:0})).status,409);
});

test('publishing fills empty SEO and image fields using the actual uploaded cover',async t=>{
 let options;const f=await fixture(t,{generateMetadata:async(_text,input)=>{options=input;return generated}});
 const article=await f.create({cover:await f.upload()});const result=await f.publish(article);
 assert.equal(result.status,200);assert.deepEqual(options.fields,['seoTitle','seoDescription','coverAlt']);
 assert.equal(options.image.data,png.toString('base64'));assert.equal(options.image.mimeType,'image/png');
 assert.equal(result.data.article.published.es.coverAlt,generated.coverAlt);assert.equal(result.data.article.published.es.seoTitle,generated.seoTitle);
 assert.equal(result.data.article.published.en,undefined);
});

test('metadata completion retains a current manually edited English article',async t=>{
 let translations=0;const f=await fixture(t,{translate:async()=>{translations++;return {...en,...generated}}});
 const article=await f.create({en:{...en,...generated}});assert.equal(article.translationSourceHash,sourceHash(article.es));
 const result=await f.publish(article,true);assert.equal(result.status,200);assert.equal(translations,0);
 assert.equal(result.data.article.published.en.body,en.body);assert.equal(result.data.article.translationBy,'manual');
 assert.equal(result.data.article.translationSourceHash,sourceHash(result.data.article.es));
});

test('Gemini failures preserve both the draft and previous public snapshot',async t=>{
 const f=await fixture(t,{generateMetadata:async()=>{throw Object.assign(Error('Proveedor no disponible'),{status:502})}});
 let article=await f.create({es:{...es,...generated}});article=(await f.publish(article)).data.article;
 article=(await f.call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,title:'Nuevo título privado',seoTitle:''}})).data.article;
 const result=await f.publish(article);assert.equal(result.status,502);
 const saved=f.service.store.get(article.id);assert.equal(saved.es.title,'Nuevo título privado');assert.equal(saved.es.seoTitle,'');assert.equal(saved.published.es.title,es.title);
});

test('late metadata cannot overwrite newer edits',async t=>{
 let release,started;const gate=new Promise(resolve=>{release=resolve}),entered=new Promise(resolve=>{started=resolve});
 const f=await fixture(t,{generateMetadata:async()=>{started();await gate;return generated}});
 let article=await f.create();const pending=f.metadata(article,{scope:'seo'});await entered;
 article=(await f.call('/api/journal/articles/'+article.id,'PUT',{...article,es:{...article.es,title:'Edición más reciente'}})).data.article;
 release();assert.equal((await pending).status,409);assert.equal(f.service.store.get(article.id).es.title,'Edición más reciente');assert.equal(f.service.store.get(article.id).es.seoTitle,'');
});

test('without Gemini, manual publication remains available and generation explains configuration',async t=>{
 const f=await fixture(t,{ready:false});const article=await f.create();
 assert.equal((await f.metadata(article,{scope:'seo'})).status,409);
 assert.equal((await f.publish(article)).status,200);
});

test('the persistent origin enforces the public site origin behind the Vercel proxy',async t=>{
 const previousOrigin=process.env.JOURNAL_ORIGIN,previousHosts=process.env.JOURNAL_INTERNAL_HOSTS;
 process.env.JOURNAL_ORIGIN='https://periovox.ai';process.env.JOURNAL_INTERNAL_HOSTS='journal-backend.periovox.ai';
 let f;try{f=await fixture(t)}finally{if(previousOrigin===undefined)delete process.env.JOURNAL_ORIGIN;else process.env.JOURNAL_ORIGIN=previousOrigin;if(previousHosts===undefined)delete process.env.JOURNAL_INTERNAL_HOSTS;else process.env.JOURNAL_INTERNAL_HOSTS=previousHosts}
 const headers={host:'journal-backend.periovox.ai',origin:'https://periovox.ai'};
 const created=await f.call('/api/journal/articles','POST',{es},headers);assert.equal(created.status,201);
 const article=created.data.article,url='/api/journal/articles/'+article.id+'/metadata',body={revision:article.revision,scope:'seo'};
 assert.equal((await f.call(url,'POST',body,headers)).status,200);
 assert.equal((await f.call(url,'POST',body,{...headers,origin:'https://attacker.test'})).status,403);
 assert.equal((await f.call('/api/journal/session','GET',undefined,{host:'attacker.test'})).status,400);
});
