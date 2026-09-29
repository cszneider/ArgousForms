import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { readAsset } from './assets.js';
import { openPdf } from './import-model.js';
import { fieldText } from './layout-rules.js';

function linesFor(text, font, size, width) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    // Character wrapping also handles long identifiers with no spaces.
    for (const char of paragraph) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
export async function exportPdf(template, values) {
  const source = await readAsset(template.layout.assetId),
    bytes = await source.arrayBuffer();
  const output = await PDFDocument.load(bytes.slice(0));
  const preview = await openPdf(bytes.slice(0));
  try {
    const font = await output.embedFont(StandardFonts.Helvetica);
    for (const item of template.layout.placements || []) {
      const field = template.sections
          .flatMap((s) => s.fields)
          .find((f) => f.id === item.fieldId),
        value = values[item.fieldId];
      if (!value) continue;
      const page = output.getPage(item.page),
        screen = await preview.getPage(item.page + 1),
        view = screen.getViewport({ scale: 1 });
      const width = item.width * view.width,
        height = item.height * view.height,
        x = item.x * view.width,
        y = item.y * view.height;
      if (field?.type === 'signature' && value.data) {
        // Normalize PNG/JPEG/WebP through canvas for pdf-lib image embedding.
        const image = await createImageBitmap(
          await (await fetch(value.data)).blob(),
        );
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        image.close();
        const embedded = await output.embedPng(canvas.toDataURL('image/png'));
        const factor = Math.min(
            width / embedded.width,
            height / embedded.height,
          ),
          w = embedded.width * factor,
          h = embedded.height * factor;
        const [px, py] = view.convertToPdfPoint(x, y + h);
        page.drawImage(embedded, {
          x: px,
          y: py,
          width: w,
          height: h,
          rotate: degrees(view.rotation),
        });
      } else {
        const text = fieldText(field, value);
        let size = item.fontSize || 12,
          lines;
        try {
          do {
            lines = linesFor(text, font, size, width);
            if (lines.length * size * 1.2 <= height) break;
            size -= 0.5;
          } while (size >= 4);
        } catch {
          throw new Error(
            'O PDF contém caracteres não suportados. Revise os valores antes de exportar.',
          );
        }
        if (size < 4)
          throw new Error(
            'Um campo não cabe no espaço do PDF. Reduza o texto ou amplie o campo no modelo.',
          );
        for (let i = 0; i < lines.length; i++) {
          const [px, py] = view.convertToPdfPoint(x, y + size + i * size * 1.2);
          page.drawText(lines[i], {
            x: px,
            y: py,
            size,
            font,
            color: rgb(0, 0, 0),
            rotate: degrees(view.rotation),
          });
        }
      }
    }
    return new Blob([await output.save()], { type: 'application/pdf' });
  } finally {
    await preview.destroy();
  }
}
