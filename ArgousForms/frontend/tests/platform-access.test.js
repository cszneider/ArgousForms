import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loginDemo,
  sessionRole,
  setUserEnabled,
  readPlatform,
  logout,
  isEnabled,
  SESSION_KEY,
} from '../src/programas/plataforma/access.js';
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function reset() {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
}
test('company and platform sessions remain distinct; switching clears simulated actor', () => {
  reset();
  sessionStorage.setItem('argousdocs:actor', 'someone');
  assert.equal(loginDemo(' TESTE@argous.com.br ', '123'), '/app');
  assert.equal(sessionRole(), 'company');
  assert.equal(sessionStorage.getItem('argousdocs:actor'), null);
  assert.equal(loginDemo('adm@argous.com.br', '123'), '/plataforma');
  assert.equal(sessionRole(), 'platform');
  assert.equal(readPlatform().accesses.length, 2);
  logout();
  assert.equal(sessionRole(), null);
});
test('company cannot manage accounts; disabled company login and existing session are blocked', () => {
  reset();
  loginDemo('teste@argous.com.br', '123');
  assert.throws(() => setUserEnabled('admin', false, [{ id: 'admin' }]));
  loginDemo('adm@argous.com.br', '123');
  setUserEnabled('admin', false, [{ id: 'admin' }]);
  assert.throws(() => loginDemo('teste@argous.com.br', '123'));
  assert.equal(readPlatform().accesses.length, 2);
  sessionStorage.setItem(SESSION_KEY, 'demo');
  assert.equal(sessionRole(), null);
  loginDemo('adm@argous.com.br', '123');
  setUserEnabled('admin', true, [{ id: 'admin' }]);
  assert.equal(loginDemo('teste@argous.com.br', '123'), '/app');
});
test('participant blocking preserves workspace and rejects unknown users', () => {
  reset();
  localStorage.setItem('argousdocs:workspace:v1', 'preserved');
  loginDemo('adm@argous.com.br', '123');
  assert.throws(() =>
    setUserEnabled('platform-admin', false, [{ id: 'admin' }]),
  );
  setUserEnabled('participant', false, [{ id: 'participant' }]);
  assert.equal(isEnabled('participant'), false);
  assert.equal(localStorage.getItem('argousdocs:workspace:v1'), 'preserved');
});
test('invalid credentials do not create a session or access event', () => {
  reset();
  assert.throws(() => loginDemo('other@example.com', '123'));
  assert.throws(() => loginDemo('adm@argous.com.br', 'wrong'));
  assert.equal(sessionRole(), null);
  assert.deepEqual(readPlatform().accesses, []);
});
