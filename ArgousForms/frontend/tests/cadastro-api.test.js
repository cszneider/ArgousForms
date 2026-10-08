import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chamarCadastro } from '../src/programas/cadastro/api.js';

const id = '8b38a660-64d9-4eac-bc7e-c8a7b44f230f';
const pendente = { idConfirmacao: id, confirmacaoPendente: true, emailEnviado: true };
const resposta = (dados) => ({ ok: true, status: 202, json: async () => ({ status: 'ok', dados }) });

test('cadastro envia POST JSON ao resolver, preserva a senha e não segue redirecionamentos', async () => {
  let calls = 0;
  const dados = { nome: 'Pessoa', email: 'pessoa@example.com', senha: ' senha com espaços ' };
  const result = await chamarCadastro('CADASTRAR_USUARIO', dados, { fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, '/ArgousForms/argousforms.iarslvr');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.deepEqual(JSON.parse(options.body), { operacao: 'CADASTRAR_USUARIO', dados });
    return resposta(pendente);
  } });
  assert.deepEqual(result, pendente);
  assert.equal(calls, 1);
});

test('SMTP não confirmado continua sendo um cadastro pendente, não uma falha de gravação', async () => {
  const result = await chamarCadastro('REENVIAR_CONFIRMACAO', {}, { fetchImpl: async () => resposta({ ...pendente, emailEnviado: false }) });
  assert.equal(result.emailEnviado, false);
  assert.equal(result.idConfirmacao, id);
});

test('confirmação exige confirmação explícita no contrato da resposta', async () => {
  await assert.rejects(chamarCadastro('CONFIRMAR_EMAIL', {}, { fetchImpl: async () => resposta({}) }));
  const result = await chamarCadastro('CONFIRMAR_EMAIL', {}, { fetchImpl: async () => resposta({ emailConfirmado: true, autenticada: false }) });
  assert.equal(result.autenticada, false);
});

test('erros do servidor são traduzíveis e não exibem mensagens internas', async () => {
  await assert.rejects(chamarCadastro('CONFIRMAR_EMAIL', {}, { fetchImpl: async () => ({ ok: false, status: 400,
    json: async () => ({ status: 'erro', codigoErro: 'CODIGO_INVALIDO', mensagem: 'detalhe interno privado' }) }) }),
  (error) => error.codigo === 'CODIGO_INVALIDO' && !error.message.includes('privado'));
});

test('falha de rede não repete a gravação e orienta a retomada', async () => {
  let calls = 0;
  await assert.rejects(chamarCadastro('CADASTRAR_USUARIO', {}, { fetchImpl: async () => { calls++; throw new TypeError('network'); } }), /Retomar cadastro/);
  assert.equal(calls, 1);
});

test('resposta HTML de proxy e identificador inválido não avançam o cadastro', async () => {
  await assert.rejects(chamarCadastro('CADASTRAR_USUARIO', {}, { fetchImpl: async () => ({ json: async () => { throw new SyntaxError(); } }) }), /servidor/);
  await assert.rejects(chamarCadastro('CADASTRAR_USUARIO', {}, { fetchImpl: async () => resposta({ ...pendente, idConfirmacao: 'inválido' }) }), /servidor/);
});
