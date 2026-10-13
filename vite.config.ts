import react from '@vitejs/plugin-react';
import {journalPlugin} from './server/journal-plugin.mjs';
import {defineConfig} from 'vite';
import path from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import {findRoute} from './src/resources-content';
export default defineConfig({plugins:[react(),journalPlugin(path.resolve()),{
 name:'static-preview-404',configurePreviewServer(server){server.middlewares.use((req,res,next)=>{
  const pathname=new URL(req.url??'/','http://localhost').pathname;
  if(!['GET','HEAD'].includes(req.method??'GET')||findRoute(pathname))return next();
  const dist=path.resolve('dist');const candidate=path.resolve(dist,'.'+decodeURIComponent(pathname));
  if(candidate.startsWith(dist+path.sep)&&existsSync(candidate))return next();
  res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?'':readFileSync(path.join(dist,'404.html')));
 })}
}],build:{manifest:true,rollupOptions:{input:{main:path.resolve('index.html'),es:path.resolve('es/index.html')}}},server:{host:'127.0.0.1',port:3200,strictPort:true}});
