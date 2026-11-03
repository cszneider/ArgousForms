import assert from 'node:assert/strict';
import test from 'node:test';
import { alinharCampos, apresentacaoCampo } from '../src/programas/protocolos/pdf-campos-layout.js';

const campos = [
  { id: 'a', pagina: 1, x: 10, y: 20, largura: 100, altura: 20 },
  { id: 'b', pagina: 1, x: 40, y: 50, largura: 80, altura: 30 },
  { id: 'c', pagina: 2, x: 5, y: 5, largura: 20, altura: 20 },
];

test('alinhamento respeita as bordas e os centros dos campos selecionados', () => {
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'topo').map((campo) => campo.y), [20, 20, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'baixo').map((campo) => campo.y), [60, 50, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'esquerda').map((campo) => campo.x), [10, 10, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'centro').map((campo) => campo.x), [15, 25, 5]);
  assert.deepEqual(alinharCampos(campos, ['a', 'b'], 'direita').map((campo) => campo.x), [20, 40, 5]);
});

test('campos de páginas diferentes não são alinhados juntos', () => {
  assert.equal(alinharCampos(campos, ['a', 'c'], 'topo'), campos);
});

test('apresentação antiga conserva os padrões quando não há estilo gravado', () => {
  assert.deepEqual(apresentacaoCampo(campos[0]), {
    fonte: 'HELVETICA', cor: '#000000', tamanho: 12,
    negrito: false, italico: false, sublinhado: false,
  });
});
