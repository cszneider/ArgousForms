import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../src/utils/uid.js';
import { seed } from '../src/programas/documentos/seed.js';

test('uses native randomUUID when available', () => {
  const provider = {
    randomUUID() {
      assert.equal(this, provider);
      return 'native-id';
    },
  };
  assert.equal(createId(provider), 'native-id');
});
test('HTTP fallback generates UUID v4 with correct version and variant bits', () => {
  assert.equal(
    createId({
      getRandomValues(bytes) {
        bytes.fill(255);
        return bytes;
      },
    }),
    'ffffffff-ffff-4fff-bfff-ffffffffffff',
  );
  const provider = {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  };
  const ids = Array.from({ length: 100 }, () => createId(provider));
  for (const id of ids)
    assert.match(
      id,
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
  assert.equal(new Set(ids).size, 100);
});
test('initial workspace loads when the browser has no randomUUID', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const provider = {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  };
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: provider,
    });
    const workspace = seed();
    assert.equal(workspace.documents.length, 0);
    assert.equal(workspace.templates.length, 0);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});
