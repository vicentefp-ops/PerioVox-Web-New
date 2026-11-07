import {defineConfig} from 'nitro';

const editorRoutes=['session','login','logout','articles','articles/:id','articles/:id/:action',
  'settings/gemini','uploads','uploads/begin','uploads/chunk','uploads/complete','export','cron'];
const journalRoutes=[...editorRoutes.map(path=>'/api/journal/'+path),
  '/journal','/journal/:slug','/es/journal','/es/journal/:slug','/journal-media/:file','/sitemap-journal.xml'];

export default defineConfig({
  serverDir: './workflow-preview',
  modules: ['workflow/nitro'],
  workflow: {runtime: 'nodejs24.x'},
  preset: 'vercel',
  vercel: {entryFormat: 'node'},
  renderer: false,
  publicAssets: [{dir:'dist',baseURL:'/'}],
  handlers: journalRoutes.map(route=>({route,handler:'./workflow-preview/journal-runtime.mjs',format:'node'})),
  routeRules: {'/**': {headers: {'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store'}}},
});
