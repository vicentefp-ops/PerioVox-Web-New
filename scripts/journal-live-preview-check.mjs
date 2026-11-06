// Disposable Preview-branch smoke check with invented text and image, no live source files.
import assert from 'node:assert/strict';
import {randomBytes, createHash} from 'node:crypto';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Pool} from 'pg';
import * as sdk from '@vercel/blob';
import {openStore,sourceHash} from '../server/journal-store.mjs';
import {initializePostgresSchema,openPostgresStore} from '../server/journal-postgres-store.mjs';
import {initializeBlobEnvironment,createBlobMedia} from '../server/journal-blob-media.mjs';
import {exportBundle} from './journal-migration.mjs';
import {importBundle,verifyImportedBundle} from './journal-import-postgres.mjs';
import {createJournalHandler} from '../server/journal-http.mjs';
import {renderJournalDocument} from '../dist-server/journal-entry.js';

const e=process.env;
const env='preview:periovox-journal-20261107';
const branch='preview/journal-runtime-20261107';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2uoAAAAASUVORK5CYII=','base64');
const email='journal-preview-smoke@example.invalid';
const language=(title,slug)=>({title,slug,body:'Synthetic test article.',summary:'Synthetic acceptance fixture.',seoTitle:title,seoDescription:'Synthetic acceptance fixture.',coverAlt:'Fictional pixel'});
const draft={es:language('Prueba ficticia del Journal','prueba-ficticia-journal'),en:language('Synthetic Journal smoke check','synthetic-journal-smoke'),category:'technology',author:'Synthetic fixture',reviewer:''};
const cookieFrom=r=>(r.headers.get('set-cookie')||'').split(';',1)[0];
let phase='guard',pool,dir,server;
try{
 assert.equal(e.VERCEL_ENV,'preview');
 assert.equal(e.VERCEL_GIT_COMMIT_REF,branch);
 assert.equal(hash([e.JOURNAL_PREVIEW_NEON_PROJECT_ID,e.JOURNAL_PREVIEW_BLOB_STORE_ID].join(':')),'75d711cf9c1a47d478a633f436a3a87186afcc9dca1f31d1318263b902fbdf4d');
 assert.equal(e.JOURNAL_PREVIEW_ENVIRONMENT_ID,env);
 assert.equal(e.NODEJS_HELPERS,'0');
 assert.equal(e.JOURNAL_BACKEND,'vercel');
 const connectionString=e.JOURNAL_PREVIEW_DATABASE_URL,token=e.JOURNAL_PREVIEW_BLOB_READ_WRITE_TOKEN;
 assert.ok(connectionString&&token);
 assert.ok(connectionString!==e.JOURNAL_PRODUCTION_DATABASE_URL&&token!==e.JOURNAL_PRODUCTION_BLOB_TOKEN);
 phase='setup';
 pool=new Pool({connectionString,max:3,connectionTimeoutMillis:10_000});
 const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()")).rows;
 if(!tables.length)await initializePostgresSchema(pool,env);
 const store=await openPostgresStore({pool,expectedEnvironment:env});
 await initializeBlobEnvironment({token,environment:env});
 const media=await createBlobMedia({token,expectedEnvironment:env});
 const completed=await store.getSetting('preview-smoke-completed');
 if(completed){
  const saved=JSON.parse(completed);
  assert.ok(await store.resolve('es',draft.es.slug));
  console.log('JOURNAL_PREVIEW_CHECK '+JSON.stringify({...saved,reused:true}));
 }else{
  phase='fixture';
  dir=mkdtempSync(path.join(realpathSync(tmpdir()),'journal-preview-fixture-'));
  const source=path.join(dir,'source'),bundle=path.join(dir,'bundle');
  const password=randomBytes(24).toString('hex');
  const filename='00000000-1111-2222-3333-444444444444.png';
  const sqlite=openStore(source);
  try{
   await sqlite.createUser(email,password);
   mkdirSync(path.join(source,'uploads'),{recursive:true,mode:0o700});
   writeFileSync(path.join(source,'uploads',filename),png,{mode:0o600,flag:'wx'});
   const saved=sqlite.save({...draft,cover:'/journal-media/'+filename,translationSourceHash:sourceHash(draft.es),translationBy:'manual'});
   sqlite.save({...saved,author:'Synthetic fixture, revised'},saved.revision);
  }finally{sqlite.close()}
  exportBundle(source,bundle,{offline:true});
  phase='import';
  const imported=await importBundle({bundle,pool,sdk,token,expectedEnvironment:env,confirmed:true});
  const verified=await verifyImportedBundle({bundle,pool,sdk,token,expectedEnvironment:env,confirmed:true});
  assert.equal(imported.sourceFingerprint,verified.sourceFingerprint);
  assert.equal(imported.counts.articles,1);
  assert.equal(imported.counts.revisions,1);
  assert.equal(imported.images,1);
  phase='http';
  let now=Date.now();
  const origin='https://synthetic-journal-preview.example.invalid';
  const service=createJournalHandler({root:process.cwd(),dataDir:path.join(dir,'unused'),store,media,preview:true,origin,allowedHosts:[new URL(origin).host],
   now:()=>now,settings:{apiKey:async()=>'',model:async()=>''},renderPage:props=>renderJournalDocument(props,process.cwd(),'')});
  server=createServer(async(req,res)=>{if(!await service.handler(req,res)){res.statusCode=404;res.end()}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const prefix='/api/journal';
  let cookie='',csrf='';
  async function call(url,{method='GET',status=200,body,headers={},auth=true}={}){
   const h={host:new URL(origin).host,origin,...headers};
   if(auth&&cookie){h.cookie=cookie;h['x-journal-csrf']=headers['x-journal-csrf']??csrf}
   if(body&&!Buffer.isBuffer(body)){h['content-type']='application/json';body=JSON.stringify(body)}
   const r=await new Promise((resolve,reject)=>{
    const outgoing=request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers:h,signal:AbortSignal.timeout(20000)},incoming=>{
     const bytes=[];
     incoming.on('data',c=>bytes.push(c));
     incoming.on('error',reject);
     incoming.on('end',()=>resolve(new Response(Buffer.concat(bytes),{status:incoming.statusCode,headers:incoming.headers})));
    });
    outgoing.on('error',reject);outgoing.end(body);
   });
   assert.equal(r.status,status);
   return r;
  }
  await (await call(prefix+'/articles',{auth:false,status:401})).json();
  const login=await call(prefix+'/login',{method:'POST',body:{email,password}});
  cookie=cookieFrom(login);csrf=(await login.json()).csrf;
  assert.ok(cookie.startsWith('pv_journal=')&&csrf);
  const items=(await (await call(prefix+'/articles')).json()).articles;
  assert.equal(items.length,1);
  const original=await call('/journal-media/'+filename);
  assert.equal(hash(Buffer.from(await original.arrayBuffer())),hash(png));
  await (await call(prefix+'/articles',{method:'POST',body:draft,status:403,headers:{'x-journal-csrf':'wrong'}})).json();
  const begin=await (await call(prefix+'/uploads/begin',{method:'POST',body:{size:png.length},status:201})).json();
  const chunk=await (await call(prefix+'/uploads/chunk?index=0',{method:'POST',body:png,status:201,headers:{'x-journal-upload':begin.ticket,'content-type':'application/octet-stream'}})).json();
  const cover=(await (await call(prefix+'/uploads/complete',{method:'POST',body:{ticket:begin.ticket,receipts:[chunk.receipt]},status:201})).json()).url;
  const uploaded=await call(cover);
  assert.equal(hash(Buffer.from(await uploaded.arrayBuffer())),hash(png));
  const item=items[0];
  const revised=(await (await call(prefix+'/articles/'+item.id,{method:'PUT',body:{...item,cover,author:'Synthetic preview editor'}})).json()).article;
  assert.ok(revised.revision>item.revision);
  const scheduled=(await (await call(prefix+'/articles/'+item.id+'/schedule',{method:'POST',body:{revision:revised.revision,publishAt:new Date(now+120000).toISOString(),bilingual:true}})).json()).article;
  assert.equal(scheduled.schedule.status,'pending');
  await (await call('/es/journal/'+draft.es.slug+'/',{status:404})).text();
  now+=121000;
  for(const [code,base] of [['es','/es/journal/'],['en','/journal/']]){
   const page=await call(base+draft[code].slug+'/');
   assert.match(page.headers.get('x-robots-tag')??'',/noindex/);
   assert.ok((await page.text()).includes(draft[code].title));
  }
  const sitemap=(await (await call('/sitemap-journal.xml')).text());
  assert.ok(sitemap.includes(draft.es.slug)&&sitemap.includes(draft.en.slug));
  await (await call(prefix+'/logout',{method:'POST',body:{}})).json();
  await (await call(prefix+'/articles',{status:401})).json();
  const report={realPostgres:true,realPrivateBlob:true,syntheticImport:true,editorSession:true,csrfRejection:true,exactUploadBytes:true,bilingualRoutes:2,scheduleOnDueRequest:true,sourceFingerprint:verified.sourceFingerprint};
  await store.setSetting('preview-smoke-completed',JSON.stringify(report));
  console.log('JOURNAL_PREVIEW_CHECK '+JSON.stringify(report));
 }
}catch(error){
 // HTTP/driver errors may include connection strings. Print only the stage and safe assertion codes.
 console.error('Journal Preview check failed:',phase,error.code==='ERR_ASSERTION'?'assertion':'operation');
 process.exitCode=1;
}finally{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 if(pool)await pool.end();
 if(dir)rmSync(dir,{recursive:true,force:true});
}
