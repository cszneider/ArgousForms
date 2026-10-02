import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validCpf,
  validateProfile,
} from '../src/programas/plataforma/profile.js';
test('required profile fields and CPF check digits are validated', () => {
  assert.deepEqual(Object.keys(validateProfile({})).sort(), [
    'birthDate',
    'cpf',
    'email',
    'name',
  ]);
  assert.equal(validCpf('111.111.111-11'), false);
  assert.equal(validCpf('123.456.789-09'), true);
  assert.equal(validCpf('123.456.789-08'), false);
});
test('rejects impossible and future birthdays; optional fields may be empty', () => {
  const profile = {
    name: 'Test',
    email: 'test@example.com',
    cpf: '12345678909',
    birthDate: '2000-02-29',
  };
  const now = new Date('2026-10-01T12:00:00');
  assert.deepEqual(validateProfile(profile, now), {});
  for (const birthDate of ['', '2001-02-29', '2026-10-02'])
    assert.ok(validateProfile({ ...profile, birthDate }, now).birthDate);
});
