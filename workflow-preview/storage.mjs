import {createHash} from 'node:crypto';
import {openPostgresStore} from '../server/journal-postgres-store.mjs';

let opening;
export function previewIdentity() {
  const env=process.env;
  const fingerprint=createHash('sha256').update([env.JOURNAL_PREVIEW_NEON_PROJECT_ID,env.JOURNAL_PREVIEW_BLOB_STORE_ID].join(':')).digest('hex');
  if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='preview/journal-runtime-20261107'||
     env.JOURNAL_BACKEND!=='vercel'||env.JOURNAL_PREVIEW_ENVIRONMENT_ID!=='preview:periovox-journal-20261107'||
     fingerprint!=='75d711cf9c1a47d478a633f436a3a87186afcc9dca1f31d1318263b902fbdf4d'||
     !env.JOURNAL_PREVIEW_DATABASE_URL||env.JOURNAL_PREVIEW_DATABASE_URL===env.JOURNAL_PRODUCTION_DATABASE_URL||
     !/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL??''))return null;
  return {host:env.VERCEL_URL, deployment:env.VERCEL_DEPLOYMENT_ID??env.VERCEL_URL};
}

export function previewStore() {
  if(!previewIdentity())throw new Error('Workflow Preview is disabled');
  return opening??=openPostgresStore({
    connectionString: process.env.JOURNAL_PREVIEW_DATABASE_URL,
    expectedEnvironment: process.env.JOURNAL_PREVIEW_ENVIRONMENT_ID,
  }).catch(error=>{opening=undefined;throw error});
}
