import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(() => {
  const isDemo = process.env.VITE_DEMO_MODE === 'true';

  return {
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
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  };
});
