import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarSenha } from '../src/programas/login/politica-senha.js';

test('nova senha exige oito caracteres e pelo menos três categorias', () => {
  assert.equal(avaliarSenha('Abcdefg1').valida, true);
  assert.equal(avaliarSenha('abcdef1!').valida, true);
  assert.equal(avaliarSenha('ABCDEFG1!').valida, true);
  assert.equal(avaliarSenha('Ab1!').valida, false);
  assert.equal(avaliarSenha('abcdefgh').valida, false);
  assert.equal(avaliarSenha('Abcdefg ').valida, false, 'espaço não é símbolo');
  assert.equal(avaliarSenha('Ábcdefg1').valida, true, 'letras acentuadas contam');
  assert.equal(avaliarSenha('A'.repeat(1025) + 'a1!').valida, false);
});
