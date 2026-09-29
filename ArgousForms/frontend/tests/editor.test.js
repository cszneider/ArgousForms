import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
import { validateLayout } from '../src/programas/editor/layout-rules.js';
import {
  createDocument,
  hasFieldValue,
  transition,
} from '../src/programas/documentos/domain.js';
import { saveAsset, readAsset } from '../src/programas/editor/assets.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
const { cleanHtml, filledHtml } =
  await import('../src/programas/editor/content.js');
const field = {
  id: 'name',
  label: 'Nome',
  type: 'text',
  required: true,
  options: [],
};
const template = () => ({
  id: 'model',
  name: 'Contrato',
  version: 1,
  sections: [{ id: 'section', title: 'Dados', fields: [{ ...field }] }],
  stages: [
    {
      id: 'stage',
      title: 'Preencher',
      kind: 'fill',
      groupId: 'group',
      sectionIds: ['section'],
    },
  ],
  layout: {
    kind: 'pdf',
    assetId: 'original',
    pages: [{ width: 595, height: 842 }],
    placements: [
      {
        id: 'mark',
        fieldId: 'name',
        page: 0,
        x: 0.1,
        y: 0.1,
        width: 0.3,
        height: 0.1,
        fontSize: 12,
      },
    ],
  },
});

test('PDF exige campos dentro de páginas existentes e todos os campos posicionados', () => {
  const t = template();
  assert.equal(validateLayout(t), null);
  t.layout.placements[0].x = 0.9;
  assert.match(validateLayout(t), /dentro/);
  t.layout.placements[0].x = 0.1;
  t.layout.placements[0].page = 1;
  assert.match(validateLayout(t), /Revise/);
  t.layout.placements = [];
  assert.match(validateLayout(t), /todos/);
  t.sections[0].fields[0].type = 'richtext';
  assert.match(validateLayout(t), /No PDF/);
});
test('modelos antigos continuam válidos e referências a campos excluídos são detectadas', () => {
  const t = template();
  delete t.layout;
  assert.equal(validateLayout(t), null);
  t.layout = {
    kind: 'rich',
    body: '<span data-field-id="removed">Campo</span>',
  };
  assert.match(validateLayout(t), /removidos/);
});
test('documento mantém conteúdo e posições do modelo da sua criação', () => {
  const t = template(),
    doc = createDocument(t, 'Contrato A', 0, 'Ana');
  t.layout.assetId = 'replacement';
  t.layout.placements[0].x = 0.6;
  assert.equal(doc.template.layout.assetId, 'original');
  assert.equal(doc.template.layout.placements[0].x, 0.1);
});
test('HTML importado remove scripts, imagens externas e eventos, preservando tabelas e campos', () => {
  const html = cleanHtml(
    '<script>alert(1)</script><p onclick="evil()" style="text-align:center;color:red">Olá <span data-field-id="name">Nome</span></p><img src="https://example.com/tracker"><table><tr><td>Teste</td></tr></table>',
  );
  assert.doesNotMatch(html, /script|onclick|https:|color:/);
  assert.match(html, /text-align: center/);
  assert.match(html, /data-field-id="name"/);
  assert.match(html, /<td>Teste/);
});
test('preenchimento mantém conteúdo literal e sanitiza valores formatados', () => {
  const html = '<p><span data-field-id="name">Nome</span></p>';
  assert.match(
    filledHtml(html, [field], { name: '<script>teste</script>' }),
    /&lt;script&gt;/,
  );
  assert.doesNotMatch(
    filledHtml(html, [field], { name: 'Ana' }),
    /data-field-id/,
  );
  assert.match(
    filledHtml(html, [{ ...field, type: 'richtext' }], {
      name: '<p><strong>Texto</strong><img src=x onerror=evil()></p>',
    }),
    /<strong>Texto/,
  );
  assert.doesNotMatch(
    filledHtml(html, [{ ...field, type: 'richtext' }], {
      name: '<p onclick="evil()">Texto</p>',
    }),
    /onclick/,
  );
});
test('campo formatado vazio não permite concluir a etapa e grupo incorreto não pode assumir', () => {
  assert.equal(hasFieldValue({ type: 'richtext' }, '<p><br></p>'), false);
  assert.equal(hasFieldValue({ type: 'richtext' }, '<p>&nbsp;</p>'), false);
  const t = template();
  delete t.layout;
  t.sections[0].fields[0].type = 'richtext';
  const person = { id: 'ana', name: 'Ana' },
    groups = [{ id: 'group', memberIds: ['ana'] }];
  let doc = createDocument(t, 'Teste', 0, 'Ana');
  assert.throws(
    () => transition(doc, { id: 'other' }, groups, 'claim'),
    /outro grupo/,
  );
  doc = transition(doc, person, groups, 'claim');
  assert.throws(
    () => transition(doc, person, groups, 'complete', { name: '<p><br></p>' }),
    /Preencha/,
  );
  assert.equal(
    transition(doc, person, groups, 'complete', {
      name: '<p><strong>Resultado</strong></p>',
    }).status,
    'done',
  );
});
test('assinatura rejeita anexos que não sejam imagens', () => {
  const t = template();
  t.sections[0].fields[0].type = 'signature';
  const person = { id: 'ana', name: 'Ana' },
    groups = [{ id: 'group', memberIds: ['ana'] }];
  const doc = transition(
    createDocument(t, 'Teste', 0, 'Ana'),
    person,
    groups,
    'claim',
  );
  assert.throws(
    () =>
      transition(doc, person, groups, 'complete', {
        name: { data: 'data:application/pdf;base64,AAAA' },
      }),
    /imagem/,
  );
});
test('originais persistem separados e importar novamente não sobrescreve a versão anterior', async () => {
  const first = await saveAsset(new Blob(['original'])),
    second = await saveAsset(new Blob(['revisado']));
  assert.notEqual(first, second);
  assert.equal(await (await readAsset(first)).text(), 'original');
  assert.equal(await (await readAsset(second)).text(), 'revisado');
  await assert.rejects(readAsset('missing'), /indisponível/);
});
