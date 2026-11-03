import assert from 'node:assert/strict';
import test from 'node:test';
import { alinharCampos, apresentacaoCampo, moverCamposComSetas } from '../src/programas/protocolos/pdf-campos-layout.js';

const campos = [
  { id: 'a', pagina: 1, x: 10, y: 20, largura: 100, altura: 20 },
  { id: 'b', pagina: 1, x: 40, y: 50, largura: 80, altura: 30 },
  { id: 'c', pagina: 2, x: 5, y: 5, largura: 20, altura: 20 },
];

test('alinhamento usa o primeiro campo selecionado como referência', () => {
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'topo').map((campo) => campo.y), [20, 20, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'baixo').map((campo) => campo.y), [20, 10, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'esquerda').map((campo) => campo.x), [10, 10, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'centro').map((campo) => campo.x), [10, 20, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'direita').map((campo) => campo.x), [10, 30, 5]);
  assert.deepEqual(alinharCampos(campos, ['b', 'a'], 'esquerda').map((campo) => campo.x), [40, 40, 5]);
});

test('campos de páginas diferentes não são alinhados juntos', () => {
  assert.equal(alinharCampos(campos, ['a', 'c'], 'topo'), campos);
});

test('alinhamento não desloca um campo para fora da página', () => {
  const margem = [{ id: 'a', pagina: 1, x: 55, y: 0, largura: 10, altura: 10 },
    { id: 'b', pagina: 1, x: 0, y: 0, largura: 20, altura: 10 }];
  assert.equal(alinharCampos(margem, ['a', 'b'], 'esquerda', { largura: 70, altura: 100 }), margem);
});

test('setas movem o grupo um ponto preservando as distâncias', () => {
  const limites = { largura: 200, altura: 200 };
  assert.deepEqual(moverCamposComSetas(campos, ['a', 'b'], 'ArrowRight', limites).map((campo) => campo.x), [11, 41, 5]);
  assert.deepEqual(moverCamposComSetas(campos, ['a', 'b'], 'ArrowUp', limites).map((campo) => campo.y), [19, 49, 5]);
  const borda = [{ id: 'a', pagina: 1, x: 0, y: 10, largura: 20, altura: 10 },
    { id: 'b', pagina: 1, x: 30, y: 10, largura: 20, altura: 10 }];
  assert.equal(moverCamposComSetas(borda, ['a', 'b'], 'ArrowLeft', limites), borda);
});

test('apresentação antiga conserva os padrões quando não há estilo gravado', () => {
  assert.deepEqual(apresentacaoCampo(campos[0]), {
    fonte: 'HELVETICA', cor: '#000000', tamanho: 12,
    negrito: false, italico: false, sublinhado: false,
  });
});

test('alinhamento e setas preservam a formatação de cada campo', () => {
  const estilo = { fonte: 'TIMES', tamanho: 18, negrito: true, italico: true };
  const formatados = campos.map((campo, indice) => indice === 0 ? { ...campo, apresentacao: estilo } : campo);
  const alinhados = alinharCampos(formatados, ['a', 'b'], 'topo', { largura: 200, altura: 200 });
  const movidos = moverCamposComSetas(alinhados, ['a', 'b'], 'ArrowRight', { largura: 200, altura: 200 });
  assert.deepEqual(movidos[0].apresentacao, estilo);
});
