import path from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {openStore,sourceHash} from './journal-store.mjs';
import {translateArticle} from './journal-translation.mjs';
import {generateArticleMetadata,readArticleImage,validateMetadata} from './journal-metadata.mjs';
const PREFIX='/api/journal';
export const slugify=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90).replace(/-$/,'');
function error(message,status=400){return Object.assign(new Error(message),{status})}
function string(value,max=2000){if(value==null)return '';if(typeof value!=='string'||value.length>max)throw error('Uno de los campos supera el tamaño permitido.');return value.trim()}
function languageFields(value={}){const title=string(value.title,200);const slug=slugify(value.slug||title);if(['admin','feed','sitemap'].includes(slug))throw error('Elige otra dirección para el artículo.');return {title,summary:string(value.summary,600),body:string(value.body,120000),slug,seoTitle:string(value.seoTitle,100),seoDescription:string(value.seoDescription,200),coverAlt:string(value.coverAlt,300)}}
function validateComplete(article){if(!article?.title||!article.summary||!article.body||!article.slug)throw error('Completa el título, el subtítulo y el texto del artículo antes de publicar.');if(article.seoTitle.length>65||article.seoDescription.length>160)throw error('El título SEO debe tener como máximo 65 caracteres y la descripción 160.')}
function normalize(body,previous){
 const cover=string(body.cover,400);if(cover&&!/^\/(?:media\/[a-zA-Z0-9._-]+|journal-media\/[a-f0-9-]+\.(?:png|jpg|webp))$/.test(cover))throw error('Utiliza una imagen subida al Journal.');
 const es=languageFields(body.es),en=body.en?languageFields(body.en):null;
 const enChanged=JSON.stringify(en)!==JSON.stringify(previous?.en??null);
 return {id:previous?.id,es,en,category:['guides','practice','technology','news'].includes(body.category)?body.category:'guides',author:string(body.author,120)||'Equipo PerioVox',reviewer:string(body.reviewer,120),cover,translationSourceHash:enChanged&&en?.title&&en?.body?sourceHash(es):previous?.translationSourceHash??null,translationBy:enChanged?'manual':previous?.translationBy??null};
}
async function bodyBuffer(req,limit=500_000){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw error('El archivo supera el tamaño permitido.',413);chunks.push(chunk)}return Buffer.concat(chunks)}
async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw error('Formato de solicitud no válido.',415);try{const data=JSON.parse((await bodyBuffer(req)).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw error('Contenido no válido.');return data}catch(e){if(e.status)throw e;throw error('Contenido no válido.')}}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(JSON.stringify(data))}
function html(res,status,markup,privatePage=false){res.statusCode=status;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control',privatePage?'no-store':'no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');if(privatePage)res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(markup)}
export function createJournalHandler({root,dataDir=process.env.JOURNAL_DATA_DIR||path.join(root,'.journal-data'),renderPage,translate=translateArticle,generateMetadata=generateArticleMetadata}){
 const store=openStore(dataDir);const uploads=path.join(dataDir,'uploads');mkdirSync(uploads,{recursive:true,mode:0o700});
 const keyFile=path.join(dataDir,'gemini.key');const modelFile=path.join(dataDir,'gemini-model.txt');
 const apiKey=()=>process.env.GEMINI_API_KEY||(existsSync(keyFile)?readFileSync(keyFile,'utf8').trim():'');
 const model=()=>process.env.GEMINI_MODEL||(existsSync(modelFile)?readFileSync(modelFile,'utf8').trim():'gemini-3.8-flash');
 const state=()=>({translationReady:!!apiKey(),model:model()});
 const publicOrigin=process.env.JOURNAL_ORIGIN?new URL(process.env.JOURNAL_ORIGIN).origin:null;
 const internalHosts=(process.env.JOURNAL_INTERNAL_HOSTS||'').split(',').map(host=>host.trim()).filter(Boolean);
 const secure=req=>publicOrigin?publicOrigin.startsWith('https:'):!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$|^\[::1\](?::\d+)?$/.test(req.headers.host??'');
 const setCookie=(req,res,token='',age=43200)=>res.setHeader('Set-Cookie',`pv_journal=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure(req)?'; Secure':''}`);
 async function english(article){
  if(article.en&&article.translationSourceHash===sourceHash(article.es)){validateComplete(article.en);return article;}
  const en=languageFields(await translate(article.es,{apiKey:apiKey(),model:model()}));validateComplete(en);
  return store.save({...article,en,translationSourceHash:sourceHash(article.es),translationBy:'gemini'},article.revision);
 }
 async function completeMetadata(article,language='es',scope='all',automatic=false){
  if(!['es','en'].includes(language)||!['all','seo','image'].includes(scope))throw error('Selecciona un idioma y unos campos válidos.');
  if(automatic&&!apiKey())return {article,filledFields:[]};
  const text=article[language];if(!text)throw error('Prepara primero el artículo en este idioma.');
  if(scope==='image'&&!article.cover)throw error('Sube una portada para generar su descripción.');
  const candidates=scope==='seo'?['seoTitle','seoDescription']:scope==='image'?['coverAlt']:['seoTitle','seoDescription','coverAlt'];
  const fields=candidates.filter(field=>!text[field]?.trim()&&(field!=='coverAlt'||article.cover));
  if(!fields.length)return {article,filledFields:[]};
  if(!apiKey())throw error('Configura Gemini en Ajustes para completar estos campos con IA.',409);
  if(fields.some(field=>field!=='coverAlt')&&(!text.title||!text.body))throw error('Escribe el título y el texto del artículo antes de generar los campos para buscadores.');
  const image=fields.includes('coverAlt')?await readArticleImage(article.cover,{root,dataDir}):undefined;
  const generated=validateMetadata(await generateMetadata(text,{apiKey:apiKey(),model:model(),language,fields,image}),fields);
  const next={...article,[language]:{...text,...generated}};
  // Adding metadata does not invalidate an existing, current translation of the article body.
  if(language==='es'&&article.en&&article.translationSourceHash===sourceHash(article.es))next.translationSourceHash=sourceHash(next.es);
  return {article:store.save(next,article.revision),filledFields:fields};
 }
 const handler=async(req,res)=>{
  const url=new URL(req.url??'/','http://localhost');const pathname=url.pathname;const isApi=pathname.startsWith(PREFIX+'/');const journal=/^\/(es\/)?journal(?:\/|$)/.test(pathname);const image=pathname.startsWith('/journal-media/');
  if(!isApi&&!journal&&!image&&pathname!=='/sitemap-journal.xml'&&pathname!=='/sitemap.xml')return false;
  try{
   const host=(req.headers.host??'').toLowerCase();const hostname=host.replace(/:\d+$/,'');const allowed=['localhost','127.0.0.1','[::1]','periovox.ai','www.periovox.ai',...internalHosts,...(process.env.JOURNAL_ORIGIN?[new URL(process.env.JOURNAL_ORIGIN).hostname]:[])];
   if(!allowed.includes(hostname))throw error('Dominio no autorizado.',400);
   if(isApi){
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pv_journal='))?.slice(11);
    const session=store.session(token);
    const mutating=!['GET','HEAD'].includes(req.method??'GET');
    if(mutating){if(req.headers.origin!==(publicOrigin||`${secure(req)?'https':'http'}://${host}`))throw error('La solicitud debe proceder del propio Journal.',403);if(req.headers['sec-fetch-site']==='cross-site')throw error('Solicitud no autorizada.',403)}
    if(pathname===PREFIX+'/session'&&req.method==='GET'){json(res,200,session?{authenticated:true,email:session.email,csrf:session.csrf,...state()}:{authenticated:false});return true}
    if(pathname===PREFIX+'/login'&&req.method==='POST'){
     const ip=req.socket.remoteAddress??'unknown';if(store.attempt(ip)>5){res.setHeader('Retry-After','900');throw error('Demasiados intentos. Espera 15 minutos para volver a entrar.',429)}
     const body=await jsonBody(req);const email=string(body.email,200).toLowerCase(),password=typeof body.password==='string'&&body.password.length<=1024?body.password:'';
     if(!await store.authenticate(email,password))throw error('Correo o contraseña incorrectos.',401);
     store.clearAttempts(ip);if(token)store.logout(token);const next=store.newSession(email);setCookie(req,res,next.token);json(res,200,{authenticated:true,email,csrf:next.csrf,...state()});return true;
    }
    if(!session)throw error('Inicia sesión para acceder al editor.',401);
    if(mutating&&req.headers['x-journal-csrf']!==session.csrf)throw error('La sesión debe actualizarse antes de continuar.',403);
    if(pathname===PREFIX+'/logout'&&req.method==='POST'){store.logout(token);setCookie(req,res,'',0);json(res,200,{ok:true});return true}
    if(pathname===PREFIX+'/settings/gemini'&&req.method==='POST'){
     const body=await jsonBody(req);const key=string(body.apiKey,4096);const nextModel=string(body.model,100)||'gemini-3.8-flash';
     // Keys are opaque: authorization keys contain punctuation and can be longer than legacy keys.
     if(key&&!/^[\x21-\x7e]{20,4096}$/.test(key))throw error('Pega la clave completa de Google AI Studio, sin espacios ni saltos de línea en su interior.');
     if(!/^gemini-[a-zA-Z0-9.-]+$/.test(nextModel))throw error('El modelo de Gemini no es válido.');
     if(key){writeFileSync(keyFile+'.tmp',key,{mode:0o600});renameSync(keyFile+'.tmp',keyFile)}
     writeFileSync(modelFile,nextModel,{mode:0o600});json(res,200,state());return true;
    }
    if(pathname===PREFIX+'/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="periovox-journal-backup.json"');json(res,200,{version:1,exportedAt:new Date().toISOString(),articles:store.list()});return true}
    if(pathname===PREFIX+'/uploads'&&req.method==='POST'){
     const bytes=await bodyBuffer(req,8*1024*1024);let ext;
     if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
     else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
     else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
     else throw error('Sube una imagen PNG, JPG o WebP.',415);
     const filename=randomUUID()+'.'+ext;writeFileSync(path.join(uploads,filename),bytes,{mode:0o600});json(res,201,{url:'/journal-media/'+filename});return true;
    }
    if(pathname===PREFIX+'/articles'&&req.method==='GET'){json(res,200,{articles:store.list()});return true}
    if(pathname===PREFIX+'/articles'&&req.method==='POST'){const body=await jsonBody(req);const draft=normalize(body);json(res,201,{article:store.save(draft)});return true}
    const match=pathname.match(/^\/api\/journal\/articles\/([a-f0-9-]+)(?:\/(translate|publish|unpublish|metadata))?$/);
    if(match){const [,id,action]=match;let article=store.get(id);if(!article)throw error('Artículo no encontrado.',404);
     if(!action&&req.method==='GET'){json(res,200,{article});return true}
     if(!action&&req.method==='PUT'){const body=await jsonBody(req);json(res,200,{article:store.save(normalize(body,article),body.revision)});return true}
     if(req.method==='POST'&&action){const body=await jsonBody(req);if(body.revision!==article.revision)throw error('El borrador ha cambiado. Recárgalo antes de continuar.',409);
      if(action==='metadata'){json(res,200,await completeMetadata(article,body.language??'es',body.scope??'all'));return true}
      if(action==='translate'){validateComplete(article.es);({article}=await completeMetadata(article,'es','all',true));article=await english(article);({article}=await completeMetadata(article,'en','all',true));json(res,200,{article});return true}
      if(action==='publish'){
       validateComplete(article.es);({article}=await completeMetadata(article,'es','all',true));if(article.cover&&!article.es.coverAlt)throw error('Añade una descripción a la imagen de portada antes de publicar.');if(body.bilingual!==false){article=await english(article);({article}=await completeMetadata(article,'en','all',true))}
       const now=new Date().toISOString();const snapshot={es:article.es,...(body.bilingual!==false?{en:article.en}:{}),author:article.author,reviewer:article.reviewer,category:article.category,cover:article.cover,publishedAt:article.published?.publishedAt??now,modifiedAt:now};
       json(res,200,{article:store.publish(id,article.revision,snapshot)});return true;
      }
      if(action==='unpublish'){json(res,200,{article:store.unpublish(id)});return true}
     }
    }
    throw error('Ruta no encontrada.',404);
   }
   if(!['GET','HEAD'].includes(req.method??'GET'))throw error('Método no permitido.',405);
   if(image){const filename=pathname.slice('/journal-media/'.length);if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(filename))throw error('Imagen no encontrada.',404);const file=path.join(uploads,filename);if(!existsSync(file))throw error('Imagen no encontrada.',404);res.setHeader('Content-Type','image/'+(filename.endsWith('.jpg')?'jpeg':filename.split('.').pop()));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public,max-age=31536000,immutable');res.setHeader('Content-Length',(await stat(file)).size);if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);return true}
   if(pathname==='/sitemap-journal.xml'||pathname==='/sitemap.xml'){
    const xmlEscape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const urls=store.list().filter(a=>a.published).flatMap(a=>['es','en'].filter(lang=>a.published[lang]).map(lang=>{const p=a.published;const base=lang==='es'?'/es/journal/':'/journal/';return '<url><loc>https://periovox.ai'+base+xmlEscape(p[lang].slug)+'/</loc><lastmod>'+p.modifiedAt+'</lastmod>'+['es','en'].filter(l=>p[l]).map(l=>'<xhtml:link rel="alternate" hreflang="'+l+'" href="https://periovox.ai'+(l==='es'?'/es/journal/':'/journal/')+xmlEscape(p[l].slug)+'/"/>').join('')+'</url>'}));
    let result;if(pathname==='/sitemap.xml'){const original=await readFile(path.join(root,'dist/sitemap.xml'),'utf8');result=original.replace('</urlset>',urls.join('\n')+'\n</urlset>')}else result='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+urls.join('')+'</urlset>';
    res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?'':result);return true;
   }
   const match=pathname.match(/^\/(es\/)?journal(?:\/([^/]+))?\/?$/);if(!match)throw error('Página no encontrada.',404);
   const lang=match[1]?'es':'en',slug=match[2];const admin=slug==='admin';
   if(admin&&lang==='es'){res.statusCode=302;res.setHeader('Location','/journal/admin/');res.end();return true}
   const canonical=(lang==='es'?'/es/journal/':'/journal/')+(slug?slug+'/':'');
   if(pathname!==canonical){res.statusCode=308;res.setHeader('Location',canonical);res.end();return true}
   const post=slug&&!admin?store.resolve(lang,slug):null;if(slug&&!admin&&!post)throw error('Artículo no encontrado.',404);
   if(post&&post[lang].slug!==slug){res.statusCode=301;res.setHeader('Location',(lang==='es'?'/es/journal/':'/journal/')+post[lang].slug+'/');res.end();return true}
   const posts=admin||post?[]:store.published(lang).map(item=>({...item,es:{...item.es,body:''},...(item.en?{en:{...item.en,body:''}}:{})}));
   const props={lang,admin,posts,post};
   html(res,200,req.method==='HEAD'?'':await renderPage(props),admin);return true;
  }catch(e){if(res.headersSent){res.end();return true}if(isApi)json(res,e.status??500,{error:e.status?e.message:'No se ha podido completar la operación. El borrador anterior se conserva.'});else{const fallback=existsSync(path.join(root,'dist/404.html'))?readFileSync(path.join(root,'dist/404.html'),'utf8'):'<!doctype html><html><head><meta name="robots" content="noindex"/></head><body><h1>Página no disponible</h1></body></html>';html(res,e.status??503,fallback)}return true}
 };
 return {handler,store,state};
}
