import { defineConfig } from 'vite';

// GitHub Pages serves the site from /peach-garden/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/peach-garden/' : '/',
  build: { chunkSizeWarningLimit: 2000 }, // Phaser alone is ~1.5MB
  // This Mac's /etc/hosts has no "localhost" entry, so avoid resolving that name
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
}));
