import {randomBytes, scrypt, timingSafeEqual, createHash, randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const conflict = message => Object.assign(new Error(message), {status: 409});
const changed = () => conflict('El artículo ha cambiado. Recárgalo antes de continuar.');

// Run only as an explicitly approved migration against an isolated, empty database.
// Runtime startup intentionally does not create tables or import production content.
export const postgresSchema = `
CREATE TABLE IF NOT EXISTS journal_schema (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS journal_environment (id INTEGER PRIMARY KEY CHECK (id = 1), environment TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS journal_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS journal_write_lock (id INTEGER PRIMARY KEY CHECK (id = 1));
INSERT INTO journal_write_lock VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, csrf TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions (id BIGSERIAL PRIMARY KEY, article_id TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS schedules (article_id TEXT PRIMARY KEY REFERENCES articles(id), publish_at TEXT NOT NULL, snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', error TEXT);
CREATE INDEX IF NOT EXISTS schedules_due ON schedules(status,publish_at);
CREATE TABLE IF NOT EXISTS slugs (language TEXT NOT NULL, slug TEXT NOT NULL, article_id TEXT NOT NULL REFERENCES articles(id), PRIMARY KEY(language,slug));
INSERT INTO journal_schema VALUES (1) ON CONFLICT DO NOTHING;
`;
export async function initializePostgresSchema(pool, environment) {
 if (typeof environment !== 'string' || !environment.trim() || environment.length>200) throw new Error('Explicit Journal environment required.');
 const client = await pool.connect();
 try {
  await client.query('BEGIN'); await client.query(postgresSchema);
  await client.query('INSERT INTO journal_environment VALUES(1,$1) ON CONFLICT DO NOTHING',[environment]);
  const row=(await client.query('SELECT environment FROM journal_environment WHERE id=1')).rows[0];
  if (row?.environment !== environment) throw new Error('Journal database environment mismatch.');
  await client.query('COMMIT');
 }
 catch (error) {await client.query('ROLLBACK'); throw error;}
 finally {client.release();}
}
const selectArticles = `SELECT a.*, s.publish_at, s.status AS schedule_status, s.error AS schedule_error FROM articles a LEFT JOIN schedules s ON s.article_id=a.id`;
function unpack(row) {
 return row ? {...JSON.parse(row.draft), id:row.id, revision:row.revision, updated:row.updated,
  published:row.published ? JSON.parse(row.published) : null,
  schedule:row.publish_at ? {publishAt:row.publish_at,status:row.schedule_status,error:row.schedule_error} : null} : null;
}
export async function openPostgresStore({pool, connectionString, expectedEnvironment} = {}) {
 if (typeof expectedEnvironment !== 'string' || !expectedEnvironment.trim() || expectedEnvironment.length>200) throw new Error('Explicit Journal environment required.');
 const ownsPool = !pool;
 if (!pool) {
  if (!connectionString) throw new Error('Journal PostgreSQL connection is required.');
  const {Pool} = await import('pg');
  pool = new Pool({connectionString,max:3,idleTimeoutMillis:10_000,connectionTimeoutMillis:10_000});
 }
 try {
  const result = await pool.query('SELECT version FROM journal_schema');
  if (result.rows.length !== 1 || result.rows[0].version !== 1) throw new Error('Unsupported Journal PostgreSQL schema.');
  const environment=(await pool.query('SELECT environment FROM journal_environment WHERE id=1')).rows[0];
  if (environment?.environment !== expectedEnvironment) throw new Error('Journal database environment mismatch.');
 } catch (error) {if (ownsPool) await pool.end(); throw error;}
 const query = (sql, values=[]) => pool.query(sql, values);
 const get = async (id, client=pool) => unpack((await client.query(selectArticles+' WHERE a.id=$1',[id])).rows[0]);
 async function transaction(fn) {
  const client = await pool.connect();
  try {
   await client.query('BEGIN');
   // The row lock spans draft edits, slug checks, scheduling and publication.
   // Unlike a process mutex it is shared by every serverless instance.
   if ((await client.query('SELECT id FROM journal_write_lock WHERE id=1 FOR UPDATE')).rows.length !== 1) throw new Error('Journal write lock is missing.');
   const result = await fn(client);
   await client.query('COMMIT'); return result;
  } catch (error) {await client.query('ROLLBACK'); throw error;}
  finally {client.release();}
 }
 async function checkRevision(client,id,revision) {
  const row = (await client.query('SELECT * FROM articles WHERE id=$1',[id])).rows[0];
  if (!row || row.revision !== revision) throw changed();
  return row;
 }
 async function checkSlugs(client,id,snapshot) {
  const pending = (await client.query("SELECT article_id,snapshot FROM schedules WHERE status='pending' AND article_id<>$1",[id])).rows;
  for (const language of ['es','en']) if (snapshot[language]) {
   const slug = snapshot[language].slug;
   const owner = (await client.query('SELECT article_id FROM slugs WHERE language=$1 AND slug=$2',[language,slug])).rows[0];
   if (owner && owner.article_id !== id) throw conflict('Esa dirección ya pertenece a otro artículo. Cambia la URL.');
   if (pending.some(row => JSON.parse(row.snapshot)[language]?.slug === slug)) throw conflict('Esa dirección está reservada por un artículo programado.');
  }
 }
 async function writePublication(client,id,snapshot) {
  await checkSlugs(client,id,snapshot);
  for (const language of ['es','en']) if (snapshot[language]) {
   await client.query('INSERT INTO slugs VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[language,snapshot[language].slug,id]);
  }
  await client.query('UPDATE articles SET published=$1,revision=revision+1 WHERE id=$2',[JSON.stringify(snapshot),id]);
  await client.query('DELETE FROM schedules WHERE article_id=$1',[id]);
 }
 const store = {
  async getSetting(name) {return (await query('SELECT value FROM journal_settings WHERE name=$1',[name])).rows[0]?.value ?? null;},
  async setSetting(name,value) {await query('INSERT INTO journal_settings VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value',[name,value]);},
  pool, close:async () => {if (ownsPool) await pool.end();},
  async createUser(email,password) {
   const salt=randomBytes(32).toString('hex');
   const hash=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   return (await query('INSERT INTO users VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING email',[email,salt,hash.toString('hex')])).rows.length === 1;
  },
  async authenticate(email,password) {
   const row=(await query('SELECT * FROM users WHERE email=$1',[email])).rows[0];
   const hash=await derive(password,row?.salt??'missing-user-timing-padding',64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   return !!row && timingSafeEqual(hash,Buffer.from(row.password_hash,'hex'));
  },
  async session(token) {
   await query('DELETE FROM sessions WHERE expires<$1',[Date.now()]);
   if (!token) return null;
   const row=(await query('SELECT email,csrf,expires FROM sessions WHERE token_hash=$1 AND expires>$2',[digest(token),Date.now()])).rows[0];
   return row ? {...row,expires:Number(row.expires)} : null;
  },
  async newSession(email) {
   const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
   await query('INSERT INTO sessions VALUES($1,$2,$3,$4)',[digest(token),email,csrf,Date.now()+12*3600_000]); return {token,csrf};
  },
  async logout(token) {await query('DELETE FROM sessions WHERE token_hash=$1',[digest(token??'')]);},
  async attempt(ip) {
   const now=Date.now();
   // A single UPSERT atomically resets expired windows or increments an active one.
   // Do not DELETE then INSERT: simultaneous workers could erase another attempt.
   const row=(await query(`INSERT INTO attempts VALUES($1,1,$2) ON CONFLICT(ip) DO UPDATE SET
    count=CASE WHEN attempts.expires<$3 THEN 1 ELSE attempts.count+1 END,
    expires=CASE WHEN attempts.expires<$3 THEN EXCLUDED.expires ELSE attempts.expires END RETURNING count`,[ip,now+15*60_000,now])).rows[0];
   return row.count;
  },
  async clearAttempts(ip) {await query('DELETE FROM attempts WHERE ip=$1',[ip]);},
  async list() {return (await query(selectArticles+' ORDER BY a.updated DESC,a.id')).rows.map(unpack);},
  get,
  async save(draft,expectedRevision) {return transaction(async client => {
   const id=draft.id??randomUUID(),previous=(await client.query('SELECT * FROM articles WHERE id=$1',[id])).rows[0];
   if (previous && previous.revision !== expectedRevision) throw changed();
   if (!previous && draft.id) throw Object.assign(new Error('Artículo no encontrado.'),{status:404});
   const now=new Date().toISOString();
   const {id:ignored,revision,published,updated,schedule:ignoredSchedule,...body}=draft;
   if (previous) await client.query('INSERT INTO revisions(article_id,body,created) VALUES($1,$2,$3)',[id,previous.draft,now]);
   await client.query(`INSERT INTO articles(id,draft,revision,updated) VALUES($1,$2,1,$3)
    ON CONFLICT(id) DO UPDATE SET draft=EXCLUDED.draft,revision=articles.revision+1,updated=EXCLUDED.updated`,[id,JSON.stringify(body),now]);
   await client.query('DELETE FROM schedules WHERE article_id=$1',[id]);
   return get(id,client);
  });},
  async publish(id,expectedRevision,snapshot) {return transaction(async client => {
   await checkRevision(client,id,expectedRevision); await writePublication(client,id,snapshot); return get(id,client);
  });},
  async schedule(id,expectedRevision,snapshot,publishAt,now=Date.now(),arm) {return transaction(async client => {
   const date=Date.parse(publishAt);
   if (!Number.isFinite(date)||date<=now) throw Object.assign(new Error('Elige una fecha y hora futura.'),{status:400});
   await checkRevision(client,id,expectedRevision); await checkSlugs(client,id,snapshot);
   const scheduledAt=new Date(date).toISOString();
   if(arm){
    const alarm={id,generation:randomUUID(),scheduledAt,revision:expectedRevision+1};
    const runId=await arm(alarm);
    if(typeof runId!=='string'||!runId)throw new Error('Missing durable Workflow acknowledgement');
    await client.query('INSERT INTO journal_settings VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value',
     ['workflow-alarm:'+id,JSON.stringify({...alarm,runId})]);
   }
   await client.query(`INSERT INTO schedules(article_id,publish_at,snapshot,status,error) VALUES($1,$2,$3,'pending',NULL)
    ON CONFLICT(article_id) DO UPDATE SET publish_at=EXCLUDED.publish_at,snapshot=EXCLUDED.snapshot,status='pending',error=NULL`,[id,scheduledAt,JSON.stringify(snapshot)]);
   await client.query('UPDATE articles SET revision=revision+1 WHERE id=$1',[id]); return get(id,client);
  });},
  async cancelSchedule(id,expectedRevision) {return transaction(async client => {
   await checkRevision(client,id,expectedRevision);
   await client.query('DELETE FROM schedules WHERE article_id=$1',[id]);
   await client.query('UPDATE articles SET revision=revision+1 WHERE id=$1',[id]); return get(id,client);
  });},
  async publishDue(now=Date.now(),alarm) {return transaction(async client => {
   const published=[];
   const paused=(await client.query("SELECT value FROM journal_settings WHERE name='workflow-pause-publication'")).rows[0];
   if(paused?.value==='yes')return published;
   if(alarm){
    const current=(await client.query('SELECT value FROM journal_settings WHERE name=$1',['workflow-alarm:'+alarm.id])).rows[0];
    if(!current||JSON.parse(current.value).generation!==alarm.generation)return published;
   }
   const deadline=new Date(now).toISOString();
   const due=alarm
    ? (await client.query("SELECT s.* FROM schedules s JOIN articles a ON a.id=s.article_id WHERE s.status='pending' AND s.publish_at<=$1 AND s.article_id=$2 AND s.publish_at=$3 AND a.revision=$4",
       [deadline,alarm.id,alarm.scheduledAt,alarm.revision])).rows
    : (await client.query("SELECT * FROM schedules WHERE status='pending' AND publish_at<=$1 ORDER BY publish_at,article_id",[deadline])).rows;
   // Mark malformed due snapshots before slug checks so one corrupt due job
   // cannot poison otherwise valid jobs simply because its UUID sorts later.
   const valid=[];
   for (const row of due) {
    try {const snapshot=JSON.parse(row.snapshot); if (!snapshot || typeof snapshot !== 'object') throw new Error(); valid.push({...row,parsedSnapshot:snapshot});}
    catch {await client.query("UPDATE schedules SET status='failed',error=$1 WHERE article_id=$2",['No se ha podido publicar. Revisa el artículo y vuelve a programarlo.',row.article_id]);}
   }
   for (const row of valid) {
    await client.query('SAVEPOINT scheduled_publication');
    try {
     await writePublication(client,row.article_id,row.parsedSnapshot);
     await client.query('RELEASE SAVEPOINT scheduled_publication'); published.push(row.article_id);
    } catch (error) {
     await client.query('ROLLBACK TO SAVEPOINT scheduled_publication'); await client.query('RELEASE SAVEPOINT scheduled_publication');
     await client.query("UPDATE schedules SET status='failed',error=$1 WHERE article_id=$2",[error.status?error.message:'No se ha podido publicar. Revisa el artículo y vuelve a programarlo.',row.article_id]);
    }
   }
   return published;
  });},
  async unpublish(id,expectedRevision) {return transaction(async client => {
   if (expectedRevision !== undefined) await checkRevision(client,id,expectedRevision);
   await client.query('DELETE FROM schedules WHERE article_id=$1',[id]);
   await client.query('UPDATE articles SET published=NULL,revision=revision+1 WHERE id=$1',[id]); return get(id,client);
  });},
  async published(language) {return (await store.list()).filter(article=>article.published?.[language]).map(article=>({id:article.id,...article.published,language})).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));},
  async resolve(language,slug) {
   const row=(await query(`SELECT a.id,a.published FROM slugs s JOIN articles a ON a.id=s.article_id WHERE s.language=$1 AND s.slug=$2`,[language,slug])).rows[0];
   const published=row?.published?JSON.parse(row.published):null;
   return published?.[language]?{id:row.id,...published,language}:null;
  }
 };
 return store;
}
