import { createId } from '../../utils/uid.js';
// Originals are immutable: older document versions retain their references.
function openAssets() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('argousdocs:assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('Não foi possível abrir os arquivos locais.'));
  });
}
export async function saveAsset(file) {
  const db = await openAssets(),
    id = createId();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(file, id);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            'Não foi possível guardar o arquivo. Verifique o espaço do navegador.',
          ),
        );
    });
    return id;
  } finally {
    db.close();
  }
}
export async function readAsset(id) {
  const db = await openAssets();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get(id);
      request.onsuccess = () =>
        request.result
          ? resolve(request.result)
          : reject(
              new Error(
                'Arquivo original indisponível neste navegador. Importe novamente o modelo.',
              ),
            );
      request.onerror = () =>
        reject(new Error('Não foi possível ler o arquivo original.'));
    });
  } finally {
    db.close();
  }
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
