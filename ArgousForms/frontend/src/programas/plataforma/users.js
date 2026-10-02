export const USER_LANGUAGE_PREFIX = 'argousdocs:user-language:';
export function accountId(session) {
  return session === 'platform-demo'
    ? 'platform-admin'
    : session === 'demo'
      ? 'admin'
      : null;
}
export function userRows(people, disabledIds, languageFor) {
  return [
    {
      id: 'platform-admin',
      name: 'Administrador da plataforma',
      email: 'adm@argous.com.br',
      company: 'platform',
    },
    ...people.map((person) => ({
      ...person,
      email: person.id === 'admin' ? 'teste@argous.com.br' : person.email || '',
      company: 'test-company',
    })),
  ].map((person) => ({
    ...person,
    active: person.id === 'platform-admin' || !disabledIds.includes(person.id),
    language: languageFor(person.id) || '',
  }));
}
export function filterUsers(rows, filters) {
  return rows.filter(
    (row) =>
      (!filters.company || row.company === filters.company) &&
      (!filters.status || row.active === (filters.status === 'active')) &&
      (!filters.language ||
        (filters.language === 'unset'
          ? !row.language
          : row.language === filters.language)),
  );
}
