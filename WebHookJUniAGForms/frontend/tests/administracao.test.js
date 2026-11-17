import test from 'node:test';
import assert from 'node:assert/strict';
import { diasCompletos, horasCompletas, dataHora, duracao } from '../src/administracao/dados.js';

test('série diária completa lacunas, incluindo virada de mês', () => {
  const serie = diasCompletos([{ dia: '2026-11-01', total: 3, falhas: 1 }], '2026-10-31', '2026-11-02');
  assert.deepEqual(serie.map((item) => [item.dia, item.total]), [['2026-10-31', 0], ['2026-11-01', 3], ['2026-11-02', 0]]);
  assert.equal(serie[1].falhas, 1);
});

test('horas sem registros recebem zero, sem mudar o total conhecido', () => {
  const horas = horasCompletas([{ hora: 23, total: '5' }, { hora: 0, total: 2 }]);
  assert.equal(horas.length, 24);
  assert.equal(horas[23].total, 5);
  assert.equal(horas.reduce((total, item) => total + item.total, 0), 7);
});

test('datas respeitam o fuso e duração ausente não vira zero', () => {
  assert.match(dataHora('2026-11-16T02:30:00Z', 'America/Sao_Paulo'), /15\/11\/2026.*23:30/);
  assert.equal(duracao(null), '—');
  assert.equal(duracao(0), '0 ms');
  assert.equal(dataHora('invalida', 'UTC'), '—');
});
