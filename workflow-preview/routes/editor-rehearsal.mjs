import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {defineEventHandler} from 'nitro/h3';
import {initialize} from '../journal-runtime.mjs';
import {previewIdentity,previewStore} from '../storage.mjs';

const marker='editor-workflow-rehearsal-v2';
const editor='journal-preview-smoke@example.invalid';
const iso=ms=>new Date(ms).toISOString();
const quote=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=(body,headers={})=>new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>Ensayo del editor</title><h1>Ensayo del editor</h1>'+body+'</html>',{headers:{'content-type':'text/html; charset=utf-8',...headers}});

export default defineEventHandler(async ({req})=>{
 const scope=previewIdentity(),url=new URL(req.url);
 if(!scope||url.host!==scope.host)return new Response(null,{status:404});
 if(req.method!=='GET'&&req.method!=='POST')return new Response(null,{status:405});
 const canonical='https://'+scope.host;
 if(req.method==='POST'&&req.headers.get('origin')!==canonical&&
    !(!req.headers.get('origin')&&req.headers.get('sec-fetch-site')==='same-origin')){
  console.info('JOURNAL_EDITOR_REHEARSAL_REJECTED',{hasOrigin:req.headers.has('origin'),sameSite:req.headers.get('sec-fetch-site')==='same-origin'});
  return new Response('Origen de prueba no válido.',{status:403});
 }
 let store,automated;
 try{
  store=await previewStore();
  if(req.method==='GET'){
   const saved=await store.getSetting(marker);
   if(!saved)return page('<p>Usa únicamente artículos ficticios.</p><form method="post" action="/editor-rehearsal"><button>Probar programación del editor</button></form>');
   const state=JSON.parse(saved);
   const posts=await Promise.all((state.articles??[]).map(async entry=>{
    const row=await store.get(entry.id);
    return {...entry,revision:row.revision,publishedAt:row.published?.publishedAt??null,
     languages:Object.keys(row.published??{}).filter(k=>k==='es'||k==='en'),schedule:row.schedule};
   }));
   return page('<p>Consulta de solo lectura de Neon.</p><a href="/journal/admin/">Abrir el editor habitual</a><pre>'+quote(JSON.stringify({...state,articles:posts},null,2))+'</pre>');
  }
  const claimed=await store.pool.query('INSERT INTO journal_settings VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING name',
   [marker,JSON.stringify({state:'initializing',deployment:scope.deployment})]);
  if(!claimed.rows.length)return new Response(null,{status:409});
  if(!(await store.pool.query('SELECT 1 FROM users WHERE email=$1',[editor])).rows.length)throw new Error('Fixture user missing');
  automated=await store.newSession(editor);
  const {service}=await initialize();
  const prefix='/api/journal';
  async function call(path,method,body,extra={}){
   const headers={host:scope.host,origin:canonical,'content-type':'application/json',
    cookie:'pv_journal='+automated.token,'x-journal-csrf':automated.csrf,...extra};
   const source=Object.assign(Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]),
    {url:prefix+path,method,headers,socket:{remoteAddress:'127.0.0.1'}});
   let output='';
   const response={statusCode:200,setHeader(){},end(value=''){output+=value;this.headersSent=true;}};
   await service.handler(source,response);
   return {status:response.statusCode,data:JSON.parse(output)};
  }
  function expect(result,status,label){
   if(result.status!==status)throw Object.assign(new Error('Unexpected editor response'),{safeLabel:label,safeStatus:result.status});
   return result.data;
  }
  const fields=(title,slug)=>({title,slug,body:'Fictional Preview article.',summary:'Synthetic editorial test.'});
  const now=Date.now(), fingerprint=createHash('sha256').update(scope.deployment).digest('hex').slice(0,7);
  const articles=[];
  expect(await call('/articles','GET',null,{cookie:''}),401,'anonymous');
  expect(await call('/articles','POST',{}, {origin:'https://example.invalid'}),403,'origin');
  expect(await call('/articles','POST',{}, {'x-journal-csrf':'wrong'}),403,'csrf');
  for(const spec of [{name:'direct',delays:[95]},{name:'modified',delays:[55,120]},
    {name:'cancelled',delays:[75],cancel:true},{name:'redeploy',delays:[420]}]){
   const slug='workflow-editor-'+spec.name+'-'+fingerprint;
   const draft={es:fields('Ensayo ficticio '+spec.name,slug),en:fields('Fictional rehearsal '+spec.name,slug+'-en')};
   let {article}=expect(await call('/articles','POST',draft),201,'create');
   const id=article.id,route='/articles/'+id;
   const times=[];
   for(const delay of spec.delays){
    if(times.length){
     ({article}=expect(await call(route,'PUT',{...article,es:{...article.es,title:'Ensayo ficticio editado'},
      en:{...article.en,title:'Edited fictional rehearsal'}}),200,'modify'));
     if(article.schedule)throw new Error('Edit did not invalidate prior schedule');
    }
    const publishAt=iso(now+delay*1000);
    const oldRevision=article.revision;
    ({article}=expect(await call(route+'/schedule','POST',{revision:oldRevision,publishAt}),200,'schedule'));
    expect(await call(route+'/schedule','POST',{revision:oldRevision,publishAt}),409,'stale repeat');
    if(article.schedule?.publishAt!==publishAt)throw new Error('Schedule missing');
    times.push(publishAt);
   }
   if(spec.cancel)({article}=expect(await call(route+'/cancel-schedule','POST',{revision:article.revision}),200,'cancel'));
   articles.push({name:spec.name,id,slug,times,expectedRevision:article.revision,cancelled:spec.cancel===true});
  }
  const report={state:'armed',deployment:scope.deployment,security:['anonymous-401','origin-403','csrf-403','stale-409'],articles};
  await store.setSetting(marker,JSON.stringify(report));
  await store.logout(automated.token);automated=null;
  const browser=await store.newSession(editor);
  await store.pool.query('UPDATE sessions SET expires=$1 WHERE token_hash=$2',[Date.now()+15*60_000,createHash('sha256').update(browser.token).digest('hex')]);
  console.log('JOURNAL_EDITOR_REHEARSAL',JSON.stringify(report));
  return new Response(null,{status:303,headers:{location:'/journal/admin/',
   'set-cookie':'pv_journal='+browser.token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900'}});
 }catch(error){
  if(automated&&store)await store.logout(automated.token).catch(()=>{});
  console.error('JOURNAL_EDITOR_REHEARSAL_FAILED',error.safeLabel??error.name,error.safeStatus??'');
  return new Response('Ensayo temporalmente no disponible.',{status:503});
 }
});
