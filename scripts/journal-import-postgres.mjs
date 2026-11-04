#!/usr/bin/env node
// Offline tooling: importing this module never opens a connection or writes data.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {verify} from './journal-migration.mjs';
import {openPostgresStore} from '../server/journal-postgres-store.mjs';
import {imageType,MAX_IMAGE_BYTES,verifyBlobEnvironment} from '../server/journal-blob-media.mjs';
const tables={users:['email','salt','password_hash'],articles:['id','draft','published','revision','updated'],revisions:['id','article_id','body','created'],schedules:['article_id','publish_at','snapshot','status','error'],slugs:['language','slug','article_id']};
const keys={users:['email'],articles:['id'],revisions:['id'],schedules:['article_id'],slugs:['language','slug']};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw new Error(message)};
function sourceBundle(bundle){
 const inventory=verify(bundle),rows={};
 const db=new DatabaseSync(path.join(bundle,'journal.sqlite'),{readOnly:true});
 try {
  for(const [name,columns] of Object.entries(tables)){
   rows[name]=db.prepare(`SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM "${name}" ORDER BY ${columns.map(c=>'"'+c+'"').join(',')}`).all();
   if(rows[name].length!==inventory.tables[name].count||sha(JSON.stringify(rows[name]))!==inventory.tables[name].sha256)fail('Source row fingerprint mismatch.');
  }
 }finally{db.close()}
 return {inventory,rows,fingerprint:sha(JSON.stringify(inventory))};
}
async function checkEmpty(client){
 for(const name of [...Object.keys(tables),'sessions','attempts','journal_settings']){
  if((await client.query(`SELECT 1 FROM ${name} LIMIT 1`)).rows.length)fail('Target database is not empty.');
 }
}
async function checkRows(client,source){
 const counts={};
 for(const [name,columns] of Object.entries(tables)){
  const actual=(await client.query(`SELECT ${columns.join(',')} FROM ${name}`)).rows;
  // pg returns BIGSERIAL as a string. The SQLite exporter admits JS-safe integers.
  if(name==='revisions')for(const row of actual){row.id=Number(row.id);if(!Number.isSafeInteger(row.id))fail('Unsafe revision identifier.');}
  const key=row=>JSON.stringify(keys[name].map(c=>row[c]));
  const byKey=new Map(actual.map(row=>[key(row),row]));
  const ordered=source.rows[name].map(row=>byKey.get(key(row)));
  if(actual.length!==source.inventory.tables[name].count||sha(JSON.stringify(ordered))!==source.inventory.tables[name].sha256)fail('Target row fingerprint mismatch.');
  counts[name]=actual.length;
 }
 return counts;
}
async function readBlob(sdk,pathname,token,limit){
 const object=await sdk.get(pathname,{token,access:'private',useCache:false});
 if(!object)return null;
 if(object.statusCode!==200||!object.stream)fail('Cannot verify target media.');
 const chunks=[];let size=0;
 for await(const chunk of object.stream){size+=chunk.length;if(size>limit)fail('Target media size mismatch.');chunks.push(Buffer.from(chunk))}
 return Buffer.concat(chunks);
}
async function media(source,bundle,{sdk,token},write){
 for(const image of source.inventory.images){
  const filename=image.path.slice('uploads/'.length),pathname='journal-media/'+filename;
  const bytes=readFileSync(path.join(bundle,image.path));
  if(bytes.length!==image.bytes||sha(bytes)!==image.sha256||bytes.length<1||bytes.length>MAX_IMAGE_BYTES)fail('Source media changed or unsupported size.');
  const type=imageType(bytes);if(!filename.endsWith('.'+type.ext))fail('Source image extension does not match content.');
  let existing=await readBlob(sdk,pathname,token,image.bytes);
  if(existing===null&&write){
   // Never overwrite existing objects, even during a retry after a partial copy.
   await sdk.put(pathname,bytes,{token,access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:type.mimeType});
   existing=await readBlob(sdk,pathname,token,image.bytes);
  }
  if(!existing||existing.length!==image.bytes||sha(existing)!==image.sha256)fail('Target media fingerprint mismatch.');
 }
}
export async function verifyImportedBundle({bundle,pool,expectedEnvironment,sdk,token}){
 const source=sourceBundle(bundle);await openPostgresStore({pool,expectedEnvironment});
 await verifyBlobEnvironment({sdk,token,expectedEnvironment});
 const client=await pool.connect();let counts;
 try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');counts=await checkRows(client,source);await client.query('COMMIT');}
 catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 await media(source,bundle,{sdk,token},false);
 return {verified:true,sourceFingerprint:source.fingerprint,counts,images:source.inventory.images.length};
}
export async function importBundle({bundle,pool,expectedEnvironment,sdk,token,confirmed=false}){
 if(!confirmed)fail('Explicit import confirmation required.');
 const source=sourceBundle(bundle);await openPostgresStore({pool,expectedEnvironment});
 await verifyBlobEnvironment({sdk,token,expectedEnvironment});
 await checkEmpty(pool);
 // Copy first. Partial copies are private, immutable and safely reusable; no DB
 // content appears until the single transaction commits. Never delete on failure.
 await media(source,bundle,{sdk,token},true);
 const client=await pool.connect();let counts;
 try{
  await client.query('BEGIN');
  if((await client.query('SELECT id FROM journal_write_lock WHERE id=1 FOR UPDATE')).rows.length!==1)fail('Target write lock missing.');
  await checkEmpty(client);
  for(const [name,columns] of Object.entries(tables))for(const row of source.rows[name]){
   await client.query(`INSERT INTO ${name}(${columns.join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(c=>row[c]));
  }
  await client.query("SELECT setval(pg_get_serial_sequence('revisions','id'),COALESCE((SELECT MAX(id) FROM revisions),1),(SELECT COUNT(*)>0 FROM revisions))");
  counts=await checkRows(client,source);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 return {imported:true,sourceFingerprint:source.fingerprint,counts,images:source.inventory.images.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let pool;
 try{
  const [command,bundle,flag]=process.argv.slice(2);
  if(!['import','verify'].includes(command)||!bundle||process.argv.length!==5||(command==='import'?flag!=='--confirm-private-data-transfer':flag!=='--confirm-target-read'))fail('Explicit command and confirmation flag required.');
  const expectedEnvironment=process.env.JOURNAL_ENVIRONMENT_ID,connectionString=process.env.JOURNAL_DATABASE_URL,token=process.env.BLOB_READ_WRITE_TOKEN;
  if(!expectedEnvironment||!connectionString||!token)fail('Explicit target configuration required.');
  const {Pool}=await import('pg');pool=new Pool({connectionString,max:1});
  const sdk=await import('@vercel/blob');
  const options={bundle,pool,expectedEnvironment,sdk,token,confirmed:true};
  console.log(JSON.stringify(await (command==='import'?importBundle(options):verifyImportedBundle(options))));
 }catch{console.error('Journal import/verification failed. Check confirmation, verified bundle, isolated empty target and media fingerprints. No private values are logged.');process.exitCode=1}
 finally{if(pool)await pool.end()}
}
