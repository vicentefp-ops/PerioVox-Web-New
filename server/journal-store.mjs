import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,scrypt,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const sourceHash=es=>digest(JSON.stringify(es));
export function openStore(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
 const file=path.join(directory,'journal.sqlite');const db=new DatabaseSync(file);chmodSync(file,0o600);
 // One-time migration backup includes the WAL state and remains private outside deployment.
 if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='articles'").get()&&!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schedules'").get()){
  const backup=path.join(directory,'journal-before-scheduling-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
  db.prepare('VACUUM INTO ?').run(backup);chmodSync(backup,0o600);
 }
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY,draft TEXT NOT NULL,published TEXT,revision INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,article_id TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS schedules(article_id TEXT PRIMARY KEY,publish_at TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT);
 CREATE INDEX IF NOT EXISTS schedules_due ON schedules(status,publish_at);
 CREATE TABLE IF NOT EXISTS slugs(language TEXT NOT NULL,slug TEXT NOT NULL,article_id TEXT NOT NULL,PRIMARY KEY(language,slug));`);
 const schedule=id=>{const row=db.prepare('SELECT publish_at,status,error FROM schedules WHERE article_id=?').get(id);return row?{publishAt:row.publish_at,status:row.status,error:row.error}:null};
 const unpack=row=>row?{...JSON.parse(row.draft),schedule:schedule(row.id),id:row.id,revision:row.revision,updated:row.updated,published:row.published?JSON.parse(row.published):null}:null;
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(error){db.exec('ROLLBACK');throw error}}
 function checkSlugs(id,snapshot){
  for(const lang of ['es','en'])if(snapshot[lang]){
   const slug=snapshot[lang].slug,owner=db.prepare('SELECT article_id FROM slugs WHERE language=? AND slug=?').get(lang,slug);
   if(owner&&owner.article_id!==id)throw Object.assign(new Error('Esa dirección ya pertenece a otro artículo. Cambia la URL.'),{status:409});
   for(const pending of db.prepare("SELECT article_id,snapshot FROM schedules WHERE status='pending' AND article_id<>?").all(id))if(JSON.parse(pending.snapshot)[lang]?.slug===slug)throw Object.assign(new Error('Esa dirección está reservada por un artículo programado.'),{status:409});
  }
 }
 function writePublication(id,snapshot){
  checkSlugs(id,snapshot);
  for(const lang of ['es','en'])if(snapshot[lang])db.prepare('INSERT OR IGNORE INTO slugs VALUES(?,?,?)').run(lang,snapshot[lang].slug,id);
  db.prepare('UPDATE articles SET published=?,revision=revision+1 WHERE id=?').run(JSON.stringify(snapshot),id);
  db.prepare('DELETE FROM schedules WHERE article_id=?').run(id);
 }
 return {
  db,directory,close:()=>db.close(),
  async createUser(email,password){if(db.prepare('SELECT email FROM users WHERE email=?').get(email))return false;const salt=randomBytes(32).toString('hex');const hash=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});db.prepare('INSERT INTO users VALUES(?,?,?)').run(email,salt,hash.toString('hex'));return true},
  async authenticate(email,password){const row=db.prepare('SELECT * FROM users WHERE email=?').get(email);const hash=await derive(password,row?.salt??'missing-user-timing-padding',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return !!row&&timingSafeEqual(hash,Buffer.from(row.password_hash,'hex'))},
  session(token){db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());if(!token)return null;return db.prepare('SELECT email,csrf,expires FROM sessions WHERE token_hash=? AND expires>?').get(digest(token),Date.now())??null},
  newSession(email){const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),email,csrf,Date.now()+12*3600_000);return {token,csrf}},
  logout(token){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token??''))},
  attempt(ip){db.prepare('DELETE FROM attempts WHERE expires<?').run(Date.now());db.prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=count+1').run(ip,Date.now()+15*60_000);return db.prepare('SELECT count FROM attempts WHERE ip=?').get(ip).count},
  clearAttempts(ip){db.prepare('DELETE FROM attempts WHERE ip=?').run(ip)},
  list(){return db.prepare('SELECT * FROM articles ORDER BY updated DESC').all().map(unpack)},
  get(id){return unpack(db.prepare('SELECT * FROM articles WHERE id=?').get(id))},
  save(draft,expectedRevision){return transaction(()=>{
   const id=draft.id??randomUUID(),previous=db.prepare('SELECT * FROM articles WHERE id=?').get(id);
   if(previous&&previous.revision!==expectedRevision)throw Object.assign(new Error('El artículo ha cambiado. Recárgalo antes de guardar para no perder cambios.'),{status:409});
   if(!previous&&draft.id)throw Object.assign(new Error('Artículo no encontrado.'),{status:404});
   const now=new Date().toISOString();const {id:ignored,revision,published,updated,schedule:ignoredSchedule,...body}=draft;
   if(previous)db.prepare('INSERT INTO revisions(article_id,body,created) VALUES(?,?,?)').run(id,previous.draft,now);
   db.prepare('INSERT INTO articles(id,draft,revision,updated) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET draft=excluded.draft,revision=articles.revision+1,updated=excluded.updated').run(id,JSON.stringify(body),now);
   db.prepare('DELETE FROM schedules WHERE article_id=?').run(id);
   return this.get(id);
  })},
  publish(id,expectedRevision,snapshot){return transaction(()=>{
   const row=db.prepare('SELECT * FROM articles WHERE id=?').get(id);if(!row||row.revision!==expectedRevision)throw Object.assign(new Error('El borrador ha cambiado. Guárdalo de nuevo antes de publicar.'),{status:409});
   writePublication(id,snapshot);return this.get(id);
  })},
  schedule(id,expectedRevision,snapshot,publishAt,now=Date.now()){return transaction(()=>{
   const date=Date.parse(publishAt);
   if(!Number.isFinite(date)||date<=now)throw Object.assign(new Error('Elige una fecha y hora futura.'),{status:400});
   const row=db.prepare('SELECT revision FROM articles WHERE id=?').get(id);
   if(!row||row.revision!==expectedRevision)throw Object.assign(new Error('El borrador ha cambiado. Recárgalo antes de programar.'),{status:409});
   checkSlugs(id,snapshot);
   db.prepare("INSERT INTO schedules(article_id,publish_at,snapshot,status,error) VALUES(?,?,?,'pending',NULL) ON CONFLICT(article_id) DO UPDATE SET publish_at=excluded.publish_at,snapshot=excluded.snapshot,status='pending',error=NULL").run(id,new Date(date).toISOString(),JSON.stringify(snapshot));
   db.prepare('UPDATE articles SET revision=revision+1 WHERE id=?').run(id);return this.get(id);
  })},
  cancelSchedule(id,expectedRevision){return transaction(()=>{
   const row=db.prepare('SELECT revision FROM articles WHERE id=?').get(id);
   if(!row||row.revision!==expectedRevision)throw Object.assign(new Error('El artículo ha cambiado. Recárgalo antes de cancelar.'),{status:409});
   db.prepare('DELETE FROM schedules WHERE article_id=?').run(id);db.prepare('UPDATE articles SET revision=revision+1 WHERE id=?').run(id);return this.get(id);
  })},
  publishDue(now=Date.now()){return transaction(()=>{
   const published=[];
   for(const row of db.prepare("SELECT * FROM schedules WHERE status='pending' AND publish_at<=? ORDER BY publish_at").all(new Date(now).toISOString())){
    // No network calls at publication time: the validated bilingual snapshot is durable.
    db.exec('SAVEPOINT scheduled_publication');
    try{writePublication(row.article_id,JSON.parse(row.snapshot));db.exec('RELEASE scheduled_publication');published.push(row.article_id)}
    catch(e){db.exec('ROLLBACK TO scheduled_publication; RELEASE scheduled_publication');db.prepare("UPDATE schedules SET status='failed',error=? WHERE article_id=?").run(e.status?e.message:'No se ha podido publicar. Revisa el artículo y vuelve a programarlo.',row.article_id)}
   }
   return published;
  })},
  unpublish(id,expectedRevision){return transaction(()=>{if(expectedRevision!==undefined&&this.get(id)?.revision!==expectedRevision)throw Object.assign(new Error('El artículo ha cambiado. Recárgalo antes de retirar.'),{status:409});db.prepare('DELETE FROM schedules WHERE article_id=?').run(id);db.prepare('UPDATE articles SET published=NULL,revision=revision+1 WHERE id=?').run(id);return this.get(id)})},
  published(lang){return this.list().filter(a=>a.published?.[lang]).map(a=>({id:a.id,...a.published,language:lang})).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))},
  resolve(lang,slug){const row=db.prepare('SELECT article_id FROM slugs WHERE language=? AND slug=?').get(lang,slug);const article=row?this.get(row.article_id):null;return article?.published?.[lang]?{id:article.id,...article.published,language:lang}:null}
 };
}
