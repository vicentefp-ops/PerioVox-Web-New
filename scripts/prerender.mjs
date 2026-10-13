import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {renderRoute,siteRoutes,headMarkup,updated}=await server.ssrLoadModule('/src/entry-server.tsx');
 const template=await readFile('dist/index.html','utf8');
 const assets=[...template.matchAll(/<script\b[^>]*type="module"[^>]*><\/script>|<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/g)].map(match=>match[0]).join('\n');
 if(!assets.includes('type="module"')||!assets.includes('rel="stylesheet"'))throw new Error('Build entry assets missing');
 const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
 function pageAssets(key){const css=new Set();const js=new Set();const seen=new Set();function visit(id){if(seen.has(id))return;seen.add(id);const entry=manifest[id];if(!entry)throw new Error('Missing page bundle: '+id);entry.css?.forEach(file=>css.add(file));if(entry.file.endsWith('.js'))js.add(entry.file);entry.imports?.forEach(visit)}visit(key);return [...css].map(file=>`<link rel="stylesheet" crossorigin href="/${file}"/>`).concat([...js].map(file=>`<link rel="modulepreload" crossorigin href="/${file}"/>`)).filter(tag=>!assets.includes(tag.match(/href="([^"]+)"/)[1])).join('\n')}
 for(const route of siteRoutes){
  const directory='dist'+(route.path==='/'?'':route.path.replace(/\/$/,''));const markup=renderRoute(route);
  await mkdir(directory,{recursive:true});
  await writeFile(directory+'/index.html',`<!doctype html><html lang="${route.lang}"><head>${headMarkup(route)}\n${assets}\n${pageAssets(route.kind==='home'?'src/App.tsx':route.kind==='journal'?'src/Journal.tsx':'src/Resources.tsx')}</head><body><div id="root">${markup}</div></body></html>`);
  console.log(`Prerendered ${route.path}: ${markup.length} characters`);
 }
 const origin='https://periovox.ai';
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${siteRoutes.map(route=>{const en=origin+(route.lang==='en'?route.path:route.alternate);const es=origin+(route.lang==='es'?route.path:route.alternate);return `<url><loc>${origin+route.path}</loc><lastmod>${updated}</lastmod><xhtml:link rel="alternate" hreflang="en" href="${en}"/><xhtml:link rel="alternate" hreflang="es" href="${es}"/><xhtml:link rel="alternate" hreflang="x-default" href="${en}"/></url>`}).join('\n')}\n</urlset>\n`;
 await writeFile('dist/sitemap.xml',sitemap);
 await writeFile('public/sitemap.xml',sitemap);
}finally{await server.close()}
