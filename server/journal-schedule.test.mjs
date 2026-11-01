import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {openStore,sourceHash} from './journal-store.mjs';
import {createJournalHandler} from './journal-http.mjs';
import {madridInput,madridToUTC} from '../src/journal-schedule.ts';
const text={title:'Noticia ficticia',summary:'Subtítulo ficticio.',body:'Contenido exclusivamente ficticio.',slug:'noticia-ficticia',seoTitle:'Noticia ficticia',seoDescription:'Descripción ficticia.',coverAlt:''};
const draft=()=>({es:{...text},en:{...text,slug:'fictional-news'},translationSourceHash:sourceHash(text),category:'news',author:'Editor de prueba',reviewer:'',cover:''});
const snapshot=article=>({es:article.es,en:article.en,author:article.author,category:'news',cover:'',publishedAt:'2026-11-02T11:00:00.000Z',modifiedAt:'2026-11-02T11:00:00.000Z'});

test('Madrid wall times are independent of machine timezone and reject DST gaps/ambiguities',()=>{
 assert.equal(madridToUTC('2026-11-02T12:00'),'2026-11-02T11:00:00.000Z');
 assert.equal(madridToUTC('2027-07-02T12:00'),'2027-07-02T10:00:00.000Z');
 assert.equal(madridInput('2026-11-02T11:00:00Z'),'2026-11-02T12:00');
 assert.throws(()=>madridToUTC('2027-03-28T02:30'),/no existe/);
 assert.throws(()=>madridToUTC('2027-10-31T02:30'),/se repite/);
 assert.throws(()=>madridToUTC('2026-02-30T12:00'),/no existe/);
});
test('durable schedules publish exactly once after restart, never early, in both languages',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pv-schedules-'));let store=openStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true})});
 const now=Date.parse('2026-11-01T20:00:00Z'),due=Date.parse('2026-11-02T11:00:00Z');let article=store.save(draft());
 article=store.schedule(article.id,article.revision,snapshot(article),new Date(due).toISOString(),now);
 assert.equal(store.published('es').length,0);assert.equal(store.resolve('es',text.slug),null);assert.deepEqual(store.publishDue(due-1),[]);
 store.close();store=openStore(directory);assert.equal(store.get(article.id).schedule.publishAt,new Date(due).toISOString());
 const other=openStore(directory);t.after(()=>other.close());
 assert.deepEqual(store.publishDue(due),[article.id]);assert.deepEqual(other.publishDue(due),[]);
 assert.equal(store.published('es').length,1);assert.equal(store.published('en').length,1);assert.equal(store.get(article.id).schedule,null);
 assert.equal(store.resolve('es',text.slug).es.body,text.body);assert.equal(store.resolve('en','fictional-news').en.slug,'fictional-news');
 assert.equal(store.get(article.id).published.publishedAt,new Date(due).toISOString());
});
test('cancel, editing, unpublish, slug reservations and optimistic locking protect scheduled content',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pv-schedules-cancel-'));const store=openStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true})});
 const now=Date.parse('2026-11-01T20:00:00Z'),due='2026-11-02T11:00:00Z';let article=store.save(draft());const oldRevision=article.revision;
 assert.throws(()=>store.schedule(article.id,article.revision,snapshot(article),'invalid',now));
 assert.throws(()=>store.schedule(article.id,article.revision,snapshot(article),new Date(now).toISOString(),now));
 article=store.schedule(article.id,article.revision,snapshot(article),due,now);
 assert.throws(()=>store.cancelSchedule(article.id,oldRevision),/ha cambiado/);
 const duplicate=store.save(draft());assert.throws(()=>store.publish(duplicate.id,duplicate.revision,snapshot(duplicate)),/reservada/);
 article=store.cancelSchedule(article.id,article.revision);assert.equal(article.schedule,null);
 article=store.schedule(article.id,article.revision,snapshot(article),due,now);
 article=store.save({...article,es:{...article.es,title:'Edición privada'}},article.revision);assert.equal(article.schedule,null);assert.deepEqual(store.publishDue(Date.parse(due)),[]);
 article=store.publish(article.id,article.revision,snapshot(article));const published=article.published;
 article=store.schedule(article.id,article.revision,{...snapshot(article),es:{...article.es,title:'Revisión futura'}},due,now);
 assert.deepEqual(store.get(article.id).published,published,'Scheduling an update preserves the live version');
 store.unpublish(article.id);assert.deepEqual(store.publishDue(Date.parse(due)),[]);assert.equal(store.get(article.id).published,null);
});
test('authenticated scheduling API validates dates, recovers due jobs on reads and rejects CSRF',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pv-schedule-api-'));let clock=Date.parse('2026-11-01T20:00:00Z');const service=createJournalHandler({root:path.resolve('.'),dataDir:directory,now:()=>clock,renderPage:async props=>JSON.stringify(props)});t.after(async()=>{service.store.close();await rm(directory,{recursive:true,force:true})});
 const session=service.store.newSession('fictional@example.test');let authorized=true;
 async function call(url,method='GET',body,headers={}){const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.url=url;req.method=method;req.headers={host:'localhost:3201',origin:'http://localhost:3201','content-type':'application/json',...(authorized?{cookie:'pv_journal='+session.token,'x-journal-csrf':session.csrf}:{}),...headers};req.socket={remoteAddress:'127.0.0.1'};let output='';const res={statusCode:200,headersSent:false,setHeader(){},end(value=''){output+=value;this.headersSent=true}};await service.handler(req,res);let data;try{data=JSON.parse(output)}catch{}return {status:res.statusCode,data,output}}
 let article=(await call('/api/journal/articles','POST',draft())).data.article;const endpoint='/api/journal/articles/'+article.id;
 authorized=false;assert.equal((await call(endpoint+'/schedule','POST',{revision:article.revision,publishAt:'2026-11-02T11:00:00Z'})).status,401);authorized=true;
 assert.equal((await call(endpoint+'/schedule','POST',{revision:article.revision,publishAt:'2026-11-02T11:00:00Z'},{'x-journal-csrf':'bad'})).status,403);
 for(const publishAt of ['bad','2026-11-02T12:00','2026-10-01T12:00:00Z'])assert.equal((await call(endpoint+'/schedule','POST',{revision:article.revision,publishAt})).status,400);
 const scheduled=await call(endpoint+'/schedule','POST',{revision:article.revision,publishAt:'2026-11-02T12:00:00+01:00'});assert.equal(scheduled.status,200);article=scheduled.data.article;
 assert.equal(article.schedule.publishAt,'2026-11-02T11:00:00.000Z');assert.equal((await call('/es/journal/'+text.slug+'/')).status,404);
 clock=Date.parse('2026-11-02T11:00:00Z');authorized=false;
 assert.equal((await call('/es/journal/'+text.slug+'/')).status,200,'Public request recovers a due job even after worker sleep');
 assert.match((await call('/sitemap-journal.xml')).output,/noticia-ficticia/);
 assert.equal(service.store.get(article.id).schedule,null);
});
