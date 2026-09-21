import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/v2': {
        target: process.env.REGISTRY_UPSTREAM ? `http://${process.env.REGISTRY_UPSTREAM}` : 'http://localhost:5000',
        changeOrigin: false,
      },
    },
  },
});
