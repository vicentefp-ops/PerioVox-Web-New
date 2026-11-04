#!/usr/bin/env node
// Explicit operator entry. Never imported by runtime or invoked during build.
import {initializePostgresSchema,openPostgresStore} from '../server/journal-postgres-store.mjs';
import {initializeBlobEnvironment} from '../server/journal-blob-media.mjs';
let pool;
try{
 if(process.argv.length!==3||process.argv[2]!=='--confirm-isolated-storage-setup')throw new Error('Explicit setup acknowledgement required');
 const environment=process.env.JOURNAL_ENVIRONMENT_ID,connectionString=process.env.JOURNAL_DATABASE_URL,token=process.env.BLOB_READ_WRITE_TOKEN;
 if(!environment||!/^(preview|production):[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(environment)||!connectionString||!token)throw new Error('Explicit isolated target required');
 const {Pool}=await import('pg');pool=new Pool({connectionString,max:1});
 const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema()" )).rows;
 if(tables.length){
  // Existing schema is accepted only when already bound to this exact environment.
  // Do not label an existing unmarked database or silently migrate another app.
  await openPostgresStore({pool,expectedEnvironment:environment});
 }else await initializePostgresSchema(pool,environment);
 await initializeBlobEnvironment({token,environment});
 console.log(JSON.stringify({initialized:true,environment}));
}catch{
 console.error('Journal storage setup failed. Verify approved isolated storage, permissions and environment markers. No secrets are logged.');process.exitCode=1;
}finally{if(pool)await pool.end()}
