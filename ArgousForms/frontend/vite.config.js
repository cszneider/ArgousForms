import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithOxc } from 'vite';
import { fileURLToPath } from 'node:url';

const jsxInJs = {
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
};

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
    '/ArgousForms/upload-arquivo': {
      target: backend.origin,
      changeOrigin: true,
      rewrite: () => `${backend.pathname.replace(/\/$/, '')}/upload-arquivo`,
    },
    '/ArgousForms/arquivo-conteudo': {
      target: backend.origin,
      changeOrigin: true,
      rewrite: (path) => path.replace(
        /^\/ArgousForms\/arquivo-conteudo/,
        `${backend.pathname.replace(/\/$/, '')}/arquivo-conteudo`,
      ),
    },
  };
  return {
    base: '/ArgousForms/',
    build: {
      outDir: 'dist/war',
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    optimizeDeps: {
      entries: ['index.html'],
      rolldownOptions: { plugins: [jsxInJs] },
    },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: {
      proxy,
      port: 3002,
      strictPort: true,
      watch: { useFsEvents: false, usePolling: true },
    },
    preview: { proxy },
    plugins: [jsxInJs, react()],
  };
});
