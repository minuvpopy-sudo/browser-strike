import { defineConfig } from 'vite';

const buildVersion = Date.now().toString(36);

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { __BUILD_VERSION__: JSON.stringify(buildVersion) },
  plugins: [{
    name: 'browser-strike-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildVersion })
      });
    }
  }],
  build: { target: 'es2020', sourcemap: true }
});
