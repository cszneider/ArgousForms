import assert from 'node:assert/strict';
import test from 'node:test';
import { REGEX_PRONTAS, formatarValorExemplo, normalizarValorExemplo, validarDefinicaoTexto } from '../src/programas/protocolos/variavel-texto.js';

test('máscaras de CNPJ, CEP, placa e código com zeros aceitam as regras acordadas', () => {
  for (const mascara of ['99 999 999/9999-99', '99 999-999', 'AAA 9A99']) {
    assert.equal(validarDefinicaoTexto({ mascara }), '');
  }
  assert.equal(validarDefinicaoTexto({ mascara: '0000-0009', preencherZerosEsquerda: true }), '');
});

test('máscara exige posições opcionais em ordem e escape completo', () => {
  assert.match(validarDefinicaoTexto({ mascara: 'aA' }), /opcionais/);
  assert.match(validarDefinicaoTexto({ mascara: '9000', preencherZerosEsquerda: true }), /opcionais/);
  assert.match(validarDefinicaoTexto({ mascara: '99\\' }), /escape/);
  assert.equal(validarDefinicaoTexto({ mascara: '99\\A99' }), '');
});

test('expressões prontas são aceitas; recursos incompatíveis são rejeitados', () => {
  for (const item of REGEX_PRONTAS) assert.equal(validarDefinicaoTexto({ regex: item.valor }), '');
  assert.match(validarDefinicaoTexto({ regex: '(?<=A)B' }), /portátil/);
  assert.match(validarDefinicaoTexto({ regex: '\\p{L}+' }), /escape/);
});

test('valor exemplo é gravado sem separadores e com zeros à esquerda', () => {
  const definicao = { texto: { mascara: '0000009', preencherZerosEsquerda: true } };
  assert.deepEqual(normalizarValorExemplo('123', definicao), { valor: '0000123' });
  assert.equal(formatarValorExemplo('0000123', '0000009'), '0000123');
  assert.deepEqual(normalizarValorExemplo('12 345-678', { texto: { mascara: '99 999-999' } }), { valor: '12345678' });
  assert.equal(formatarValorExemplo('12345678', '99 999-999'), '12 345-678');
});

test('valor exemplo não ignora limites e expressão regular', () => {
  assert.match(normalizarValorExemplo('12', { texto: { mascara: '999' } }).erro, /máscara/);
  assert.match(normalizarValorExemplo('abc', { texto: { tamanhoMaximo: 2 } }).erro, /tamanho/);
  assert.match(normalizarValorExemplo('abc', { texto: { regex: '[0-9]+' } }).erro, /expressão/);
});
