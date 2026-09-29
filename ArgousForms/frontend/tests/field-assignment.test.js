import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument,
  transition,
  canEditField,
  canContribute,
  validateTemplate,
} from '../src/programas/documentos/domain.js';
const people = [
  { id: 'owner', name: 'Coordenador' },
  { id: 'ana', name: 'Ana' },
  { id: 'bia', name: 'Bia' },
  { id: 'other', name: 'Outro' },
];
const [owner, ana, bia, other] = people;
const groups = [
  { id: 'coord', memberIds: ['owner'] },
  { id: 'team', memberIds: ['ana', 'bia'] },
];
const model = () => ({
  id: 'model',
  name: 'Teste',
  sections: [
    {
      id: 's',
      title: 'Dados',
      fields: [
        {
          id: 'first',
          label: 'Assinatura 1',
          type: 'text',
          required: true,
          options: [],
          responsibility: { type: 'user', id: 'ana' },
        },
        {
          id: 'second',
          label: 'Assinatura 2',
          type: 'text',
          required: true,
          options: [],
          responsibility: { type: 'group', id: 'team' },
        },
        {
          id: 'legacy',
          label: 'Coordenação',
          type: 'text',
          required: false,
          options: [],
        },
      ],
    },
  ],
  stages: [
    {
      id: 'fill',
      title: 'Preencher',
      kind: 'fill',
      groupId: 'coord',
      sectionIds: ['s'],
    },
  ],
});
const doc = () =>
  transition(
    createDocument(model(), 'Teste', 0, 'Coordenador'),
    owner,
    groups,
    'claim',
  );
test('usuário específico e qualquer membro do grupo preenchem campos independentes', () => {
  let d = doc();
  assert.equal(canContribute(d, bia, groups), true);
  d = transition(d, ana, groups, 'save', {
    first: 'Ana',
    second: 'Equipe',
    legacy: 'Não autorizado',
  });
  assert.equal(d.values.first, 'Ana');
  assert.equal(d.values.second, 'Equipe');
  assert.equal(d.values.legacy, undefined);
  d = transition(d, bia, groups, 'save', {
    first: 'Não autorizado',
    second: 'Bia',
  });
  assert.equal(d.values.first, 'Ana');
  assert.equal(d.values.second, 'Bia');
  assert.equal(d.assignee, 'owner');
});
test('outros usuários e coordenador não substituem campos atribuídos a uma pessoa', () => {
  let d = doc();
  assert.throws(
    () => transition(d, other, groups, 'save', { first: 'Outro' }),
    /outro grupo/,
  );
  d = transition(d, owner, groups, 'save', {
    first: 'Inválido',
    legacy: 'Coordenação',
  });
  assert.equal(d.values.first, undefined);
  assert.equal(d.values.legacy, 'Coordenação');
  assert.equal(
    canEditField(d, d.template.sections[0].fields[0], bia, groups),
    false,
  );
});
test('conclusão exige valores obrigatórios e participantes não assumem a coordenação', () => {
  let d = doc();
  assert.throws(() => transition(d, owner, groups, 'complete'), /Preencha/);
  assert.throws(
    () =>
      transition(d, ana, groups, 'complete', {
        first: 'Ana',
        second: 'Equipe',
      }),
    /outro grupo/,
  );
  d = transition(d, ana, groups, 'save', { first: 'Ana', second: 'Equipe' });
  d = transition(d, owner, groups, 'complete', {
    first: 'Tentativa de sobrescrever',
    legacy: 'Ok',
  });
  assert.equal(d.status, 'done');
  assert.equal(d.values.first, 'Ana');
  assert.equal(canContribute(d, ana, groups), false);
});
test('responsáveis precisam existir para publicar; vínculo de usuário não depende de grupo', () => {
  const t = model();
  assert.equal(validateTemplate(t, groups, people), null);
  t.sections[0].fields[0].responsibility.id = 'missing';
  assert.match(validateTemplate(t, groups, people), /usuário válido/);
  t.sections[0].fields[0].responsibility = { type: 'group', id: 'missing' };
  assert.match(validateTemplate(t, groups, people), /usuário válido/);
});
test('campos de etapas futuras não podem ser alterados por seus responsáveis', () => {
  const d = doc();
  d.template.sections.push({
    id: 'later',
    fields: [{ id: 'future', responsibility: { type: 'user', id: 'ana' } }],
  });
  const saved = transition(d, ana, groups, 'save', {
    future: 'Injeção',
    first: 'Ana',
  });
  assert.equal(saved.values.future, undefined);
  assert.equal(saved.values.first, 'Ana');
});
