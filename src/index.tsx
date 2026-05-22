import { serve } from 'bun';

import index from './index.html';

const port = process.env.PORT
  ? Number.parseInt(process.env.PORT, 10)
  : undefined;

const server = serve({
  development: process.env.NODE_ENV !== 'production' && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true
  },

  port,

  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index
  }
});

// eslint-disable-next-line no-console
console.log(`🚀 Server running at ${server.url}`);
