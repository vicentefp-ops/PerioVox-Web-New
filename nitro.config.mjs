import {defineConfig} from 'nitro';

export default defineConfig({
  serverDir: './workflow-preview',
  modules: ['workflow/nitro'],
  workflow: {runtime: 'nodejs24.x'},
  preset: 'vercel',
  renderer: false,
  noPublicDir: true,
  routeRules: {'/**': {headers: {'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store', 'x-periovox-workflow-check': 'redeploy'}}},
});
