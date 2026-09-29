import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLocale,
  translate,
  translateSystemMessage,
} from '../src/utils/i18n/i18n.js';
import { translations } from '../src/utils/i18n/translations.js';
import { durationLabel } from '../src/programas/documentos/stage-timing.js';
test('Portuguese is the default regardless of missing or unsupported stored preference', () => {
  for (const value of [null, '', 'fr-FR', 'en'])
    assert.equal(resolveLocale(value), 'pt-BR');
  assert.equal(resolveLocale('en-US'), 'en-US');
  assert.equal(resolveLocale('es-ES'), 'es-ES');
});
test('all interface messages have English and Spanish translations with matching placeholders', () => {
  const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [key, values] of Object.entries(translations))
    for (const value of values) {
      assert.ok(value.trim(), key);
      assert.deepEqual(slots(value), slots(key), key);
    }
});
test('language changes translate labels and interpolate values without translating document content', () => {
  assert.equal(translate('pt-BR', 'Documentos'), 'Documentos');
  assert.equal(translate('en-US', 'Documentos'), 'Documents');
  assert.equal(translate('es-ES', 'Modelos'), 'Plantillas');
  assert.equal(
    translate('en-US', 'Etapa {0} de {1}', { 0: 2, 1: 3 }),
    'Stage 2 of 3',
  );
  assert.equal(
    translateSystemMessage('en-US', 'Preencha o campo “campo”.'),
    'Fill in the “campo” field.',
  );
  assert.equal(
    translateSystemMessage(
      'es-ES',
      'Devolveu para correção: Ajustar valor {0}',
    ),
    'Devolvió para corrección: Ajustar valor {0}',
  );
  assert.equal(
    translateSystemMessage('en-US', 'Observação livre: aguardar João'),
    'Observação livre: aguardar João',
  );
});
test('short duration wording follows the selected language', () => {
  assert.equal(durationLabel(500, 'en-US'), 'Less than 1 min');
  assert.equal(durationLabel(500), 'Menos de 1 min');
  assert.equal(durationLabel(500, 'es-ES'), 'Menos de 1 min');
});
