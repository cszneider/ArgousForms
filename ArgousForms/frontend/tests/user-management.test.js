import test from 'node:test';
import assert from 'node:assert/strict';
import { removalReason } from '../src/programas/plataforma/user-management.js';
const store = () => ({
  people: [
    { id: 'admin', name: 'Admin', role: 'admin' },
    { id: 'person', name: 'Person', role: 'participant' },
  ],
  groups: [],
  templates: [],
  documents: [],
});
test('protects own account, last admin and missing users', () => {
  assert.ok(removalReason('platform-admin', store(), []));
  assert.ok(removalReason('admin', store(), []));
  assert.ok(removalReason('missing', store(), []));
  assert.equal(removalReason('person', store(), []), '');
});
test('blocks group, template, document and historical references', () => {
  for (const update of [
    { groups: [{ memberIds: ['person'] }] },
    {
      templates: [
        {
          sections: [
            { fields: [{ responsibility: { type: 'user', id: 'person' } }] },
          ],
        },
      ],
    },
    { documents: [{ assignee: 'person' }] },
    { documents: [{ history: [{ actor: 'Person' }] }] },
  ])
    assert.ok(removalReason('person', { ...store(), ...update }, []));
});

import {
  deleteManagedUser,
  saveManagedProfile,
} from '../src/programas/plataforma/user-management.js';
import { readProfile } from '../src/programas/plataforma/profile.js';
import { setUserEnabled } from '../src/programas/plataforma/access.js';
function setup() {
  const storage = () => {
    const data = new Map();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    };
  };
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  sessionStorage.setItem('argousdocs:session', 'platform-demo');
  localStorage.setItem(
    'argousdocs:workspace:v1',
    JSON.stringify({ schema: 1, ...store() }),
  );
}
test('admin actions persist edits, reject stale saves, and delete unlinked user only', () => {
  setup();
  const profile = {
    name: 'Updated',
    email: 'test@example.com',
    cpf: '12345678909',
    birthDate: '2000-01-01',
  };
  const expected = JSON.stringify(readProfile('person'));
  saveManagedProfile('person', profile, expected);
  assert.equal(readProfile('person').name, 'Updated');
  assert.throws(() => saveManagedProfile('person', profile, expected));
  assert.throws(() => setUserEnabled('admin', false, store().people));
  deleteManagedUser('person');
  assert.equal(
    JSON.parse(localStorage.getItem('argousdocs:workspace:v1')).people.length,
    1,
  );
  assert.equal(localStorage.getItem('argousdocs:profile:person'), null);
});
test('company sessions cannot edit or delete another user', () => {
  setup();
  sessionStorage.setItem('argousdocs:session', 'demo');
  assert.throws(() => deleteManagedUser('person'));
  assert.throws(() =>
    saveManagedProfile('person', {}, JSON.stringify(readProfile('person'))),
  );
});
