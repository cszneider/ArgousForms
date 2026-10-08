import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
register('./helpers/jsx-loader.js', import.meta.url);

test('tela cadastra, confirma com zeros iniciais e não cria sessão local; retomada trata falha SMTP', async () => {
  const browser = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/cadastro' });
  globalThis.window = browser.window;
  globalThis.document = browser.window.document;
  globalThis.HTMLElement = browser.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { CacheProvider } = await import('@emotion/react');
  const { default: createCache } = await import('@emotion/cache');
  const { default: Cadastro } = await import('../src/interface/cadastro/index.js');
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  const calls = [];
  let resolver;
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Promise((resolve) => { resolver = (dados) => resolve({ ok: true, json: async () => ({ status: 'ok', dados }) }); });
  };
  const mount = (key) => act(async () => root.render(createElement(CacheProvider, { value: createCache({ key: 'test' }) }, createElement(Cadastro, { key }))));
  const fill = async (selector, value) => act(async () => {
    const input = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(browser.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new browser.window.Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => document.querySelector('form').dispatchEvent(new browser.window.Event('submit', { bubbles: true, cancelable: true })));
  const id = '8b38a660-64d9-4eac-bc7e-c8a7b44f230f';
  try {
    await mount('novo');
    await fill('input[autocomplete="name"]', 'Pessoa');
    await fill('input[type="email"]', 'pessoa@example.com');
    await fill('input[type="password"]', ' senha com espaços ');
    await submit();
    await submit();
    assert.equal(calls.length, 1, 'duplo envio deve ser bloqueado');
    assert.equal(calls[0].dados.senha, ' senha com espaços ');
    assert.ok(document.querySelector('button[type="submit"]').disabled);
    await act(async () => resolver({ idConfirmacao: id, emailEnviado: true, confirmacaoPendente: true }));
    assert.match(document.querySelector('h2').textContent, /Confirme/);
    await fill('input[autocomplete="one-time-code"]', '00123456');
    await submit();
    assert.deepEqual(calls[1], { operacao: 'CONFIRMAR_EMAIL', dados: { email: 'pessoa@example.com', idConfirmacao: id, codigo: '00123456' } });
    await act(async () => resolver({ emailConfirmado: true, autenticada: false }));
    assert.match(document.body.textContent, /liberação de um administrador/);
    assert.equal(browser.window.localStorage.length, 0);
    assert.equal(browser.window.sessionStorage.length, 0);
    assert.equal(document.querySelector('form'), null);

    await mount('retomar');
    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Retomar cadastro').click());
    assert.equal(document.querySelector('input[autocomplete="name"]'), null);
    await fill('input[type="email"]', 'pessoa@example.com');
    await fill('input[type="password"]', ' senha com espaços ');
    await submit();
    assert.equal(calls[2].operacao, 'REENVIAR_CONFIRMACAO');
    await act(async () => resolver({ idConfirmacao: id, emailEnviado: false, confirmacaoPendente: true }));
    assert.match(document.body.textContent, /cadastro foi salvo/);
    assert.match(document.body.textContent, /Reenviar em/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    browser.window.close();
  }
});
