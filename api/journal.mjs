import {createHash} from 'node:crypto';
import {journalRuntimeConfig,authorizedCron} from '../server/journal-runtime-config.mjs';
import {createJournalHandler} from '../server/journal-http.mjs';
import {openPostgresStore} from '../server/journal-postgres-store.mjs';
import {createBlobMedia} from '../server/journal-blob-media.mjs';
import {createEncryptedSettings} from '../server/journal-settings.mjs';

// Explicitly avoid buffered responses for the supported 8 MiB media path.
export const config={supportsResponseStreaming:true};

// Never run a persistent loop or migrate a database during a function invocation.
let initialization;
async function initialize(){
 const config=journalRuntimeConfig({...process.env,JOURNAL_PREVIEW_BLOB_TOKEN:process.env.JOURNAL_PREVIEW_BLOB_READ_WRITE_TOKEN});
 const root=process.cwd();
 const media=await createBlobMedia({token:config.blobToken,expectedEnvironment:config.environment});
 const {renderJournalDocument}=await import('../dist-server/journal-entry.js');
 const store=await openPostgresStore({connectionString:config.databaseUrl,expectedEnvironment:config.environment});
 const settings=createEncryptedSettings(store,{key:config.settingsKey,env:config.gemini});
 const service=createJournalHandler({root,dataDir:'/tmp/periovox-unused',store,media,settings,preview:config.preview,
  origin:config.origin,allowedHosts:[new URL(config.origin).hostname],
  clientIp:req=>String(req.headers['x-vercel-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(),
  renderPage:props=>renderJournalDocument(props,root,'')});
 return {config,service,media};
}
export default async function handler(req,res){
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='preview/journal-runtime-20261107'||createHash('sha256').update([process.env.JOURNAL_PREVIEW_NEON_PROJECT_ID,process.env.JOURNAL_PREVIEW_BLOB_STORE_ID].join(':')).digest('hex')!=='75d711cf9c1a47d478a633f436a3a87186afcc9dca1f31d1318263b902fbdf4d'||process.env.JOURNAL_BACKEND!=='vercel'){res.statusCode=404;res.end();return}
 try{
  initialization??=initialize().catch(error=>{initialization=undefined;throw error});
  const {config,service,media}=await initialization;
  res.setHeader('Cache-Control','no-store');if(config.preview)res.setHeader('X-Robots-Tag','noindex, nofollow');
  const pathname=new URL(req.url,'https://periovox.ai').pathname;
  if(pathname==='/api/journal/cron'){
   res.setHeader('X-Robots-Tag','noindex, nofollow');
   if(!authorizedCron(req,config)){res.statusCode=401;res.end();return}
   await service.publishDue();await media.cleanupExpired();res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;
  }
  if(req.headers.host!==new URL(config.origin).host){res.statusCode=400;res.end();return}
  if(!await service.handler(req,res)){res.statusCode=404;res.end()}
 }catch{
  // Do not return database URLs, tokens, driver messages, or settings values.
  if(!res.headersSent){res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');res.end('Journal temporarily unavailable')}else res.end();
 }
}
