import {access,copyFile,mkdir,rm} from 'node:fs/promises';
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
console.log('Journal Workflow Preview function, private SSR assets and dynamic paths verified.');
