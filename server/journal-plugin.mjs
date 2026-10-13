import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createJournalHandler} from './journal-http.mjs';
export function journalPlugin(root){
 function install(server,development=false){
  let render;const renderPage=async props=>{
   if(development){const data=JSON.stringify(props).replace(/</g,'\\u003c');return server.transformIndexHtml(props.lang==='es'?'/es/journal/':'/journal/','<!doctype html><html lang="'+(props.admin?'es':props.lang)+'"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>Journal | PerioVox</title></head><body><div id="root"></div><script id="journal-data" type="application/json">'+data+'</script><script type="module" src="/src/main.tsx"></script></body></html>')}
   render??=import(pathToFileURL(path.join(root,'dist-server/journal-entry.js')).href);return (await render).renderJournalDocument(props,root);
  };
  const service=createJournalHandler({root,renderPage});
  server.middlewares.use((req,res,next)=>{service.handler(req,res).then(handled=>{if(!handled)next()}).catch(next)});
  server.httpServer?.once('close',()=>service.store.close());
 }
 return {name:'periovox-journal',configureServer(server){if(!server.config.server.middlewareMode)install(server,true)},configurePreviewServer(server){install(server)}};
}
