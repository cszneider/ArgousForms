export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const PDF_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'signature',
];
export function validateLayout(template) {
  const layout = template.layout;
  if (!layout) return null;
  const fields = template.sections.flatMap((section) => section.fields);
  if (layout.kind === 'rich') {
    const html = [layout.header, layout.body, layout.footer].join('');
    if (new TextEncoder().encode(html).length > MAX_HTML_BYTES)
      return 'O conteúdo do editor excede 2 MB. Reduza as imagens.';
    const tokens = [...html.matchAll(/data-field-id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    if (tokens.some((id) => !fields.some((field) => field.id === id)))
      return 'Há campos removidos no editor. Remova as marcações antes de salvar.';
    return null;
  }
  if (layout.kind !== 'pdf' || !layout.assetId || !layout.pages?.length)
    return 'Importe um PDF válido antes de salvar.';
  if (fields.some((field) => !PDF_FIELD_TYPES.includes(field.type)))
    return 'No PDF, use texto, número, data, seleção ou assinatura em imagem.';
  for (const placement of layout.placements || []) {
    if (
      !Number.isInteger(placement.page) ||
      !Number.isFinite(placement.fontSize) ||
      placement.fontSize < 6 ||
      placement.fontSize > 36 ||
      !fields.some((field) => field.id === placement.fieldId) ||
      !layout.pages[placement.page]
    )
      return 'Revise os campos posicionados no PDF.';
    if (
      ![placement.x, placement.y, placement.width, placement.height].every(
        Number.isFinite,
      ) ||
      placement.x < 0 ||
      placement.y < 0 ||
      placement.width <= 0 ||
      placement.height <= 0 ||
      placement.x + placement.width > 1.001 ||
      placement.y + placement.height > 1.001
    )
      return 'Mantenha os campos dentro da página do PDF.';
  }
  if (
    fields.some(
      (field) =>
        !(layout.placements || []).some((item) => item.fieldId === field.id),
    )
  )
    return 'Posicione todos os campos no PDF antes de salvar.';
  return null;
}
export function fieldText(field, value) {
  if (typeof value !== 'string') return '';
  if (field?.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split('-').reverse().join('/');
  return value;
}

export const PDF_FIELD_LABELS = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  select: 'Seleção',
  signature: 'Assinatura (imagem)',
};
