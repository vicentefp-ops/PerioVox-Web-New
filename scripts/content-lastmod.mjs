import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const manifestPath=path.join(path.dirname(fileURLToPath(import.meta.url)),'page-lastmod.json');
// Content files only. A commit that does not touch them must not refresh lastmod.
export const routeSources={
 home:['src/App.tsx','src/translations.ts','src/seo.ts','src/ChartScroll.tsx'],
 resources:['src/Resources.tsx','src/resources-content.ts','src/ResourceLinks.tsx','src/seo.ts'],
 guide:['src/resources-content.ts','src/Resources.tsx','src/seo.ts'],
 journal:['src/Journal.tsx','src/journal-model.ts','src/journal-seo.ts']
};
export function gitLastmod(files){
 try{
  const out=execFileSync('git',['log','-1','--format=%cs','--',...files],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(out)?out:null;
 }catch{return null}
}
export function readLastmodManifest(){
 try{return JSON.parse(readFileSync(manifestPath,'utf8'))}catch{return {}}
}
export function writeLastmodManifest(manifest){
 const ordered=Object.fromEntries(Object.entries(manifest).sort(([a],[b])=>a.localeCompare(b)));
 writeFileSync(manifestPath,JSON.stringify(ordered,null,2)+'\n');
}
