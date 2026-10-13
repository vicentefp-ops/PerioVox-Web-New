import {renderToString} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import Journal from './Journal';
import JournalAdmin from './JournalAdmin';
import {journalHead} from './journal-seo';
import type {JournalProps} from './journal-model';
export function renderJournalDocument(props:JournalProps,root:string){
 const assetOrigin=process.env.JOURNAL_ASSET_ORIGIN?new URL(process.env.JOURNAL_ASSET_ORIGIN).origin:'';
 const manifest=JSON.parse(readFileSync(path.join(root,'dist/.vite/manifest.json'),'utf8'));const styles=new Set<string>(),scripts=new Set<string>();
 const seen=new Set<string>();
 const collect=(key:string)=>{if(seen.has(key))return;seen.add(key);const entry=manifest[key];if(!entry)throw new Error('Journal bundle missing: '+key);entry.css?.forEach((file:string)=>styles.add(file));if(entry.file.endsWith('.js'))scripts.add(entry.file);entry.imports?.forEach(collect)};
 const template=readFileSync(path.join(root,'dist/index.html'),'utf8');
 const main=template.match(/<script\b(?=[^>]*type="module")[^>]*src="\/([^"]+)"/)?.[1];
 if(!main)throw new Error('Journal entry script missing');
 const mainKey=Object.keys(manifest).find(key=>manifest[key].file===main);if(!mainKey)throw new Error('Journal entry manifest missing');
 collect(mainKey);collect(props.admin?'src/JournalAdmin.tsx':'src/Journal.tsx');
 const assets=[...styles].map(file=>`<link rel="stylesheet" crossorigin href="${assetOrigin}/${file}"/>`).concat([...scripts].filter(file=>file!==main).map(file=>`<link rel="modulepreload" crossorigin href="${assetOrigin}/${file}"/>`)).join('\n');
 const data=JSON.stringify(props).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const markup=renderToString(props.admin?<JournalAdmin/>:<Journal {...props}/>);
 return `<!doctype html><html lang="${props.admin?'es':props.lang}"><head>${journalHead(props)}\n${assets}</head><body><div id="root">${markup}</div><script id="journal-data" type="application/json">${data}</script><script type="module" crossorigin src="${assetOrigin}/${main}"></script></body></html>`;
}
