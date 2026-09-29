import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from '../src/programas/documentos/domain.js';
import { readStore, writeStore } from '../src/programas/documentos/storage.js';
import { seed } from '../src/programas/documentos/seed.js';
test('rascunho incompleto persiste e pode ser retomado sem perder marcações', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: (_, value) => {
        raw = value;
      },
    },
  });
  try {
    const draft = {
      id: 'test-draft',
      name: 'Modelo sem título',
      draft: true,
      sections: [],
      stages: [],
      layout: {
        kind: 'pdf',
        assetId: 'original',
        placements: [{ id: 'mark', fieldId: 'pending', x: 0.2, y: 0.3 }],
      },
    };
    writeStore({ ...seed(), templates: [draft] });
    const restored = readStore().templates[0];
    assert.deepEqual(restored, draft);
    assert.throws(
      () => createDocument(restored, 'Teste', 0, 'Fellipe'),
      /Conclua/,
    );
    const ready = { ...restored, draft: false, stages: [{ id: 'first' }] };
    const doc = createDocument(ready, 'Teste', 0, 'Fellipe');
    ready.layout.placements[0].x = 0.8;
    assert.equal(doc.template.layout.placements[0].x, 0.2);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
