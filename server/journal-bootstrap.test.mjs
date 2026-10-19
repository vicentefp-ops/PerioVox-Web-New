import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {createCipheriv,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {openStore} from './journal-store.mjs';
import {initializeJournalStorage} from './journal-bootstrap.mjs';
const encrypt=(data,key)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv),bytes=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes])};
test('encrypted migration preserves articles and credentials and never replaces persistent data',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'periovox-migration-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=openStore(path.join(root,'source'));source.save({es:{title:'Fictional migration test'}});source.newSession('fictional@example.test');source.close();
 const bytes=await readFile(path.join(root,'source/journal.sqlite')),key=randomBytes(32).toString('hex'),seedPath=path.join(root,'seed.enc'),directory=path.join(root,'persistent');
 await writeFile(seedPath,encrypt({files:[{path:'journal.sqlite',data:bytes.toString('base64')},{path:'gemini.key',data:Buffer.from('fake-server-key').toString('base64')},{path:'uploads/ab12-cd34.png',data:Buffer.from('fictional-image').toString('base64')}]},key));
 await mkdir(directory);assert.equal(await initializeJournalStorage({directory,seedPath,key}),true);
 const db=new DatabaseSync(path.join(directory,'journal.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM articles').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);db.close();
 assert.equal(await readFile(path.join(directory,'gemini.key'),'utf8'),'fake-server-key');
 await writeFile(path.join(directory,'gemini.key'),'newer-server-key');assert.equal(await initializeJournalStorage({directory,seedPath,key:'invalid'}),false);assert.equal(await readFile(path.join(directory,'gemini.key'),'utf8'),'newer-server-key');
});
test('a tampered or traversing migration cannot create persistent files',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'periovox-migration-invalid-'));t.after(()=>rm(root,{recursive:true,force:true}));const key=randomBytes(32).toString('hex'),seedPath=path.join(root,'seed.enc'),directory=path.join(root,'persistent');
 await writeFile(seedPath,encrypt({files:[{path:'journal.sqlite',data:''},{path:'../escape',data:'eA=='}]},key));
 await assert.rejects(()=>initializeJournalStorage({directory,seedPath,key}),/Invalid migration file/);
 const bad=await readFile(seedPath);bad[bad.length-1]^=1;await writeFile(seedPath,bad);await assert.rejects(()=>initializeJournalStorage({directory,seedPath,key}));
 await assert.rejects(()=>readFile(path.join(root,'escape')));await assert.rejects(()=>readFile(path.join(directory,'journal.sqlite')));
});
