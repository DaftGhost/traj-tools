import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const mbtilesPort = process.env.MBTILES_PORT ?? '3001';

export default defineConfig({
  plugins: [vue()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/mbtiles': {
        target: `http://127.0.0.1:${mbtilesPort}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      'leaflet.vectorgrid': '/src/utils/leafletVectorGridShim.ts',
    },
  },
});
