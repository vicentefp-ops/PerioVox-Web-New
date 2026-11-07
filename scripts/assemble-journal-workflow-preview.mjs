import {access,copyFile,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const output='.vercel/output';
const runtime=join(output,'functions','__server.func');
await access(join(runtime,'.vc-config.json'));
await access(join(output,'functions','.well-known','workflow','v1','flow.func','.vc-config.json'));
for(const file of ['dist/index.html','dist/.vite/manifest.json','dist/404.html']){
 const target=join(runtime,file);
 await mkdir(dirname(target),{recursive:true});
 await copyFile(file,target);
}
// Native static routing runs before Nitro. The Journal routes must use its SSR.
for(const route of ['journal','es/journal','.vite']){
 await rm(join(output,'static',route),{recursive:true,force:true});
}
// The generic Vercel router doesn't resolve Nitro's catch-all .func alias
// under /api reliably. Send the original URL to the actual server function.
const configFile=join(output,'config.json');
const config=JSON.parse(await readFile(configFile,'utf8'));
for(const route of config.routes){
 if(route.dest==='/api/journal/[...]')route.dest='/__server';
}
await writeFile(configFile,JSON.stringify(config,null,2)+'\n');
console.log('Journal Workflow Preview function, private SSR assets and dynamic paths verified.');
