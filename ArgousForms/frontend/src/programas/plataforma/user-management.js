import { readStore, writeStore } from '../documentos/storage.js';
import { readPlatform, sessionRole } from './access.js';
import { PROFILE_PREFIX, readProfile, validateProfile } from './profile.js';
export function removalReason(id, store, disabledIds) {
  if (id === 'platform-admin')
    return 'Não é permitido excluir a própria conta.';
  const person = store.people.find((p) => p.id === id);
  if (!person) return 'Usuário não encontrado.';
  if (
    person.role === 'admin' &&
    !store.people.some(
      (p) => p.id !== id && p.role === 'admin' && !disabledIds.includes(p.id),
    )
  )
    return 'O último administrador ativo deve ser preservado.';
  const references = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (value.type === 'user' && value.id === id) return true;
    return Object.entries(value).some(
      ([key, item]) =>
        (['assignee', 'userId', 'actorId', 'createdBy'].includes(key) &&
          item === id) ||
        references(item),
    );
  };
  if (
    store.groups.some((g) => g.memberIds.includes(id)) ||
    references(store.templates) ||
    references(store.documents) ||
    store.documents.some((d) =>
      d.history?.some((e) => Object.values(e).includes(person.name)),
    )
  )
    return 'O usuário possui vínculos com grupos, modelos ou documentos.';
  return '';
}
function authorize(id) {
  if (sessionRole() !== 'platform')
    throw Error('Acesso restrito ao administrador da plataforma.');
  const store = readStore();
  if (id !== 'platform-admin' && !store.people.some((p) => p.id === id))
    throw Error('Usuário não encontrado.');
  return store;
}
export function saveManagedProfile(id, profile, expected) {
  authorize(id);
  if (JSON.stringify(readProfile(id)) !== expected)
    throw Error('O cadastro mudou. Reabra o usuário antes de salvar.');
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
export function deleteManagedUser(id) {
  const store = authorize(id);
  const reason = removalReason(id, store, readPlatform().disabledIds);
  if (reason) throw Error(reason);
  writeStore({ ...store, people: store.people.filter((p) => p.id !== id) });
  localStorage.removeItem(PROFILE_PREFIX + id);
  localStorage.removeItem('argousdocs:user-language:' + id);
}
