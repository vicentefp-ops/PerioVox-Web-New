import {copyFile,rm,writeFile} from 'node:fs/promises';
// Keep static pages and the live editorial sitemap separate so new posts need no rebuild.
await copyFile('dist/sitemap.xml','dist/sitemap-pages.xml');
await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<sitemap><loc>https://periovox.ai/sitemap-pages.xml</loc></sitemap>\n<sitemap><loc>https://periovox.ai/sitemap-journal.xml</loc></sitemap>\n</sitemapindex>\n');
// Journal HTML always comes from the persistent origin.
for(const file of ['dist/journal','dist/es/journal'])await rm(file,{recursive:true,force:true});
