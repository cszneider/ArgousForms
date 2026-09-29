import DOMPurify from 'dompurify';
import { fieldText } from './layout-rules.js';
export function cleanHtml(html = '') {
  if (typeof window === 'undefined') return '';
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'img',
      'span',
    ],
    ALLOWED_ATTR: [
      'style',
      'src',
      'alt',
      'width',
      'height',
      'colspan',
      'rowspan',
      'data-field-id',
      'data-label',
    ],
    ALLOW_DATA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const node of doc.body.querySelectorAll('[style]')) {
    const align = node.style.textAlign;
    node.removeAttribute('style');
    if (['left', 'center', 'right', 'justify'].includes(align))
      node.style.textAlign = align;
  }
  for (const img of doc.body.querySelectorAll('img')) {
    if (
      !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(
        img.getAttribute('src') || '',
      )
    )
      img.remove();
  }
  return doc.body.innerHTML;
}
export function filledHtml(html, fields, values, preview = false) {
  if (typeof window === 'undefined') return '';
  const doc = new DOMParser().parseFromString(cleanHtml(html), 'text/html');
  for (const token of doc.body.querySelectorAll('[data-field-id]')) {
    const field = fields.find((item) => item.id === token.dataset.fieldId),
      value = values[field?.id];
    if (field?.type === 'richtext' && typeof value === 'string') {
      const block = doc.createElement('div');
      block.innerHTML = cleanHtml(value);
      token.replaceWith(block);
    } else if (
      field?.type === 'signature' &&
      value?.data &&
      /^data:image\/(png|jpeg|webp);base64,/.test(value.data)
    ) {
      const img = doc.createElement('img');
      img.src = value.data;
      img.alt = field.label;
      img.width = 180;
      token.replaceWith(img);
    } else {
      token.textContent =
        fieldText(field, value) ||
        (preview ? `⟦${field?.label || token.dataset.label || '?'}⟧` : '');
      if (!preview) {
        token.removeAttribute('data-field-id');
        token.removeAttribute('data-label');
      }
    }
  }
  return doc.body.innerHTML;
}
