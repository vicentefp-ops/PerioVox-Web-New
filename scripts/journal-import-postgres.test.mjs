import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {openStore} from '../server/journal-store.mjs';
import {initializePostgresSchema,openPostgresStore} from '../server/journal-postgres-store.mjs';
import {initializeBlobEnvironment} from '../server/journal-blob-media.mjs';
import {exportBundle} from './journal-migration.mjs';
import {importBundle,verifyImportedBundle} from './journal-import-postgres.mjs';
function poolFor(db){return {query:(sql,args)=>sql.includes('CREATE TABLE')?db.exec(sql).then(()=>({rows:[]})):db.query(sql,args),async connect(){return {...this,release(){}}}}}
async function fixture(t){
 const directory=mkdtempSync(path.join(tmpdir(),'pv-pg-import-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const source=path.join(directory,'source'),bundle=path.join(directory,'bundle');const sqlite=openStore(source);
 await sqlite.createUser('fictional@example.test','Only a test password');
 const filename='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png';mkdirSync(path.join(source,'uploads'));
 writeFileSync(path.join(source,'uploads',filename),Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));
 let article=sqlite.save({es:{title:'Fictional',slug:'fictional',body:'Synthetic'},cover:'/journal-media/'+filename});
 article=sqlite.save({...article,author:'Test'},article.revision);
 const snapshot={es:article.es,cover:article.cover,publishedAt:'2026-11-01T00:00:00.000Z'};
 article=sqlite.publish(article.id,article.revision,snapshot);
 article=sqlite.schedule(article.id,article.revision,snapshot,'2099-01-01T00:00:00Z',1);
 sqlite.newSession('fictional@example.test');sqlite.close();exportBundle(source,bundle,{offline:true});
 const db=new PGlite();t.after(()=>db.close());const pool=poolFor(db);await initializePostgresSchema(pool,'preview:fixture');
 const objects=new Map();let puts=0;
 const sdk={async list(){return {blobs:[...objects.keys()].map(pathname=>({pathname})),hasMore:false}},async get(key){const bytes=objects.get(key);return bytes?{statusCode:200,stream:new Blob([bytes]).stream()}:null},async put(key,bytes,options){assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);if(objects.has(key))throw Error('Already exists');objects.set(key,Buffer.from(bytes));puts++;return {pathname:key}}};
 await initializeBlobEnvironment({sdk,token:'fictional-token',environment:'preview:fixture'});puts=0;
 return {bundle,pool,sdk,token:'fictional-token',expectedEnvironment:'preview:fixture',confirmed:true,objects,puts:()=>puts,article};
}
test('offline import preserves exact values, credentials, schedules, aliases and image names',async t=>{
 const f=await fixture(t);const result=await importBundle(f);
 assert.equal(result.imported,true);assert.equal(result.images,1);assert.equal(result.counts.revisions,1);assert.equal(f.puts(),1);
 assert.equal((await f.pool.query('SELECT * FROM sessions')).rows.length,0);
 const verified=await verifyImportedBundle(f);assert.equal(verified.sourceFingerprint,result.sourceFingerprint);
 const store=await openPostgresStore({pool:f.pool,expectedEnvironment:f.expectedEnvironment});
 assert.equal(await store.authenticate('fictional@example.test','Only a test password'),true);
 const article=await store.get(f.article.id);assert.equal(article.revision,f.article.revision);assert.equal(article.schedule.publishAt,f.article.schedule.publishAt);
 assert.equal((await store.resolve('es','fictional')).es.title,'Fictional');
 await store.save({...article,author:'Next'},article.revision);assert.equal((await f.pool.query('SELECT id FROM revisions ORDER BY id')).rows.length,2);
 await assert.rejects(verifyImportedBundle(f),/fingerprint/);
});
test('offline import rejects missing consent, mismatched marker and nonempty target without media writes',async t=>{
 const f=await fixture(t);
 await assert.rejects(importBundle({...f,confirmed:false}),/confirmation/);
 await assert.rejects(importBundle({...f,expectedEnvironment:'production:fixture'}),/mismatch/);
 await f.pool.query("INSERT INTO journal_settings VALUES('existing','opaque')");
 await assert.rejects(importBundle(f),/not empty/);assert.equal(f.puts(),0);
});
test('offline import verifies media before DB changes and resumes partial identical media copies',async t=>{
 const f=await fixture(t);const originalGet=f.sdk.get;let fail=true;
 f.sdk.get=async key=>{if(key.startsWith('journal-media/')&&f.objects.has(key)&&fail)throw Error('Synthetic network failure');return originalGet(key)};
 await assert.rejects(importBundle(f),/Synthetic/);
 assert.equal((await f.pool.query('SELECT * FROM users')).rows.length,0);assert.equal(f.puts(),1);
 fail=false;const result=await importBundle(f);assert.equal(result.imported,true);assert.equal(f.puts(),1);
 await assert.rejects(importBundle(f),/not empty/);
 f.objects.set([...f.objects.keys()].find(key=>key.startsWith('journal-media/')),Buffer.from('tampered'));
 await assert.rejects(verifyImportedBundle(f),/fingerprint/);
});
test('offline import DB error rolls back every table, keeps media reusable, and retry succeeds',async t=>{
 const f=await fixture(t),connect=f.pool.connect.bind(f.pool);let fail=true;
 f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=async(sql,args)=>{if(fail&&sql.startsWith('INSERT INTO schedules'))throw Error('Synthetic SQL failure');return query(sql,args)};return client};
 await assert.rejects(importBundle(f),/Synthetic SQL/);
 for(const table of ['users','articles','revisions','schedules','slugs'])assert.equal((await f.pool.query('SELECT * FROM '+table)).rows.length,0);
 fail=false;assert.equal((await importBundle(f)).imported,true);assert.equal(f.puts(),1);
});


test('offline import and verification reject missing or wrong Blob markers before any media access',async t=>{
 const f=await fixture(t),get=f.sdk.get;let mediaReads=0;
 f.sdk.get=async key=>{if(key.startsWith('journal-media/'))mediaReads++;return get(key)};
 f.objects.delete('journal-environment.json');
 await assert.rejects(importBundle(f));await assert.rejects(verifyImportedBundle(f));
 await initializeBlobEnvironment({sdk:f.sdk,token:f.token,environment:'production:different-store'});
 const puts=f.puts();
 await assert.rejects(importBundle(f));await assert.rejects(verifyImportedBundle(f));
 assert.equal(f.puts(),puts);assert.equal(mediaReads,0);
 assert.equal((await f.pool.query('SELECT * FROM articles')).rows.length,0);
});
