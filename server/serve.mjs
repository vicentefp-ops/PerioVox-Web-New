import {createServer} from 'node:http';
import {createReadStream,existsSync} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createJournalHandler} from './journal-http.mjs';
import {initializeJournalStorage} from './journal-bootstrap.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
if(!existsSync(path.join(dist,'index.html')))throw new Error('Run npm run build before starting the server.');
await initializeJournalStorage({directory:process.env.JOURNAL_DATA_DIR||path.join(root,'.journal-data'),seedPath:path.join(root,'journal-seed.enc'),key:process.env.JOURNAL_BOOTSTRAP_KEY});
const {renderJournalDocument}=await import(pathToFileURL(path.join(root,'dist-server/journal-entry.js')).href);
const service=createJournalHandler({root,renderPage:props=>renderJournalDocument(props,root)});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{
 try{
  if(req.url==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(JSON.stringify({ok:true,journal:true}));return}
  if(process.env.JOURNAL_INTERNAL_HOSTS&&req.url==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-cache'});res.end('User-agent: *\nDisallow: /\nAllow: /assets/\nAllow: /fonts/\nAllow: /media/\n');return}
  if(await service.handler(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(dist,'.'+pathname);
  if(!target.startsWith(dist+path.sep)&&target!==dist||pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return}
  let info=await stat(target).catch(()=>null);
  if(info?.isDirectory()){if(!pathname.endsWith('/')){res.writeHead(308,{Location:pathname+'/'});res.end();return}target=path.join(target,'index.html');info=await stat(target).catch(()=>null)}
  if(!info?.isFile()){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex'});res.end(req.method==='HEAD'?'':await readFile(path.join(dist,'404.html')));return}
  res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control',pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache');if(/^\/(?:assets|fonts|media)\//.test(pathname))res.setHeader('Access-Control-Allow-Origin','*');
  let start=0,end=info.size-1,status=200;const range=req.method==='GET'?req.headers.range:null;
  if(range){const match=range.match(/^bytes=(\d*)-(\d*)$/);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return}if(!match[1])start=Math.max(0,info.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}if(start> end||start>=info.size||start<0){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`)}
  res.statusCode=status;res.setHeader('Content-Length',info.size?end-start+1:0);if(req.method==='HEAD'||!info.size)res.end();else createReadStream(target,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }catch{if(!res.headersSent){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Unable to serve this page.')}else res.destroy()}
});
const port=Number(process.env.PORT||3201),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`PerioVox Web + Journal ready at http://${host}:${port}`));
function close(){server.close(()=>{service.store.close();process.exit(0)})}process.on('SIGINT',close);process.on('SIGTERM',close);
