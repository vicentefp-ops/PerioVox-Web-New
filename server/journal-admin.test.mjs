import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const {build}=createRequire(import.meta.resolve('vite'))('esbuild');

// Render the real editor with fictional in-memory API responses. No website is opened.
test('updating ES + EN preserves confirmation and saves the next edit',async t=>{
 const dom=new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
 const keys=['window','document','navigator','Node','HTMLElement','Element','DocumentFragment','MutationObserver','DOMParser','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','fetch'];
 const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys.filter(key=>!['fetch','IS_REACT_ACT_ENVIRONMENT'].includes(key)))Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.confirm=()=>true;
 const directory=await mkdtemp(path.resolve('node_modules/.journal-admin-test-'));
 const output=path.join(directory,'admin.mjs');
 await build({entryPoints:['src/JournalAdmin.tsx'],outfile:output,bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent'});
 const {createElement,act}=await import('react');
 const {createRoot}=await import('react-dom/client');
 const {default:JournalAdmin}=await import(pathToFileURL(output).href);
 const text={title:'Artículo ficticio',summary:'Subtítulo de prueba.',body:'Contenido de prueba.',slug:'articulo-ficticio',seoTitle:'Artículo ficticio',seoDescription:'Descripción de prueba.',coverAlt:''};
 let article={id:'fictional-id',revision:1,es:text,en:{...text,title:'Fictional article'},author:'Test editor',reviewer:'',category:'guides',cover:'',published:{es:text,en:{...text,title:'Fictional article'}}};
 const requests=[];let publishing,fail=false;
 globalThis.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):undefined;requests.push({url,method:options.method||'GET',body});
  if(url.endsWith('/session'))return Response.json({authenticated:true,email:'editor@example.test',csrf:'fictional-csrf',translationReady:true});
  if(url.endsWith('/articles'))return Response.json({articles:[structuredClone(article)]});
  if(options.method==='PUT'){assert.equal(body.revision,article.revision);article={...body,revision:article.revision+1};return Response.json({article:structuredClone(article)})}
  if(url.endsWith('/publish')){
   assert.equal(body.revision,article.revision);assert.equal(body.bilingual,true);
   await new Promise(resolve=>{publishing=resolve});
   if(fail)return Response.json({error:'Proveedor de traducción no disponible.'},{status:502});
   article={...article,revision:article.revision+1,published:{es:article.es,en:article.en}};
   return Response.json({article:structuredClone(article)});
  }
  return Response.json({article:structuredClone(article)});
 };
 const root=createRoot(document.getElementById('test-root'));
 t.after(async()=>{await act(()=>root.unmount());await rm(directory,{recursive:true,force:true});dom.window.close();for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]});
 const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,25))});
 const click=async element=>{assert(element,'The expected editor control is present');await act(()=>element.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await settle()};
 const publish=()=>document.querySelector('.editor-publish');
 await act(()=>root.render(createElement(JournalAdmin)));await settle();
 await click(document.querySelector('.editor-post-list button'));
 assert.match(document.querySelector('.editor-saved')?.textContent||'',/Guardado/);
 await click(publish());
 assert.equal(publish().disabled,true);assert.match(publish().textContent,/publicando/);
 await act(async()=>publishing());await settle();
 assert.match(document.querySelector('.editor-notice')?.textContent||'',/Artículo publicado en español e inglés/);
 assert.equal(document.querySelector('.editor-unsaved'),null,'Unlocking after publish must not dirty the article or clear success');
 assert.equal(requests.filter(r=>r.method==='PUT').length,0,'Publishing an unchanged article must not invent an edit');
 const title=document.querySelector('.editor-title-input');
 await act(()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(title,'Título corregido');title.dispatchEvent(new window.Event('input',{bubbles:true}))});
 assert.match(document.querySelector('.editor-unsaved')?.textContent||'',/Cambios sin guardar/);
 assert.equal(document.querySelector('.editor-notice'),null);
 await click(publish());await act(async()=>publishing());await settle();
 assert.equal(article.published.es.title,'Título corregido');
 assert.equal(requests.filter(r=>r.method==='PUT').length,1);
 assert.match(document.querySelector('.editor-notice')?.textContent||'',/Artículo publicado en español e inglés/);
 fail=true;await click(publish());await act(async()=>publishing());await settle();
 assert.match(document.querySelector('[role="alert"]')?.textContent||'',/Proveedor de traducción no disponible/);
 assert.equal(publish().disabled,false,'A failed update must allow retry');
 assert.equal(article.published.es.title,'Título corregido','Failure preserves the last publication');
});
