import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consultarDiagnostico,
  verificacoes,
} from '../src/programas/login/diagnostico.js';

test('as três verificações enviam operações independentes, sem dados pessoais', async () => {
  const chamadas = [];
  const respostas = {
    PING: { dataHoraSistema: '2026-10-07T10:00:00-03:00' },
    VERIFICAR_BANCO: { bancoDisponivel: true },
    VERIFICAR_ORIGEM_LOCAL: { origemLocalPresente: true },
  };
  const fetchImpl = async (url, options) => {
    chamadas.push({ url, options });
    const { operacao } = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ status: 'ok', dados: respostas[operacao] }),
    };
  };

  for (const { operacao } of verificacoes) {
    assert.deepEqual(await consultarDiagnostico(operacao, { fetchImpl }), respostas[operacao]);
  }

  assert.deepEqual(chamadas.map(({ options }) => JSON.parse(options.body)), [
    { operacao: 'PING', dados: {} },
    { operacao: 'VERIFICAR_BANCO', dados: {} },
    { operacao: 'VERIFICAR_ORIGEM_LOCAL', dados: {} },
  ]);
  assert.ok(chamadas.every(({ url, options }) =>
    url === '/ArgousForms/argousforms.iarslvr' && options.method === 'POST',
  ));
});

test('origem ausente e resposta HTML produzem diagnósticos diferentes', async () => {
  const ausente = async () => ({
    ok: false,
    json: async () => ({ status: 'erro', codigoErro: 'ORIGEM_LOCAL_AUSENTE' }),
  });
  await assert.rejects(
    consultarDiagnostico('VERIFICAR_ORIGEM_LOCAL', { fetchImpl: ausente }),
    /CD_ORIGEM = 1/,
  );

  const html = async () => ({ ok: false, json: async () => { throw new SyntaxError(); } });
  await assert.rejects(
    consultarDiagnostico('PING', { fetchImpl: html }),
    /resposta JSON/,
  );
});
