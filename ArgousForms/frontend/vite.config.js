import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv, transformWithOxc } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => {
  const env = loadEnv(
    mode,
    fileURLToPath(new URL('.', import.meta.url)),
    'ARGOUSFORMS_',
  );
  const backend = new URL(
    env.ARGOUSFORMS_BACKEND_URL || 'http://localhost:8080/ArgousForms',
  );
  const proxy = {
    '/ArgousForms/argousforms.iarslvr': {
      target: backend.origin,
      changeOrigin: true,
      rewrite: () =>
        `${backend.pathname.replace(/\/$/, '')}/argousforms.iarslvr`,
    },
  };
  return {
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      proxy,
      port: 3002,
      strictPort: true,
      watch: { useFsEvents: false, usePolling: true },
    },
    preview: { proxy },
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
  };
});
