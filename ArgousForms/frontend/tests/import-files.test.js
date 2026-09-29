import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(root + 'package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
Object.assign(globalThis, require('@napi-rs/canvas'));
globalThis.indexedDB = require('fake-indexeddb').indexedDB;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, ...args) =>
  typeof url === 'string' && url.startsWith('/node_modules/')
    ? new Response(await readFile(root + url.slice(1)))
    : nativeFetch(url, ...args);
globalThis.pdfjsWorker = await import(
  pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'))
);
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { importModel, openPdf } = await server.ssrLoadModule(
    '/src/programas/editor/import-model.js',
  );
  const { exportPdf } = await server.ssrLoadModule(
    '/src/programas/editor/pdf-export.js',
  );
  const original = await PDFDocument.create();
  const font = await original.embedFont(StandardFonts.Helvetica);
  original
    .addPage([595, 842])
    .drawText('Original preserved', { x: 50, y: 750, font, size: 14 });
  original.addPage([595, 842]).setRotation(degrees(90));
  const layout = await importModel(
    new File([await original.save()], 'template.pdf', {
      type: 'application/pdf',
    }),
  );
  if (layout.pages.length !== 2 || layout.pages[1].width !== 842)
    throw Error('PDF import page/rotation mismatch');
  layout.placements = [
    {
      id: 'p',
      fieldId: 'name',
      page: 0,
      x: 0.1,
      y: 0.3,
      width: 0.4,
      height: 0.1,
      fontSize: 12,
    },
    {
      id: 'p2',
      fieldId: 'name',
      page: 1,
      x: 0.1,
      y: 0.3,
      width: 0.4,
      height: 0.1,
      fontSize: 12,
    },
  ];
  const output = await exportPdf(
    { layout, sections: [{ fields: [{ id: 'name', type: 'text' }] }] },
    { name: 'Ana García' },
  );
  const pdf = await openPdf(await output.arrayBuffer());
  const text = (await (await pdf.getPage(1)).getTextContent()).items
    .map((x) => x.str)
    .join(' ');
  if (!text.includes('Original preserved') || !text.includes('Ana García'))
    throw Error('PDF text mismatch: ' + text);
  const rotatedText = (await (await pdf.getPage(2)).getTextContent()).items
    .map((x) => x.str)
    .join(' ');
  if (!rotatedText.includes('Ana García'))
    throw Error('Rotated PDF text mismatch');
  await pdf.destroy();
  console.log(
    'PASS: PDF import, original content, filled export, accents and rotated page.',
  );
  const JSZip = require('jszip'),
    zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Contrato importado</w:t></w:r></w:p></w:body></w:document>',
  );
  const word = await importModel(
    new File([await zip.generateAsync({ type: 'uint8array' })], 'modelo.docx'),
  );
  if (
    !word.body.includes('<strong>Contrato importado</strong>') ||
    !word.importedWord
  )
    throw Error('DOCX import mismatch');
  console.log('PASS: DOCX import preserves editable text and bold formatting.');
} finally {
  await server.close();
}
