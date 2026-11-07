import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {openPostgresStore,initializePostgresSchema} from './journal-postgres-store.mjs';

// PGlite runs real PostgreSQL SQL/transactions, but has one connection. Serialize
// leases in this test adapter; real pg pool multi-process locks need Neon staging QA.
function localPool(db) {
 let tail=Promise.resolve();
 async function connect() {
  const previous=tail;let release;
  tail=new Promise(resolve=>{release=resolve});await previous;
  return {async query(sql,values=[]) {
   if (sql.includes('CREATE TABLE')) {await db.exec(sql);return {rows:[]};}
   return db.query(sql,values);
  },release};
 }
 return {connect,async query(sql,values=[]) {const client=await connect();try{return await client.query(sql,values)}finally{client.release()}}};
}
async function fixture(t) {
 const db=new PGlite();const pool=localPool(db);t.after(()=>db.close());
 await initializePostgresSchema(pool,'preview');
 return {db,pool,store:await openPostgresStore({pool,expectedEnvironment:'preview'})};
}
const draft=(slug='test-article')=>({es:{title:'Fictional article',slug,summary:'Fictional',body:'Test only'},en:{title:'Fictional English',slug:slug+'-en',body:'Test'},cover:'',author:'Test'});
const snapshot=a=>({...draft(),es:a.es,en:a.en,publishedAt:'2026-11-02T11:00:00.000Z',modifiedAt:'2026-11-02T11:00:00.000Z'});

test('PostgreSQL startup fails closed before migration and on mismatched environments',async t=>{
 const db=new PGlite();const pool=localPool(db);t.after(()=>db.close());
 await assert.rejects(openPostgresStore({pool,expectedEnvironment:'preview'}));
 await assert.rejects(initializePostgresSchema(pool));
 await initializePostgresSchema(pool,'production');
 await assert.rejects(openPostgresStore({pool,expectedEnvironment:'preview'}),/mismatch/);
 await assert.rejects(initializePostgresSchema(pool,'preview'),/mismatch/);
 assert.equal((await pool.query('SELECT environment FROM journal_environment')).rows[0].environment,'production');
 await pool.query('DELETE FROM journal_environment');
 await assert.rejects(openPostgresStore({pool,expectedEnvironment:'production'}),/mismatch/);
});
test('PostgreSQL preserves private drafts, revisions, slugs and optimistic concurrency',async t=>{
 const {pool,store}=await fixture(t);let a=await store.save(draft());
 assert.equal((await store.list()).length,1);assert.equal(await store.resolve('es',a.es.slug),null);
 const concurrent=await Promise.allSettled([store.save({...a,author:'First'},a.revision),store.save({...a,author:'Second'},a.revision)]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(concurrent.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await pool.query('SELECT * FROM revisions')).rows.length,1);
 a=await store.get(a.id);a=await store.publish(a.id,a.revision,snapshot(a));
 const originalSlug=a.es.slug;a=await store.save({...a,es:{...a.es,title:'Private new title',slug:'renamed'}},a.revision);
 assert.equal((await store.resolve('es',originalSlug)).es.title,'Fictional article');
 a=await store.publish(a.id,a.revision,snapshot(a));
 assert.equal((await store.resolve('es',originalSlug)).es.slug,'renamed');
 const b=await store.save(draft(originalSlug));
 await assert.rejects(store.publish(b.id,b.revision,snapshot(b)),e=>e.status===409);
 assert.equal((await store.get(b.id)).published,null);
 await assert.rejects(store.unpublish(a.id,a.revision-1),e=>e.status===409);
 await store.unpublish(a.id,a.revision);assert.equal(await store.resolve('es',originalSlug),null);
 await pool.query('DELETE FROM journal_write_lock');
 await assert.rejects(store.save(draft()),/lock is missing/);
});
test('PostgreSQL scheduled snapshots reserve slugs, survive reopen, publish once and cancel on edit',async t=>{
 const {pool,store}=await fixture(t);const now=1000,due=2000;
 let a=await store.save(draft());a=await store.schedule(a.id,a.revision,snapshot(a),new Date(due).toISOString(),now);
 const b=await store.save(draft());
 await assert.rejects(store.schedule(b.id,b.revision,snapshot(b),new Date(due).toISOString(),now),/reservada/);
 assert.deepEqual(await store.publishDue(due-1),[]);assert.deepEqual(await store.published('es'),[]);
 const other=await openPostgresStore({pool,expectedEnvironment:'preview'});
 assert.equal((await other.get(a.id)).schedule.publishAt,new Date(due).toISOString());
 const results=await Promise.all([store.publishDue(due),other.publishDue(due)]);
 assert.deepEqual(results.flat(),[a.id]);assert.equal((await store.published('en')).length,1);
 a=await store.get(a.id);const oldPublished=a.published;
 a=await store.schedule(a.id,a.revision,{...snapshot(a),es:{...a.es,title:'Future'}},new Date(3000).toISOString(),due);
 assert.deepEqual((await store.get(a.id)).published,oldPublished);
 a=await store.save({...a,author:'Edited'},a.revision);assert.equal(a.schedule,null);
 assert.deepEqual(await store.publishDue(3000),[]);
 a=await store.schedule(a.id,a.revision,snapshot(a),new Date(4000).toISOString(),3000);
 await assert.rejects(store.cancelSchedule(a.id,a.revision-1),e=>e.status===409);
 a=await store.cancelSchedule(a.id,a.revision);assert.equal(a.schedule,null);
 await assert.rejects(store.schedule(a.id,a.revision,snapshot(a),'invalid',now),e=>e.status===400);
});
test('PostgreSQL due-job savepoints isolate corrupt snapshots and retain failed jobs for review',async t=>{
 const {pool,store}=await fixture(t);const a=await store.save(draft('a')),b=await store.save(draft('b'));
 for(const item of [a,b])await store.schedule(item.id,item.revision,snapshot(item),new Date(2000).toISOString(),1000);
 await pool.query('UPDATE schedules SET snapshot=$1 WHERE article_id=$2',['not-json',a.id]);
 assert.deepEqual(await store.publishDue(2000),[b.id]);
 assert.equal((await store.get(a.id)).schedule.status,'failed');
 assert.equal((await store.get(a.id)).published,null);
 assert.equal((await store.get(b.id)).schedule,null);
});
test('PostgreSQL user hashes, sessions, atomic rate counters and opaque settings persist',async t=>{
 const {pool,store}=await fixture(t);const email='fictional@example.test',password='Fictional test password only';
 assert.equal(await store.createUser(email,password),true);assert.equal(await store.createUser(email,'different'),false);
 assert.equal(await store.authenticate(email,password),true);assert.equal(await store.authenticate(email,'wrong'),false);assert.equal(await store.authenticate('absent@example.test',password),false);
 const user=(await pool.query('SELECT * FROM users')).rows[0];assert.equal(user.password_hash.length,128);assert.notEqual(user.password_hash,password);
 const session=await store.newSession(email);assert.equal((await store.session(session.token)).csrf,session.csrf);
 assert.notEqual((await pool.query('SELECT token_hash FROM sessions')).rows[0].token_hash,session.token);
 await store.logout(session.token);assert.equal(await store.session(session.token),null);
 const expired=await store.newSession(email);await pool.query('UPDATE sessions SET expires=0');assert.equal(await store.session(expired.token),null);
 const attempts=await Promise.all(Array.from({length:8},()=>store.attempt('fictional-ip')));assert.deepEqual(attempts.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
 await pool.query('UPDATE attempts SET expires=0');assert.equal(await store.attempt('fictional-ip'),1);
 await store.clearAttempts('fictional-ip');assert.equal(await store.attempt('fictional-ip'),1);
 assert.equal(await store.getSetting('gemini'),null);await store.setSetting('gemini','opaque-encrypted-test-value');assert.equal(await store.getSetting('gemini'),'opaque-encrypted-test-value');
});

test('PostgreSQL competing publications/schedules cannot acquire the same slug',async t=>{
 const {pool,store}=await fixture(t);const other=await openPostgresStore({pool,expectedEnvironment:'preview'});
 const a=await store.save(draft('shared')),b=await store.save(draft('shared'));
 const race=await Promise.allSettled([
  store.publish(a.id,a.revision,snapshot(a)),
  other.schedule(b.id,b.revision,snapshot(b),new Date(3000).toISOString(),1000)
 ]);
 assert.equal(race.filter(item=>item.status==='fulfilled').length,1);
 assert.equal(race.find(item=>item.status==='rejected').reason.status,409);
 assert.equal((await store.get(a.id)).published.es.slug,'shared');
 assert.equal((await other.get(b.id)).schedule,null);
});
test('PostgreSQL savepoint rolls back partial language writes when due publication hits SQL failure',async t=>{
 const {pool,store}=await fixture(t);const a=await store.save(draft('atomic'));
 await store.schedule(a.id,a.revision,snapshot(a),new Date(2000).toISOString(),1000);
 await pool.query('UPDATE schedules SET snapshot=$1 WHERE article_id=$2',[JSON.stringify({...snapshot(a),en:{title:'Invalid imported snapshot without slug'}}),a.id]);
 assert.deepEqual(await store.publishDue(2000),[]);
 assert.equal((await store.get(a.id)).schedule.status,'failed');
 assert.equal((await store.get(a.id)).published,null);
 assert.equal((await pool.query('SELECT * FROM slugs WHERE article_id=$1',[a.id])).rows.length,0);
});

test('durable alarms reject stale generations, cancel safely and publish once under duplicate delivery',async t=>{
 const {store}=await fixture(t);
 const alarms=[];
 const arm=alarm=>{alarms.push(alarm);return 'fictional-run-'+alarms.length};
 const scheduledAt=new Date(2000).toISOString();
 let a=await store.save(draft('workflow'));
 await assert.rejects(store.schedule(a.id,a.revision,snapshot(a),scheduledAt,1000,()=>''),/acknowledgement/);
 assert.equal((await store.get(a.id)).schedule,null);
 a=await store.schedule(a.id,a.revision,snapshot(a),scheduledAt,1000,arm);
 a=await store.schedule(a.id,a.revision,snapshot(a),scheduledAt,1000,arm);
 assert.deepEqual(await store.publishDue(2000,alarms[0]),[]);
 assert.deepEqual(await store.publishDue(1999,alarms[1]),[]);
 assert.equal((await store.get(a.id)).published,null);
 await store.setSetting('workflow-pause-publication','yes');
 assert.deepEqual(await store.publishDue(2000,alarms[1]),[]);
 assert.deepEqual(await store.publishDue(2000),[]);
 await store.setSetting('workflow-pause-publication','no');
 assert.deepEqual((await Promise.all([store.publishDue(2000,alarms[1]),store.publishDue(2000,alarms[1])])).flat(),[a.id]);
 assert.equal((await store.get(a.id)).revision,a.revision+1);
 let b=await store.save(draft('cancel-workflow'));
 b=await store.schedule(b.id,b.revision,snapshot(b),scheduledAt,1000,arm);
 await store.cancelSchedule(b.id,b.revision);
 assert.deepEqual(await store.publishDue(2000,alarms[2]),[]);
 assert.equal((await store.get(b.id)).published,null);
});
