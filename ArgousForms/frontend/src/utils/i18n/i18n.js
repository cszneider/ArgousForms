import { translations } from './translations.js';
export const LANGUAGE_STORAGE_KEY = 'argousdocs:language';
export function resolveLocale(value) {
  return value === 'en-US' || value === 'es-ES' ? value : 'pt-BR';
}
export function translate(locale, message, values = {}) {
  const result =
    locale === 'pt-BR'
      ? message
      : (translations[message]?.[locale === 'en-US' ? 0 : 1] ?? message);
  return result.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
/** Localize known system messages, retaining field names, reasons and legacy notes verbatim. */
export function translateSystemMessage(locale, message) {
  const patterns = [
    /^Preencha o campo “(.+)”\.$/,
    /^Informe um número válido em “(.+)”\.$/,
    /^Escolha uma opção válida em “(.+)”\.$/,
    /^Informe uma data válida em “(.+)”\.$/,
    /^Assumiu a etapa: (.+)$/,
    /^Concluiu a etapa: (.+)$/,
    /^Aprovou a etapa: (.+)$/,
    /^Devolveu para correção: (.+)$/,
  ];
  const keys = [
    'Preencha o campo “{value}”.',
    'Informe um número válido em “{value}”.',
    'Escolha uma opção válida em “{value}”.',
    'Informe uma data válida em “{value}”.',
    'Assumiu a etapa: {value}',
    'Concluiu a etapa: {value}',
    'Aprovou a etapa: {value}',
    'Devolveu para correção: {value}',
  ];
  for (const [index, pattern] of patterns.entries()) {
    const match = pattern.exec(message);
    if (match) return translate(locale, keys[index], { value: match[1] });
  }
  return translate(locale, message);
}
