// Compatible entrypoint for managed Node.js process loaders.
import('./server/serve.mjs').catch(error=>{console.error('Journal startup failed:',error.message);process.exit(1)});
