import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithOxc } from 'vite';

const jsxInJs = {
  name: 'webhook-jsx-in-js',
  enforce: 'pre',
  transform(code, id) {
    const filename = id.split('?')[0];
    if (filename.includes('/src/') && filename.endsWith('.js')) {
      return transformWithOxc(code, filename, {
        lang: 'jsx', jsx: { runtime: 'automatic' }, sourcemap: true,
      });
    }
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'WEBHOOK_');
  const backend = new URL(env.WEBHOOK_BACKEND_URL || 'http://localhost:8080/WebHookJUniAGForms');
  const proxy = {
    '/WebHookJUniAGForms/api': {
      target: backend.origin,
      changeOrigin: true,
      rewrite: (path) => path.replace('/WebHookJUniAGForms', backend.pathname.replace(/\/$/, '')),
    },
  };
  return {
    base: '/WebHookJUniAGForms/',
    plugins: [jsxInJs, react()],
    optimizeDeps: { rolldownOptions: { plugins: [jsxInJs] } },
    build: { outDir: 'dist/war' },
    server: { strictPort: true, proxy },
    preview: { strictPort: true, proxy },
  };
});
