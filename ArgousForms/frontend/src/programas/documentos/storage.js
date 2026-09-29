import { seed } from './seed.js';
const KEY = 'argousdocs:workspace:v1';
export function readStore() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return seed();
  const data = JSON.parse(raw);
  if (
    data.schema !== 1 ||
    !Array.isArray(data.documents) ||
    !Array.isArray(data.templates) ||
    !Array.isArray(data.groups) ||
    !Array.isArray(data.people)
  )
    throw Error(
      'Os dados locais não puderam ser lidos. Preserve uma cópia antes de limpar o armazenamento do navegador.',
    );
  // Remove only the six original demo records once; keep user-created documents.
  if (!data.sampleDocumentsRemoved) {
    data.documents = data.documents.filter((doc) => {
      if (doc.template?.id !== 'attendance-report') return true;
      return !doc.history?.some((event) => /^start-[0-5]$/.test(event.id));
    });
    data.sampleDocumentsRemoved = true;
  }
  if (!data.sampleTemplatesRemoved) {
    data.templates = data.templates.filter(
      (template) => template.id !== 'attendance-report',
    );
    data.sampleTemplatesRemoved = true;
  }
  if (!data.samplePeopleAndGroupsRemoved) {
    const samplePeople = new Set(['ana', 'lucas', 'marina', 'rafael']);
    const sampleGroups = new Set(['attendance', 'technical', 'supervision']);
    data.people = data.people.filter((person) => !samplePeople.has(person.id));
    data.groups = data.groups
      .filter((group) => !sampleGroups.has(group.id))
      .map((group) => ({
        ...group,
        memberIds: group.memberIds.filter((id) => !samplePeople.has(id)),
      }));
    data.samplePeopleAndGroupsRemoved = true;
  }
  return data;
}
export function writeStore(store, expected) {
  if (expected && localStorage.getItem(KEY) !== JSON.stringify(expected))
    throw Error(
      'Os dados mudaram em outra aba. Recarregue antes de salvar para evitar sobrescrever alterações.',
    );
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    throw Error(
      'Não foi possível salvar no navegador. Libere espaço ou remova um anexo antes de tentar novamente.',
    );
  }
}
