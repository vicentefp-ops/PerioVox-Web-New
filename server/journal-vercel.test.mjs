import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {journalRuntimeConfig,authorizedCron} from './journal-runtime-config.mjs';
import {createEncryptedSettings} from './journal-settings.mjs';
import {createJournalHandler} from './journal-http.mjs';
import {PGlite} from '@electric-sql/pglite';
import {initializePostgresSchema,openPostgresStore} from './journal-postgres-store.mjs';
const preview={NODEJS_HELPERS:'0',JOURNAL_BACKEND:'vercel',VERCEL_ENV:'preview',VERCEL_URL:'isolated.example.test',JOURNAL_PREVIEW_DATABASE_URL:'postgres://test/isolated',JOURNAL_PREVIEW_BLOB_TOKEN:'fake-preview-token',JOURNAL_PREVIEW_ENVIRONMENT_ID:'preview:test'};
test('runtime is opt-in; previews cannot fall back to production or generic secrets',()=>{
 assert.throws(()=>journalRuntimeConfig({}));
 assert.throws(()=>journalRuntimeConfig({...preview,JOURNAL_PREVIEW_DATABASE_URL:undefined,JOURNAL_PRODUCTION_DATABASE_URL:'postgres://prod/db'}));
 assert.throws(()=>journalRuntimeConfig({...preview,JOURNAL_PRODUCTION_DATABASE_URL:preview.JOURNAL_PREVIEW_DATABASE_URL}));
 assert.throws(()=>journalRuntimeConfig({...preview,JOURNAL_PREVIEW_ENVIRONMENT_ID:'production:foo'}));
 assert.throws(()=>journalRuntimeConfig({...preview,VERCEL_URL:'evil.test/path'}));
 const c=journalRuntimeConfig({...preview,GEMINI_API_KEY:'production-secret'});assert.equal(c.preview,true);assert.equal(c.gemini.GEMINI_API_KEY,undefined);
 assert.throws(()=>journalRuntimeConfig({...preview,VERCEL_ENV:'production'}));
 const prod={...preview,VERCEL_ENV:'production',JOURNAL_PRODUCTION_DATABASE_URL:'postgres://prod/db',JOURNAL_PRODUCTION_BLOB_TOKEN:'fake-prod',JOURNAL_PRODUCTION_ENVIRONMENT_ID:'production:test'};
 assert.throws(()=>journalRuntimeConfig(prod),/scheduler/);
 assert.throws(()=>journalRuntimeConfig({...prod,JOURNAL_SCHEDULER_MODE:'external-minute'}),/secret/);
 assert.equal(journalRuntimeConfig({...prod,JOURNAL_SCHEDULER_MODE:'external-minute',CRON_SECRET:'x'.repeat(32)}).preview,false);
});
test('encrypted settings preserve editor functionality without leaking stored plaintext',async()=>{
 const values=new Map(),store={getSetting:async name=>values.get(name),setSetting:async(name,value)=>values.set(name,value)};
 const settings=createEncryptedSettings(store,{key:'12'.repeat(32),env:{}});
 assert.equal(await settings.apiKey(),'');await settings.save('fake-gemini-key-for-test','gemini-test');
 assert.equal(await settings.apiKey(),'fake-gemini-key-for-test');assert.equal(await settings.model(),'gemini-test');
 assert.ok(!values.get('gemini-key').includes('fake-gemini'));await settings.save('','gemini-next');assert.equal(await settings.apiKey(),'fake-gemini-key-for-test');
 await assert.rejects(createEncryptedSettings(store,{key:'34'.repeat(32),env:{}}).apiKey());
 await assert.rejects(createEncryptedSettings(store,{env:{}}).save('another','gemini-test'),{status:409});
 assert.equal(await settings.apiKey(),'fake-gemini-key-for-test');
});
test('workflow Preview and alternate configs contain no unapproved cron',async()=>{
 const original=JSON.parse(await readFile('vercel.json'));
 assert.equal(original.buildCommand,'npm run build:workflow-preview');
 assert.equal(original.crons,undefined);
 assert.equal(original.rewrites,undefined);
 for(const name of ['preview','production']){const config=JSON.parse(await readFile(`vercel.journal.${name}.json`));assert.ok(config.rewrites.every(r=>r.destination==='/api/journal'));assert.equal(config.crons,undefined);assert.ok(!JSON.stringify(config).includes('journal-backend.periovox.ai'));assert.ok(config.functions['api/journal.mjs'].includeFiles.includes('dist/.vite'));assert.equal(config.headers.some(r=>r.headers.some(h=>h.key==='X-Robots-Tag'&&h.value==='noindex, nofollow')),name==='preview')}
});
test('async PostgreSQL HTTP contract preserves private drafts, auth, CSRF, uploads, publication, SEO and previews',async t=>{
 const db=new PGlite();t.after(()=>db.close());const pool={query:(sql,values)=>db.query(sql,values),connect:async()=>({query:(sql,values)=>sql.includes('CREATE TABLE')?db.exec(sql).then(()=>({rows:[]})):db.query(sql,values),release(){}})};
 await initializePostgresSchema(pool,'preview:test');const store=await openPostgresStore({pool,expectedEnvironment:'preview:test'});
 await store.createUser('editor@example.test','fictional-password');const values=new Map();const settings=createEncryptedSettings({getSetting:async n=>values.get(n),setSetting:async(n,v)=>values.set(n,v)},{key:'12'.repeat(32),env:{}});
 const uploads=[];const media={begin(body,owner){uploads.push({body,owner});return {ticket:'test',chunkBytes:2*1024*1024}},async chunk(ticket,index,bytes,owner){uploads.push({ticket,index,size:bytes.length,owner});return {receipt:'part'}},async complete(ticket,receipts,owner){uploads.push({ticket,receipts,owner});return {url:'/journal-media/abc.png'}}};
 const service=createJournalHandler({root:process.cwd(),store,media,settings,preview:true,origin:'https://isolated.example.test',allowedHosts:['isolated.example.test'],renderPage:props=>JSON.stringify(props)});
 let cookie='',csrf='';async function call(url,method='GET',body,extra={}){
  const req=Readable.from(body===undefined?[]:[Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body))]);Object.assign(req,{url,method,headers:{host:'isolated.example.test',origin:'https://isolated.example.test','content-type':'application/json',cookie,'x-journal-csrf':csrf,...extra},socket:{remoteAddress:'127.0.0.1'}});
  let output='';const headers={};const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},end(v=''){output+=v;this.headersSent=true}};await service.handler(req,res);let data;try{data=JSON.parse(output)}catch{}return {status:res.statusCode,data,output,headers};
 }
 assert.equal((await call('/api/journal/articles')).status,401);
 const login=await call('/api/journal/login','POST',{email:'editor@example.test',password:'fictional-password'});assert.equal(login.status,200);assert.equal(login.data.uploadMode,'chunks');csrf=login.data.csrf;cookie=login.headers['set-cookie'].split(';')[0];assert.match(login.headers['set-cookie'],/Secure/);
 assert.equal((await call('/api/journal/uploads/begin','POST',{size:8},{'x-journal-csrf':'wrong'})).status,403);
 assert.equal((await call('/api/journal/uploads/begin','POST',{size:8})).status,201);assert.equal(uploads[0].owner,csrf);
 assert.equal((await call('/api/journal/uploads/chunk?index=0','POST',Buffer.alloc(8),{'x-journal-upload':'test'})).status,201);assert.equal(uploads[1].size,8);
 assert.equal((await call('/api/journal/uploads/complete','POST',{ticket:'test',receipts:['part']})).status,201);
 assert.equal((await call('/api/journal/uploads','POST',Buffer.alloc(8))).status,413);
 const es={title:'Fictional draft',summary:'Fictional summary',body:'Fictional body',slug:'fictional',seoTitle:'Test',seoDescription:'Test',coverAlt:''};let article=(await call('/api/journal/articles','POST',{es})).data.article;
 assert.equal((await call('/es/journal/fictional/')).status,404);
 let response=await call('/api/journal/articles/'+article.id+'/publish','POST',{revision:article.revision,bilingual:false});assert.equal(response.status,200);article=response.data.article;
 const page=await call('/es/journal/fictional/');assert.equal(page.status,200);assert.match(page.headers['x-robots-tag'],/noindex/);assert.match(page.output,/Fictional draft/);
 assert.match((await call('/sitemap-journal.xml')).output,/\/es\/journal\/fictional\//);
 assert.equal((await call('/api/journal/articles/'+article.id,'PUT',{...article,revision:0})).status,409);
 assert.equal((await call('/api/journal/settings/gemini','POST',{apiKey:'fictional-key-for-this-test',model:'gemini-test'})).status,200);
 assert.ok(!(await call('/api/journal/session')).output.includes('fictional-key'));
 assert.equal((await call('/journal/', 'GET',undefined,{host:'evil.example.test'})).status,400);
});

test('native cron accepts only canonical or verified deployment hostname and exact secret',()=>{
 const config={cronHosts:['periovox.ai','verified-deployment.vercel.app'],cronSecret:'x'.repeat(32)};
 const request=host=>({method:'GET',headers:{host,authorization:'Bearer '+'x'.repeat(32)}});
 assert.equal(authorizedCron(request('periovox.ai'),config),true);
 assert.equal(authorizedCron(request('verified-deployment.vercel.app'),config),true);
 assert.equal(authorizedCron(request('attacker.vercel.app'),config),false);
 assert.equal(authorizedCron({...request('periovox.ai'),method:'POST'},config),false);
 assert.equal(authorizedCron({method:'GET',headers:{host:'verified-deployment.vercel.app',authorization:'Bearer wrong'}},config),false);
 assert.equal(authorizedCron(request('periovox.ai'),{...config,cronSecret:undefined}),false);
});
test('Vercel entry is inert without explicit backend opt-in',async()=>{
 const previous=process.env.JOURNAL_BACKEND;delete process.env.JOURNAL_BACKEND;
 try{const {default:handler,config}=await import('../workflow-preview/journal-runtime.mjs');assert.equal(config.supportsResponseStreaming,true);let ended=false;const response={end(){ended=true}};await handler({url:'/api/journal/session',headers:{}},response);assert.equal(response.statusCode,404);assert.equal(ended,true)}finally{if(previous===undefined)delete process.env.JOURNAL_BACKEND;else process.env.JOURNAL_BACKEND=previous}
});
test('storage setup CLI refuses absent acknowledgement without opening storage',async()=>{
 const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,['scripts/journal-storage-setup.mjs'],{encoding:'utf8',env:{PATH:process.env.PATH,JOURNAL_DATABASE_URL:'postgres://do-not-connect.invalid/db',BLOB_READ_WRITE_TOKEN:'fake-secret-not-for-output',JOURNAL_ENVIRONMENT_ID:'preview:test'}});
 assert.equal(result.status,1);assert.match(result.stderr,/setup failed/);assert.ok(!result.stderr.includes('fake-secret'));assert.ok(!result.stderr.includes('do-not-connect'));
});
