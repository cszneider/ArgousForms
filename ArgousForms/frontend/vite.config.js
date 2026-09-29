import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, transformWithOxc } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    port: 3002,
    strictPort: true,
    watch: { useFsEvents: false, usePolling: true },
  },
  plugins: [
    {
      name: 'argous-jsx-in-js',
      enforce: 'pre',
      transform(code, id) {
        const filename = id.split('?')[0];
        if (filename.includes('/src/') && filename.endsWith('.js')) {
          return transformWithOxc(code, filename, {
            lang: 'jsx',
            jsx: { runtime: 'automatic' },
            sourcemap: true,
          });
        }
      },
    },
    vinext(),
  ],
});
