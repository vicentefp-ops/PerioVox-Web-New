import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../server/journal-store.mjs';
import {inventory,exportBundle,verify,compare} from './journal-migration.mjs';

function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'journal-export-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),out=path.join(root,'export');const store=openStore(source);
 const es={title:'Synthetic draft',slug:'old-slug',content:'<img src="/journal-media/ab12-cd34.png">'};
 let article=store.save({es,en:{...es,slug:'english-slug'},cover:'/journal-media/ab12-cd34.png'});
 article=store.publish(article.id,article.revision,{es,en:{...es,slug:'english-slug'},publishedAt:'2026-01-01T00:00:00.000Z'});
 article=store.save({...article,es:{...es,title:'Revised draft'}},article.revision);
 store.schedule(article.id,article.revision,{es:{...es,slug:'future-slug'},en:{...es,slug:'future-english'}},'2099-01-01T00:00:00.000Z');
 store.db.prepare('INSERT INTO users VALUES(?,?,?)').run('synthetic@example.invalid','fake-salt-only','fake-password-hash-only');
 store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('fake-token-only','synthetic@example.invalid','fake-csrf-only',1);
 store.db.prepare('INSERT INTO attempts VALUES(?,?,?)').run('192.0.2.1',2,1);
 fs.mkdirSync(path.join(source,'uploads'));fs.writeFileSync(path.join(source,'uploads/ab12-cd34.png'),'synthetic-image-only');
 fs.writeFileSync(path.join(source,'gemini.key'),'fake-api-key-only');
 fs.writeFileSync(path.join(source,'gemini-model.txt'),'synthetic-model');
 t.after(()=>{try{store.close()}catch{}});
 return {root,source,out,store};
}
test('WAL-aware export preserves all durable rows, hashes and private modes without source writes',t=>{
 const f=fixture(t); // Keep the source connection open to exercise uncheckpointed WAL.
 const before=fs.readFileSync(path.join(f.source,'journal.sqlite'));
 const beforeWal=fs.readFileSync(path.join(f.source,'journal.sqlite-wal'));
 const beforeSettings=['gemini.key','gemini-model.txt'].map(name=>fs.readFileSync(path.join(f.source,name)));
 const report=exportBundle(f.source,f.out,{offline:true});
 assert.equal(report.tables.articles.count,1);assert.equal(report.tables.revisions.count,1);assert.equal(report.tables.schedules.count,1);assert.equal(report.tables.slugs.count,2);
 assert.equal(compare(f.source,f.out).matches,true);assert.deepEqual(verify(f.out),report);
 assert.deepEqual(fs.readFileSync(path.join(f.source,'journal.sqlite')),before);
 assert.deepEqual(fs.readFileSync(path.join(f.source,'journal.sqlite-wal')),beforeWal);
 assert.deepEqual(['gemini.key','gemini-model.txt'].map(name=>fs.readFileSync(path.join(f.source,name))),beforeSettings);
 const db=new DatabaseSync(path.join(f.out,'journal.sqlite'),{readOnly:true});
 try {
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name),['articles','revisions','schedules','slugs','users']);
  assert.equal(db.prepare('SELECT password_hash FROM users').get().password_hash,'fake-password-hash-only');
  assert.equal(db.prepare('SELECT publish_at FROM schedules').get().publish_at,'2099-01-01T00:00:00.000Z');
 }finally{db.close()}
 assert.equal(fs.statSync(f.out).mode&0o777,0o700);
 for(const name of ['journal.sqlite','manifest.json','uploads/ab12-cd34.png']) assert.equal(fs.statSync(path.join(f.out,name)).mode&0o777,0o600);
 assert(!fs.existsSync(path.join(f.out,'gemini.key')));
 const manifest=fs.readFileSync(path.join(f.out,'manifest.json'),'utf8');
 for(const secret of ['fake-password-hash-only','fake-api-key-only','fake-token-only','fake-csrf-only','synthetic@example.invalid']) assert(!manifest.includes(secret));
 assert(!fs.readFileSync(path.join(f.out,'journal.sqlite')).includes(Buffer.from('fake-api-key-only')));
});
test('requires offline acknowledgement, fresh separate destination',t=>{
 const f=fixture(t);assert.throws(()=>exportBundle(f.source,f.out),/offline/);
 assert.throws(()=>exportBundle(f.source,path.join(f.source,'export'),{offline:true}),/separate/);
 fs.mkdirSync(f.out);assert.throws(()=>exportBundle(f.source,f.out,{offline:true}),/not exist/);
});
test('rejects symlink root, ancestors, uploads, hardlinks and unexpected paths',t=>{
 const f=fixture(t);const link=path.join(f.root,'link');fs.symlinkSync(f.source,link);
 assert.throws(()=>inventory(link),/Symbolic/);
 assert.throws(()=>exportBundle(f.source,path.join(link,'result'),{offline:true}),/Symbolic/);
 const image=path.join(f.source,'uploads/ab12-cd34.png');fs.unlinkSync(image);fs.symlinkSync(path.join(f.source,'gemini.key'),image);assert.throws(()=>inventory(f.source),/Symbolic/);
 fs.unlinkSync(image);fs.linkSync(path.join(f.source,'gemini.key'),image);assert.throws(()=>inventory(f.source),/hardlinked|Unsafe/);
 fs.unlinkSync(image);fs.writeFileSync(image,'synthetic-image-only');fs.writeFileSync(path.join(f.source,'unexpected.env'),'synthetic');assert.throws(()=>inventory(f.source),/Unexpected/);
});
test('detects missing images, broken JSON, orphan rows and schema drift',t=>{
 const f=fixture(t);const image=path.join(f.source,'uploads/ab12-cd34.png');fs.unlinkSync(image);assert.throws(()=>inventory(f.source),/Missing/);fs.writeFileSync(image,'synthetic-image-only');
 f.store.db.prepare('UPDATE articles SET draft=?').run('not JSON');assert.throws(()=>inventory(f.source),/JSON/);
 f.store.db.prepare('UPDATE articles SET draft=?').run('{}');f.store.db.prepare('INSERT INTO slugs VALUES(?,?,?)').run('es','orphan','absent');assert.throws(()=>inventory(f.source),/Orphaned/);
 f.store.db.prepare('DELETE FROM slugs WHERE article_id=?').run('absent');f.store.db.exec('CREATE TABLE surprise(secret TEXT)');assert.throws(()=>inventory(f.source),/schema/);
});
test('verifies tampering and detects durable source changes',t=>{
 const f=fixture(t);exportBundle(f.source,f.out,{offline:true});
 f.store.db.prepare('UPDATE articles SET revision=revision+1').run();assert.throws(()=>compare(f.source,f.out),/differ/);
 fs.writeFileSync(path.join(f.out,'uploads/ab12-cd34.png'),'changed');assert.throws(()=>verify(f.out),/Manifest/);
});
test('rejects malformed SQLite, bundle extras and logs no secrets on CLI failure',t=>{
 const f=fixture(t);exportBundle(f.source,f.out,{offline:true});fs.writeFileSync(path.join(f.out,'gemini.key'),'fake-secret-value');assert.throws(()=>verify(f.out),/Unexpected/);
 const result=spawnSync(process.execPath,['scripts/journal-migration.mjs','verify',f.out],{encoding:'utf8'});
 assert.equal(result.status,1);assert(!result.stderr.includes('fake-secret-value'));assert.equal(result.stdout,'');
 fs.unlinkSync(path.join(f.out,'gemini.key'));fs.writeFileSync(path.join(f.out,'journal.sqlite'),'not SQLite');assert.throws(()=>verify(f.out));
});
test('failed export cleans its own new output and never rewrites source',t=>{
 const f=fixture(t);
 // A schema with missing source constraints can contain duplicate identities;
 // the destination constraints must reject this rather than silently dropping data.
 f.store.db.exec("DROP TABLE users; CREATE TABLE users(email TEXT,salt TEXT,password_hash TEXT); INSERT INTO users VALUES('duplicate','salt','hash'),('duplicate','salt','hash')");
 assert.throws(()=>exportBundle(f.source,f.out,{offline:true}));
 assert.equal(fs.existsSync(f.out),false);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM users').get().n,2);
});
test('transient activity is intentionally ignored by durable comparison',t=>{
 const f=fixture(t);exportBundle(f.source,f.out,{offline:true});
 f.store.db.prepare('UPDATE attempts SET count=count+1').run();
 f.store.db.prepare('DELETE FROM sessions').run();
 fs.writeFileSync(path.join(f.source,'gemini.key'),'another-synthetic-key');
 assert.equal(compare(f.source,f.out).matches,true);
 const bytes=fs.readFileSync(path.join(f.out,'journal.sqlite'));
 for(const forbidden of ['fake-token-only','fake-csrf-only','fake-api-key-only','192.0.2.1']) assert(!bytes.includes(Buffer.from(forbidden)));
});
