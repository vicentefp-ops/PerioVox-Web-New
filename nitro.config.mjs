import {defineConfig} from 'nitro';

const journalRoutes=['/api/journal/**','/journal','/journal/**','/es/journal','/es/journal/**',
  '/journal-media/**','/sitemap-journal.xml'];

export default defineConfig({
  serverDir: './workflow-preview',
  modules: ['workflow/nitro'],
  workflow: {runtime: 'nodejs24.x'},
  preset: 'vercel',
  vercel: {entryFormat: 'node'},
  renderer: false,
  publicAssets: [{dir:'dist',baseURL:'/'}],
  handlers: journalRoutes.map(route=>({route,handler:'./api/journal.mjs',format:'node'})),
  routeRules: {'/**': {headers: {'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store'}}},
});
