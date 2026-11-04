import {timingSafeEqual} from 'node:crypto';
// Fail closed before opening any database or Blob store. No production fallback.
export function journalRuntimeConfig(env=process.env){
 if(env.NODEJS_HELPERS!=='0')throw new Error('Disable Vercel body helpers to preserve raw upload streams');
 if(env.JOURNAL_BACKEND!=='vercel')throw new Error('Vercel Journal is not enabled');
 const production=env.VERCEL_ENV==='production';
 const scope=production?'PRODUCTION':'PREVIEW';
 const databaseUrl=env[`JOURNAL_${scope}_DATABASE_URL`];
 const blobToken=env[`JOURNAL_${scope}_BLOB_TOKEN`];
 const environment=env[`JOURNAL_${scope}_ENVIRONMENT_ID`];
 if(!databaseUrl||!blobToken||!environment||!environment.startsWith(production?'production:':'preview:'))throw new Error('Missing isolated Journal storage configuration');
 if(!production&&(databaseUrl===env.JOURNAL_PRODUCTION_DATABASE_URL||blobToken===env.JOURNAL_PRODUCTION_BLOB_TOKEN))throw new Error('Preview must not use production storage');
 const deploymentHost=env.VERCEL_URL;
 if(deploymentHost){const candidate=new URL('https://'+deploymentHost);if(candidate.host!==deploymentHost||candidate.username||candidate.password||candidate.pathname!=='/'||candidate.search||candidate.hash)throw new Error('Invalid deployment hostname')}
 const origin=production?'https://periovox.ai':`https://${env.VERCEL_URL||''}`;
 const url=new URL(origin);
 if(!production&&(!env.VERCEL_URL||url.host!==env.VERCEL_URL||url.username||url.password||url.pathname!=='/'))throw new Error('Missing verified preview hostname');
 if(production&&!['external-minute','vercel-pro-minute'].includes(env.JOURNAL_SCHEDULER_MODE))throw new Error('An approved minute scheduler is required before cutover');
 if(production&&(!env.CRON_SECRET||env.CRON_SECRET.length<32))throw new Error('A strong scheduler secret is required');
 return {cronHosts:[new URL(origin).host,...(deploymentHost?[deploymentHost]:[])],databaseUrl,blobToken,environment,origin,preview:!production,cronSecret:env.CRON_SECRET,settingsKey:env[`JOURNAL_${scope}_SETTINGS_KEY`],gemini:{GEMINI_API_KEY:env[`JOURNAL_${scope}_GEMINI_API_KEY`],GEMINI_MODEL:env[`JOURNAL_${scope}_GEMINI_MODEL`]}};
}

export function authorizedCron(req,config){
 if(req.method!=='GET'||!config.cronSecret||!config.cronHosts.includes(req.headers.host))return false;
 const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from(`Bearer ${config.cronSecret}`);
 return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
