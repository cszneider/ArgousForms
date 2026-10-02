import test from 'node:test';
import assert from 'node:assert/strict';
import { accountId, filterUsers, userRows } from '../src/programas/plataforma/users.js';
test('lists existing users and combines company, status and personal language filters', () => {
  const rows = userRows([{ id: 'admin', name: 'Company admin' }, { id: 'other', name: 'Other' }], ['other'], id => id === 'admin' ? 'es-ES' : null);
  assert.equal(rows.length, 3);
  assert.deepEqual(filterUsers(rows, { company: 'test-company', status: 'active', language: 'es-ES' }).map(row => row.id), ['admin']);
  assert.deepEqual(filterUsers(rows, { company: 'test-company', status: 'inactive', language: 'unset' }).map(row => row.id), ['other']);
  assert.equal(filterUsers(rows, { language: 'en-US' }).length, 0);
  assert.equal(rows[2].email, '');
});
test('login identities have separate preference keys, visitors have no account', () => {
  assert.equal(accountId('demo'), 'admin');
  assert.equal(accountId('platform-demo'), 'platform-admin');
  assert.equal(accountId(null), null);
});
