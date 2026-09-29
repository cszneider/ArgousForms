// Bundle PDF.js resources locally; no third-party CDN is needed to display documents.
const assets = import.meta.glob(
  '/node_modules/pdfjs-dist/{standard_fonts,cmaps,wasm}/*.{ttf,pfb,bcmap,wasm}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);
const folders = {
  standardFontDataUrl: 'standard_fonts',
  cMapUrl: 'cmaps',
  wasmUrl: 'wasm',
};
export class PdfAssets {
  async fetch({ kind, filename }) {
    const url = assets[`/node_modules/pdfjs-dist/${folders[kind]}/${filename}`];
    if (!url) throw new Error('Recurso do leitor de PDF indisponível.');
    const response = await fetch(url);
    if (!response.ok)
      throw new Error('Não foi possível carregar os recursos do PDF.');
    return new Uint8Array(await response.arrayBuffer());
  }
}
