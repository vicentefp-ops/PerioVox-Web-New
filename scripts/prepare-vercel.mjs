import {rm} from 'node:fs/promises';
// Journal pages and sitemap are rendered by the persistent origin, not frozen at build time.
for(const file of ['dist/journal','dist/es/journal','dist/sitemap.xml'])await rm(file,{recursive:true,force:true});
