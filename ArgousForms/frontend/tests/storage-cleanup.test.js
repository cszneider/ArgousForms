import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/programas/documentos/seed.js';
import { readStore, writeStore } from '../src/programas/documentos/storage.js';
test('remove exemplos salvos uma vez e preserva documentos reais e configurações', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = seed();
  const admin = data.people[0];
  const customPerson = {
    id: 'custom-person',
    name: 'Pessoa de teste',
    role: 'participant',
  };
  data.people.push(
    ...['ana', 'lucas', 'marina', 'rafael'].map((id) => ({ id })),
    customPerson,
  );
  data.groups = [
    ...['attendance', 'technical', 'supervision'].map((id) => ({
      id,
      memberIds: [],
    })),
    { id: 'custom-group', memberIds: ['admin', 'ana', 'custom-person'] },
  ];
  const customTemplate = { id: 'custom-model', name: 'Meu modelo' };
  data.templates = [
    { id: 'attendance-report', name: 'Relatório de atendimento' },
    customTemplate,
  ];
  const real = {
    id: 'real',
    code: 'DOC-0001',
    template: { id: 'attendance-report' },
    history: [{ id: 'real-event' }],
  };
  data.documents = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: 'demo-' + i,
      template: { id: 'attendance-report' },
      history: [{ id: 'start-' + i }],
    })),
    real,
  ];
  let stored = JSON.stringify(data);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_, value) => {
        stored = value;
      },
    },
  });
  try {
    const cleaned = readStore();
    assert.deepEqual(cleaned.documents, [real]);
    assert.deepEqual(cleaned.templates, [customTemplate]);
    assert.deepEqual(cleaned.groups, [
      { id: 'custom-group', memberIds: ['admin', 'custom-person'] },
    ]);
    assert.deepEqual(cleaned.people, [admin, customPerson]);
    writeStore(cleaned);
    assert.deepEqual(readStore(), cleaned);
    stored = null;
    assert.deepEqual(readStore().documents, []);
    assert.deepEqual(readStore().templates, []);
    assert.deepEqual(readStore().groups, []);
    assert.deepEqual(readStore().people, [admin]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
