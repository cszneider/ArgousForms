import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageReducer } from '../src/utils/page-state.js';

test('atualizações de campos preservam dados e referências dos demais campos', () => {
  const original = Object.freeze({
    dirty: false,
    values: Object.freeze({ nome: 'Ana' }),
    documents: Object.freeze([{ id: 'documento-existente' }]),
  });
  const next = pageReducer(original, { field: 'dirty', value: true });
  assert.equal(original.dirty, false);
  assert.equal(next.dirty, true);
  assert.equal(next.values, original.values);
  assert.equal(next.documents, original.documents);
});

test('ações funcionais sucessivas usam o valor atualizado e preservam outros campos', () => {
  const original = {
    values: { nome: 'Ana', email: 'ana@example.com' },
    tab: 0,
  };
  const actions = [
    { field: 'values', value: (values) => ({ ...values, nome: 'Maria' }) },
    { field: 'values', value: (values) => ({ ...values, telefone: '123' }) },
    { field: 'tab', value: (tab) => tab + 1 },
  ];
  const next = actions.reduce(pageReducer, original);
  assert.deepEqual(next.values, {
    nome: 'Maria',
    email: 'ana@example.com',
    telefone: '123',
  });
  assert.equal(next.tab, 1);
  assert.deepEqual(original.values, { nome: 'Ana', email: 'ana@example.com' });
});

test('notificações repetidas de edição não criam novos estados nem ciclos de renderização', () => {
  const original = { dirty: false, values: { nome: '' } };
  assert.equal(
    pageReducer(original, { field: 'dirty', value: false }),
    original,
  );
  assert.equal(
    pageReducer(original, { field: 'values', value: (values) => values }),
    original,
  );
});

test('restaurar um campo preserva os valores atuais dos demais campos da tela', () => {
  const initial = {
    designer: { error: '', selected: null, fieldId: '' },
    tab: 3,
  };
  const edited = {
    ...initial,
    designer: { error: 'Erro', selected: 'marca', fieldId: 'campo' },
    tab: 1,
  };
  const reset = pageReducer(edited, {
    field: 'designer',
    value: initial.designer,
  });
  assert.equal(reset.designer, initial.designer);
  assert.equal(reset.tab, 1);
});
