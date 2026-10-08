import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
register('./helpers/jsx-loader.js', import.meta.url);

test('abrir o login executa três verificações e informa a origem ausente', async () => {
  const browser = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/login' });
  globalThis.window = browser.window;
  globalThis.document = browser.window.document;
  globalThis.HTMLElement = browser.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { CacheProvider } = await import('@emotion/react');
  const { default: createCache } = await import('@emotion/cache');
  const { default: Login } = await import('../src/interface/login/index.js');
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (_url, options) => {
    const { operacao } = JSON.parse(options.body);
    chamadas.push(operacao);
    if (operacao === 'VERIFICAR_ORIGEM_LOCAL') {
      return { ok: false, json: async () => ({ status: 'erro', codigoErro: 'ORIGEM_LOCAL_AUSENTE' }) };
    }
    const dados = operacao === 'PING'
      ? { dataHoraSistema: '2026-10-07T10:00:00-03:00' }
      : { bancoDisponivel: true };
    return { ok: true, json: async () => ({ status: 'ok', dados }) };
  };

  try {
    await act(async () => root.render(createElement(CacheProvider, { value: createCache({ key: 'test' }) }, createElement(Login))));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    assert.deepEqual(chamadas, ['PING', 'VERIFICAR_BANCO', 'VERIFICAR_ORIGEM_LOCAL']);
    const diagnosticos = document.querySelector('.login-diagnostics');
    assert.match(diagnosticos.textContent, /Servidor ativo/);
    assert.match(diagnosticos.textContent, /Conexão com o banco disponível/);
    assert.match(diagnosticos.textContent, /CD_ORIGEM = 1/);
    assert.equal(diagnosticos.querySelectorAll('[data-state="erro"]').length, 1);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    browser.window.close();
  }
});
