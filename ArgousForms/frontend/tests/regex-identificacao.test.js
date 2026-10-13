import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identificacaoCorresponde, regexIdentificacaoCompativel } from '../src/programas/pessoas/regex-identificacao.js';

test('aceita formatos alfanuméricos com faixas, alternativas e repetições limitadas', () => {
  for (const expressao of ['^[0-9]{11}$', '[A-Z]{2}[0-9]{6}[A-Z]?', '(?:[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])']) {
    assert.equal(regexIdentificacaoCompativel(expressao), true, expressao);
  }
});

test('rejeita recursos fora do subconjunto comum', () => {
  for (const expressao of ['(?<=A)B', '(A)\\1', '\\p{L}{3}', '(?i)abc', '[A-Z&&[^IO]]', 'A++', '(?>AB)', '\\d{11}', '[A-Z]{1,}', '[A-Z]{71}', '[A-Z]{3,2}', 'A|', '[A-z]', '^ABC', 'ABC$', '', 'A?', 'A'.repeat(51)]) {
    assert.equal(regexIdentificacaoCompativel(expressao), false, expressao);
  }
});

test('confere o identificador inteiro, inclusive quando há alternativas ou quebra de linha final', () => {
  const expressao = '(A|AB)';
  assert.equal(identificacaoCorresponde(expressao, 'AB'), true);
  assert.equal(identificacaoCorresponde(expressao, 'A'), true);
  assert.equal(identificacaoCorresponde(expressao, 'AB\n'), false);
  assert.equal(identificacaoCorresponde('^[0-9]{11}$', '12345678901'), true);
  assert.equal(identificacaoCorresponde('^[0-9]{11}$', '123.456.789-01'), false);
});

test('aceita todas as expressões da carga manual de tipos de identificação', () => {
  const sql = readFileSync(new URL('../../banco/carga-manual-tipos-identificacao.sql', import.meta.url), 'utf8');
  const expressoes = [...sql.matchAll(/'(\^[^']+\$)'/g)].map((resultado) => resultado[1]);

  assert.equal(expressoes.length, 15);
  for (const expressao of expressoes) {
    assert.equal(regexIdentificacaoCompativel(expressao), true, expressao);
  }
});
