import { saveAsset } from './assets.js';
import { cleanHtml } from './content.js';
import { MAX_IMPORT_BYTES, MAX_HTML_BYTES } from './layout-rules.js';
let workerUrl;

async function getWorkerUrl() {
  if (!workerUrl) {
    const { default: codigo } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw');
    workerUrl = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
  }
  return workerUrl;
}

export async function openPdf(data) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = await getWorkerUrl();
  const { PdfAssets } = await import('./pdf-assets.js');
  return pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useWorkerFetch: false,
    BinaryDataFactory: PdfAssets,
  }).promise;
}
export async function importModel(file) {
  if (!file || file.size > MAX_IMPORT_BYTES)
    throw new Error('Escolha um arquivo PDF ou DOCX de até 20 MB.');
  const bytes = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name)) {
    const pdf = await openPdf(bytes);
    try {
      if (pdf.numPages > 50)
        throw new Error('O modelo pode ter até 50 páginas.');
      const pages = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const page = await pdf.getPage(index),
          view = page.getViewport({ scale: 1 });
        pages.push({ width: view.width, height: view.height });
      }
      const assetId = await saveAsset(file);
      return { kind: 'pdf', assetId, name: file.name, pages, placements: [] };
    } finally {
      await pdf.destroy();
    }
  }
  if (!/\.docx$/i.test(file.name))
    throw new Error('Escolha um arquivo PDF ou DOCX de até 20 MB.');
  const mammothModule = await import('mammoth/mammoth.browser.js'),
    mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: bytes },
    { externalFileAccess: false },
  );
  const body = cleanHtml(result.value);
  if (new TextEncoder().encode(body).length > MAX_HTML_BYTES)
    throw new Error('O conteúdo do editor excede 2 MB. Reduza as imagens.');
  if (!body.trim()) throw new Error('O arquivo não contém conteúdo editável.');
  const assetId = await saveAsset(file);
  return {
    kind: 'rich',
    body,
    header: '',
    footer: '',
    assetId,
    name: file.name,
    importedWord: true,
  };
}
