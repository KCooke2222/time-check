import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(() => {
  const isDemo = process.env.VITE_DEMO_MODE === 'true';
  // Base path for serving under a prefix (e.g. /time behind the view hub).
  const base = ('/' + (process.env.VITE_BASE_PATH || '/').replace(/^\/+|\/+$/g, '')).replace(/\/$/, '') + '/';
  const target = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';
  const proxy = { '/api': { target, changeOrigin: true } };
  if (base !== '/') {
    const prefix = base.slice(0, -1);
    proxy[`${prefix}/api`] = { target, changeOrigin: true, rewrite: (p) => p.slice(prefix.length) };
  }

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: isDemo ? [
        {
          find: /(.*)\/services\/api$/,
          replacement: path.resolve(__dirname, 'src/services/api.mock.js'),
        },
      ] : [],
    },
    server: {
      port: 5173,
      allowedHosts: ['localhost', '.localhost'],
      proxy,
    }
  };
});
