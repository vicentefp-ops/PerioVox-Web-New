import {access,readFile,writeFile} from 'node:fs/promises';
for(const file of ['dist/.vite/manifest.json','dist/index.html','dist/404.html','dist/sitemap-pages.xml','dist-server/journal-entry.js'])await access(file);
// Preview is an isolated deploy, never an indexable copy of production.
if(process.env.VERCEL_ENV!=='production'){
 await writeFile('dist/robots.txt','User-agent: *\nDisallow: /\n');
}
const source=await readFile('api/journal.mjs','utf8');
if(!source.includes('journalRuntimeConfig'))throw new Error('Missing Journal environment guard');
console.log('Journal function assets verified. Deployment still requires isolated storage, schema/import verification and the documented rollout gates.');
