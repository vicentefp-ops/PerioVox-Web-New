import path from 'node:path';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile,rename,rm,rmdir,chmod} from 'node:fs/promises';
import {createDecipheriv,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

// One-time encrypted migration. Existing persistent data always wins on redeploy.
export async function initializeJournalStorage({directory,seedPath,key}){
 if(existsSync(path.join(directory,'journal.sqlite')))return false;
 if(!existsSync(seedPath))return false;
 if(!key)throw new Error('The encrypted Journal migration requires its server-only key.');
 const seed=await readFile(seedPath),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),seed.subarray(0,12));
 decipher.setAuthTag(seed.subarray(12,28));
 const data=JSON.parse(Buffer.concat([decipher.update(seed.subarray(28)),decipher.final()]).toString('utf8'));
 if(!Array.isArray(data.files)||!data.files.some(file=>file.path==='journal.sqlite'))throw new Error('Invalid Journal migration.');
 const temporary=directory+'.import-'+randomUUID();await mkdir(path.dirname(directory),{recursive:true});await mkdir(temporary,{mode:0o700});
 try{
  for(const file of data.files){
   if(!/^(?:journal\.sqlite|gemini\.key|gemini-model\.txt|uploads\/[a-f0-9-]+\.(?:png|jpg|webp))$/.test(file.path))throw new Error('Invalid migration file.');
   const target=path.join(temporary,file.path);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,Buffer.from(file.data,'base64'),{mode:0o600});
  }
  const db=new DatabaseSync(path.join(temporary,'journal.sqlite'));
  try{if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('Journal integrity check failed.');db.exec('DELETE FROM sessions; DELETE FROM attempts; PRAGMA journal_mode=DELETE;')}finally{db.close()}
  // An empty directory may have been provisioned by the platform before first start.
  if(existsSync(directory))await rmdir(directory);
  await rename(temporary,directory);await chmod(directory,0o700);return true;
 }catch(error){await rm(temporary,{recursive:true,force:true});throw error}
}
