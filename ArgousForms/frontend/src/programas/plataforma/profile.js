import { accountId } from './users.js';
export const PROFILE_PREFIX = 'argousdocs:profile:';
export function validCpf(value) {
  const digits = String(value).replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (let size = 9; size <= 10; size++) {
    const sum = digits
      .slice(0, size)
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (size + 1 - index),
        0,
      );
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[size])) return false;
  }
  return true;
}
export function validateProfile(profile, today = new Date()) {
  const errors = {};
  if (!profile.name?.trim()) errors.name = 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email?.trim() || ''))
    errors.email = 'Informe um e-mail válido.';
  if (!/^[\d.\-\s]+$/.test(profile.cpf || '') || !validCpf(profile.cpf))
    errors.cpf = 'Informe um CPF válido.';
  const date = profile.birthDate || '';
  const parsed = new Date(date + 'T12:00:00');
  const limit = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() < 1 ||
    parsed.getDate() !== Number(date.slice(8)) ||
    date > limit
  )
    errors.birthDate = 'Informe uma data de nascimento válida, não futura.';
  return errors;
}
export function readProfile(id, fallback = {}) {
  const raw = localStorage.getItem(PROFILE_PREFIX + id);
  return {
    name: '',
    email: '',
    cpf: '',
    birthDate: '',
    gender: '',
    phone: '',
    ...fallback,
    ...(raw ? JSON.parse(raw) : {}),
  };
}
export function saveProfile(profile) {
  const id = accountId(sessionStorage.getItem('argousdocs:session'));
  if (!id) throw Error('Entre novamente para salvar seu cadastro.');
  if (Object.keys(validateProfile(profile)).length)
    throw Error('Revise os campos obrigatórios.');
  const saved = Object.fromEntries(
    ['name', 'email', 'cpf', 'birthDate', 'gender', 'phone'].map((key) => [
      key,
      String(profile[key] || '').trim(),
    ]),
  );
  localStorage.setItem(PROFILE_PREFIX + id, JSON.stringify(saved));
  return saved;
}
