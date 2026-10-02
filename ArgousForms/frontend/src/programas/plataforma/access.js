import { readStore } from '../documentos/storage.js';
// Local demonstration only. Production authorization belongs to the backend.
export const PLATFORM_KEY = 'argousdocs:platform:v1';
export const SESSION_KEY = 'argousdocs:session';
export function readPlatform() {
  const raw = localStorage.getItem(PLATFORM_KEY);
  if (!raw) return { schema: 1, disabledIds: [], accesses: [] };
  const data = JSON.parse(raw);
  if (
    data.schema !== 1 ||
    !Array.isArray(data.disabledIds) ||
    !Array.isArray(data.accesses)
  )
    throw Error('Não foi possível ler os dados da plataforma.');
  return data;
}
export function isEnabled(id) {
  return !readPlatform().disabledIds.includes(id);
}
export function sessionRole() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === 'platform-demo') return 'platform';
  if (
    session === 'demo' &&
    isEnabled('admin') &&
    readStore().people.some((person) => person.id === 'admin')
  )
    return 'company';
  return null;
}
export function loginDemo(email, password) {
  const address = email.trim().toLowerCase();
  const role =
    address === 'adm@argous.com.br'
      ? 'platform'
      : address === 'teste@argous.com.br'
        ? 'company'
        : null;
  if (!role || password !== '123') throw Error('E-mail ou senha incorretos.');
  if (
    role === 'company' &&
    !readStore().people.some((person) => person.id === 'admin')
  )
    throw Error('Usuário não encontrado.');
  const data = readPlatform();
  if (role === 'company' && data.disabledIds.includes('admin'))
    throw Error('Usuário desativado. Contate o administrador da plataforma.');
  data.accesses.push({
    at: new Date().toISOString(),
    role,
    userId: role === 'company' ? 'admin' : 'platform-admin',
  });
  localStorage.setItem(PLATFORM_KEY, JSON.stringify(data));
  sessionStorage.removeItem('argousdocs:actor');
  sessionStorage.setItem(
    SESSION_KEY,
    role === 'company' ? 'demo' : 'platform-demo',
  );
  return role === 'platform' ? '/plataforma' : '/app';
}
export function setUserEnabled(id, enabled, people) {
  if (sessionRole() !== 'platform')
    throw Error('Acesso restrito ao administrador da plataforma.');
  if (!people.some((person) => person.id === id))
    throw Error('Usuário não encontrado.');
  if (!enabled) {
    const person = people.find((person) => person.id === id);
    const disabled = readPlatform().disabledIds;
    if (
      person.role === 'admin' &&
      !people.some(
        (other) =>
          other.id !== id &&
          other.role === 'admin' &&
          !disabled.includes(other.id),
      )
    )
      throw Error('O último administrador ativo deve ser preservado.');
  }
  const data = readPlatform();
  data.disabledIds = data.disabledIds.filter((value) => value !== id);
  if (!enabled) data.disabledIds.push(id);
  localStorage.setItem(PLATFORM_KEY, JSON.stringify(data));
  return data;
}
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('argousdocs:actor');
}
