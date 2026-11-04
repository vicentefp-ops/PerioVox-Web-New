import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const {build}=createRequire(import.meta.resolve('vite'))('esbuild');
test('editor chunks 8MiB, preserves existing cover on interruption, permits repeated retry',async t=>{
 const dom=new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
 const keys=['window','document','navigator','Node','HTMLElement','Element','DocumentFragment','MutationObserver','DOMParser','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','fetch'];
 const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const key of keys.filter(key=>!['fetch','IS_REACT_ACT_ENVIRONMENT'].includes(key)))Object.defineProperty(globalThis,key,{configurable:true,value:['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(key)?dom.window[key].bind(dom.window):dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.confirm=()=>true;
 const directory=await mkdtemp(path.resolve('node_modules/.journal-upload-test-')),output=path.join(directory,'admin.mjs');
 await build({entryPoints:['src/JournalAdmin.tsx'],outfile:output,bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent'});
 const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client'),{default:JournalAdmin}=await import(pathToFileURL(output).href);
 const text={title:'Fictional article',summary:'Summary',body:'Body',slug:'fictional',seoTitle:'Title',seoDescription:'Description',coverAlt:'Old cover'};
 const article={id:'fictional-id',revision:1,es:text,en:null,author:'Test editor',reviewer:'',category:'guides',cover:'/journal-media/abcd.png',published:null};
 let interrupt=true,beginCount=0,completeCount=0;const chunks=[];
 globalThis.fetch=async(url,options={})=>{
  if(url.endsWith('/session'))return Response.json({authenticated:true,email:'editor@example.test',csrf:'fictional-csrf',uploadMode:'chunks'});
  if(url.endsWith('/articles'))return Response.json({articles:[article]});
  assert.equal(options.headers['X-Journal-CSRF'],'fictional-csrf');
  if(url.endsWith('/uploads/begin')){assert.equal(JSON.parse(options.body).size,8*1024*1024);return Response.json({ticket:'ticket-'+(++beginCount),chunkBytes:2*1024*1024})}
  if(url.includes('/uploads/chunk?')){
   const index=Number(new URL(url,'http://localhost').searchParams.get('index'));
   assert.equal(options.body.size,2*1024*1024);assert.equal(options.headers['X-Journal-Upload'],'ticket-'+beginCount);chunks.push({run:beginCount,index});
   if(interrupt&&index===1)throw new TypeError('Conexión interrumpida');
   return Response.json({receipt:'receipt-'+index});
  }
  if(url.endsWith('/uploads/complete')){completeCount++;assert.deepEqual(JSON.parse(options.body),{ticket:'ticket-'+beginCount,receipts:[0,1,2,3].map(n=>'receipt-'+n)});return Response.json({url:'/journal-media/ef0123.png'})}
  throw Error('Unexpected request '+url);
 };
 const root=createRoot(document.getElementById('test-root'));
 t.after(async()=>{await act(()=>root.unmount());await rm(directory,{recursive:true,force:true});dom.window.close();for(const [key,descriptor] of previous)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]});
 const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,25))});
 await act(()=>root.render(createElement(JournalAdmin)));await settle();
 await act(()=>document.querySelector('.editor-post-list button').dispatchEvent(new window.MouseEvent('click',{bubbles:true})));await settle();
 const input=document.querySelector('.editor-upload input');
 const file=new File([new Uint8Array(8*1024*1024)],'fictional.png',{type:'image/png'});
 async function upload(){Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));await settle()}
 await upload();
 assert.match(document.querySelector('[role="alert"]').textContent,/Conexión interrumpida/);
 assert.equal(document.querySelector('.editor-cover-field>img').getAttribute('src'),'/journal-media/abcd.png');
 assert.equal(completeCount,0);assert.equal(document.querySelector('fieldset').disabled,false);
 interrupt=false;await upload();
 assert.equal(document.querySelector('.editor-cover-field>img').getAttribute('src'),'/journal-media/ef0123.png');
 assert.equal(document.querySelector('[role="alert"]'),null);assert.equal(completeCount,1);
 await upload();assert.equal(completeCount,2);assert.equal(beginCount,3);
 assert.deepEqual(chunks.filter(item=>item.run===2).map(item=>item.index),[0,1,2,3]);
});
