#!/usr/bin/env node
// Offline, dependency-free preparation only. Never imports the serving application.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';

const tables = {
 users: ['email','salt','password_hash'],
 articles: ['id','draft','published','revision','updated'],
 revisions: ['id','article_id','body','created'],
 schedules: ['article_id','publish_at','snapshot','status','error'],
 slugs: ['language','slug','article_id'],
};
const transient = {sessions:['token_hash','email','csrf','expires'], attempts:['ip','count','expires']};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => {throw new Error(message)};
const encode = value => JSON.stringify(value);
function safePath(input) {
 const absolute = path.resolve(input);
 let current = path.parse(absolute).root;
 for (const component of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
  current = path.join(current, component);
  if(fs.lstatSync(current).isSymbolicLink()) fail('Symbolic links are forbidden.');
 }
 return absolute;
}
function readRegular(file) {
 safePath(file);
 const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
 try {const st=fs.fstatSync(fd); if(!st.isFile()||st.nlink!==1) fail('Only regular, non-hardlinked files are allowed.'); return fs.readFileSync(fd)} finally {fs.closeSync(fd)}
}
function tree(directory, bundle=false) {
 const root=safePath(directory); if(!fs.statSync(root).isDirectory()) fail('Expected a directory.');
 const images=[];
 for(const name of fs.readdirSync(root).sort()) {
  const file=path.join(root,name); const st=fs.lstatSync(file);
  if(st.isSymbolicLink()||(!st.isDirectory()&&(!st.isFile()||st.nlink!==1))) fail('Unsafe filesystem entry.');
  if(name==='uploads'&&st.isDirectory()) {
   for(const image of fs.readdirSync(file).sort()) {
    if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(image)) fail('Unexpected upload path.');
    const bytes=readRegular(path.join(file,image)); images.push({path:'uploads/'+image,bytes:bytes.length,sha256:sha(bytes)});
   }
  } else if(st.isDirectory()) fail('Unexpected directory.');
  else if(bundle ? !['journal.sqlite','manifest.json'].includes(name) : !/^(journal\.sqlite(?:-wal|-shm)?|journal-before-scheduling-[\dTZ.:-]+\.sqlite|gemini\.key|gemini-model\.txt)$/.test(name)) fail('Unexpected runtime file.');
 }
 readRegular(path.join(root,'journal.sqlite'));
 return {root,images};
}
function inspectDatabase(file, bundle=false) {
 const db=new DatabaseSync(file,{readOnly:true});
 try {
  db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; BEGIN');
  if(db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok')) fail('SQLite integrity check failed.');
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
  const expected=Object.keys(bundle?tables:{...tables,...transient}).sort();
  if(encode(names)!==encode(expected)) fail('Unexpected or incomplete database schema.');
  if(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type IN ('trigger','view')").get().n) fail('Unexpected executable database schema.');
  for(const name of expected) {
   const columns=db.prepare(`PRAGMA table_info("${name}")`).all().map(r=>r.name);
   if(encode(columns)!==encode((tables[name]||transient[name]))) fail('Unexpected database columns.');
  }
  const rows={};
  for(const [name,columns] of Object.entries(tables)) rows[name]=db.prepare(`SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM "${name}" ORDER BY ${columns.map(c=>'"'+c+'"').join(',')}`).all();
  const ids=new Set(rows.articles.map(r=>r.id));
  for(const name of ['revisions','schedules','slugs']) if(rows[name].some(r=>!ids.has(r.article_id))) fail('Orphaned article relationship.');
  for(const [name,columns] of Object.entries({articles:['draft','published'],revisions:['body'],schedules:['snapshot']})) for(const row of rows[name]) for(const column of columns) {
   if(row[column]===null&&column==='published') continue;
   try {const v=JSON.parse(row[column]);if(!v||typeof v!=='object'||Array.isArray(v)) fail('invalid')} catch {fail('Invalid article JSON.');}
  }
  for(const r of rows.schedules) if(!Number.isFinite(Date.parse(r.publish_at))||!['pending','failed'].includes(r.status)) fail('Invalid schedule.');
  db.exec('COMMIT'); return rows;
 } finally {db.close()}
}
function capture(source,bundle=false) {
 const first=tree(source,bundle); const rows=inspectDatabase(path.join(first.root,'journal.sqlite'),bundle);
 const second=tree(source,bundle);
 if(encode(first.images)!==encode(second.images)) fail('Uploads changed during inventory. Stop all writers and retry.');
 // Validate every local media reference, including drafts, old revisions and schedules.
 const images=new Set(first.images.map(i=>i.path.replace('uploads/','')));
 for(const name of ['articles','revisions','schedules']) for(const row of rows[name]) {
  for(const value of Object.values(row)) if(typeof value==='string') for(const match of value.matchAll(/\/journal-media\/([a-zA-Z0-9._%-]+)/g)) if(!images.has(match[1])) fail('Missing or unsafe referenced upload.');
 }
 return {rows,images:first.images};
}
function summary(snapshot) {
 return {format:'periovox-journal-offline-v1',tables:Object.fromEntries(Object.entries(snapshot.rows).map(([name,rows])=>[name,{count:rows.length,sha256:sha(encode(rows))}])),images:snapshot.images,excluded:['sessions','attempts','gemini.key','gemini-model.txt','historical SQLite backups'],privateCredentialsIncluded:true};
}
export function inventory(source) {return summary(capture(source))}
export function verify(bundle) {
 const state=capture(bundle,true); const manifest=JSON.parse(readRegular(path.join(bundle,'manifest.json')));
 if(encode(manifest.inventory)!==encode(summary(state))) fail('Manifest does not match database or uploads.');
 if(manifest.databaseSha256!==sha(readRegular(path.join(bundle,'journal.sqlite')))) fail('Database checksum mismatch.');
 return manifest.inventory;
}
export function compare(source,bundle) {
 const actual=inventory(source), expected=verify(bundle);
 if(encode(actual)!==encode(expected)) fail('Source and export differ.');
 return {matches:true,inventory:expected};
}
export function exportBundle(source,destination,{offline=false}={}) {
 if(!offline) fail('Export requires offline confirmation: stop all Journal writers and scheduler first.');
 const src=safePath(source); const out=path.resolve(destination);
 safePath(path.dirname(out));
 if(out===src||out.startsWith(src+path.sep)||src.startsWith(out+path.sep)) fail('Source and destination must be separate.');
 if(fs.existsSync(out)) fail('Destination must not exist.');
 const state=capture(src); fs.mkdirSync(out,{mode:0o700});
 try {
  const dbfile=path.join(out,'journal.sqlite'); fs.writeFileSync(dbfile,'',{mode:0o600,flag:'wx'});
  const db=new DatabaseSync(dbfile);
  try {
   db.exec(`BEGIN; CREATE TABLE users(email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
CREATE TABLE articles(id TEXT PRIMARY KEY,draft TEXT NOT NULL,published TEXT,revision INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
CREATE TABLE revisions(id INTEGER PRIMARY KEY,article_id TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE schedules(article_id TEXT PRIMARY KEY,publish_at TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',error TEXT);
CREATE INDEX schedules_due ON schedules(status,publish_at);
CREATE TABLE slugs(language TEXT NOT NULL,slug TEXT NOT NULL,article_id TEXT NOT NULL,PRIMARY KEY(language,slug));`);
   for(const [name,columns] of Object.entries(tables)) {const insert=db.prepare(`INSERT INTO "${name}" VALUES(${columns.map(()=>'?').join(',')})`);for(const row of state.rows[name]) insert.run(...columns.map(c=>row[c]));}
   db.exec('COMMIT');
  } finally {db.close()}
  fs.mkdirSync(path.join(out,'uploads'),{mode:0o700});
  for(const image of state.images) {
   const bytes=readRegular(path.join(src,image.path)); if(sha(bytes)!==image.sha256) fail('Upload changed during export.');
   fs.writeFileSync(path.join(out,image.path),bytes,{mode:0o600,flag:'wx'});
  }
  const manifest={createdAt:new Date().toISOString(),inventory:summary(state),databaseSha256:sha(readRegular(dbfile))};
  fs.writeFileSync(path.join(out,'manifest.json'),encode(manifest)+'\n',{mode:0o600,flag:'wx'});
  verify(out); compare(src,out); return manifest.inventory;
 } catch(error) {fs.rmSync(out,{recursive:true,force:true});throw error}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 try {
  const [command,...args]=process.argv.slice(2); let result;
  if(command==='inventory'&&args.length===1) result=inventory(args[0]);
  else if(command==='verify'&&args.length===1) result=verify(args[0]);
  else if(command==='compare'&&args.length===2) result=compare(...args);
  else if(command==='export'&&args.length===3&&args[2]==='--offline') result=exportBundle(args[0],args[1],{offline:true});
  else fail('Usage: journal-migration.mjs inventory SOURCE | export SOURCE NEW_DEST --offline | verify BUNDLE | compare SOURCE BUNDLE');
  console.log(encode(result));
 } catch {console.error('Migration operation failed. Check offline state, schema, integrity, paths and required media. No secret values are logged.');process.exitCode=1}
}
