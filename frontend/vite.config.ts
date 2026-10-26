import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CHART_PACKAGES = ['recharts', 'd3-', 'victory-vendor', 'internmap', 'decimal.js-light'];

/** Long-lived vendor chunks: React rarely changes; the charting stack is the bulk of the bundle. */
function vendorChunk(id: string): string | undefined {
  const pkg = id.split('/node_modules/').at(-1);
  if (pkg === undefined || pkg === id) return undefined;
  return CHART_PACKAGES.some((name) => pkg.startsWith(name)) ? 'charts' : 'vendor';
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
});
