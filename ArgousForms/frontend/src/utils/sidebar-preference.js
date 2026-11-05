const CHAVE = 'argousdocs:sidebar-collapsed';

export function lerMenuCompacto() {
  try { return globalThis.localStorage?.getItem(CHAVE) === 'true'; }
  catch { return false; }
}

export function salvarMenuCompacto(compacto) {
  try { globalThis.localStorage?.setItem(CHAVE, String(compacto)); }
  catch { /* A navegação continua funcionando sem armazenamento local. */ }
}
