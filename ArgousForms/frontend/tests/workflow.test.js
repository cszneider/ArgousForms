import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocument,
  transition,
  validateTemplate,
} from '../src/programas/documentos/domain.js';
const a = { id: 'a', name: 'Ana', role: 'participant' },
  b = { id: 'b', name: 'Bruno', role: 'participant' },
  c = { id: 'c', name: 'Carla', role: 'participant' };
const groups = [
  { id: 'g1', name: 'Atendimento', description: '', memberIds: ['a'] },
  { id: 'g2', name: 'Técnico', description: '', memberIds: ['b'] },
  { id: 'g3', name: 'Supervisor', description: '', memberIds: ['c'] },
];
const model = {
  id: 't',
  name: 'Relatório',
  description: '',
  version: 1,
  sections: [
    {
      id: 's1',
      title: 'Cliente',
      fields: [
        {
          id: 'name',
          label: 'Nome',
          type: 'text',
          required: true,
          hint: '',
          options: [],
        },
      ],
    },
    {
      id: 's2',
      title: 'Diagnóstico',
      fields: [
        {
          id: 'result',
          label: 'Resultado',
          type: 'textarea',
          required: true,
          hint: '',
          options: [],
        },
      ],
    },
  ],
  stages: [
    {
      id: 'e1',
      title: 'Identificação',
      groupId: 'g1',
      kind: 'fill',
      sectionIds: ['s1'],
    },
    {
      id: 'e2',
      title: 'Análise',
      groupId: 'g2',
      kind: 'fill',
      sectionIds: ['s2'],
    },
    {
      id: 'e3',
      title: 'Aprovação',
      groupId: 'g3',
      kind: 'approve',
      sectionIds: [],
    },
  ],
};
const create = () => createDocument(model, 'Manutenção', 0, 'Ana');
test('três grupos concluem um documento e registram o histórico', () => {
  let d = create();
  d = transition(d, a, groups, 'claim');
  d = transition(d, a, groups, 'complete', { name: 'Cliente A' });
  assert.equal(d.stageIndex, 1);
  assert.equal(d.assignee, null);
  d = transition(d, b, groups, 'claim');
  d = transition(d, b, groups, 'complete', { result: 'Equipamento revisado' });
  d = transition(d, c, groups, 'claim');
  d = transition(d, c, groups, 'complete');
  assert.equal(d.status, 'done');
  assert.equal(d.values.name, 'Cliente A');
  assert.equal(d.values.result, 'Equipamento revisado');
  assert.equal(d.history.length, 8);
  assert.throws(() => transition(d, c, groups, 'claim'), /outro grupo/);
});
test('bloqueia grupo incorreto, trabalho sem atribuição e campo obrigatório vazio', () => {
  const d = create();
  assert.throws(() => transition(d, b, groups, 'claim'), /outro grupo/);
  assert.throws(() => transition(d, a, groups, 'complete'), /Assuma/);
  const assigned = transition(d, a, groups, 'claim');
  assert.throws(
    () => transition(assigned, a, groups, 'complete', { name: '  ' }),
    /Nome/,
  );
  assert.equal(assigned.stageIndex, 0);
});
test('um segundo integrante não modifica uma tarefa já assumida', () => {
  const shared = groups.map((g) =>
    g.id === 'g1' ? { ...g, memberIds: ['a', 'b'] } : g,
  );
  const d = transition(create(), a, shared, 'claim');
  assert.throws(() => transition(d, b, shared, 'claim'), /outro participante/);
});
test('devolução exige justificativa e permite correção e reenvio', () => {
  let d = transition(create(), a, groups, 'claim');
  assert.throws(
    () => transition(d, a, groups, 'return', {}, 'Corrigir'),
    /primeira etapa/,
  );
  d = transition(d, a, groups, 'complete', { name: 'Cliente' });
  d = transition(d, b, groups, 'claim');
  assert.throws(() => transition(d, b, groups, 'return', {}, ''), /Explique/);
  d = transition(d, b, groups, 'return', {}, 'Detalhe o cliente');
  assert.equal(d.stageIndex, 0);
  assert.equal(d.status, 'returned');
  assert.equal(d.assignee, null);
  assert.match(d.history.at(-1).message, /Detalhe o cliente/);
  d = transition(d, a, groups, 'claim');
  d = transition(d, a, groups, 'complete', { name: 'Cliente corrigido' });
  assert.equal(d.stageIndex, 1);
  assert.equal(d.status, 'active');
});
test('rascunho aceita dados parciais e não permite editar campos de outro grupo', () => {
  let d = transition(create(), a, groups, 'claim');
  d = transition(d, a, groups, 'save', {
    name: '',
    result: 'Injeção em outra seção',
  });
  assert.equal(d.values.name, '');
  assert.equal(d.values.result, undefined);
  assert.equal(d.stageIndex, 0);
});
test('cada documento mantém uma cópia imutável do modelo original', () => {
  const t = structuredClone(model);
  const d = createDocument(t, 'Documento A', 1, 'Ana');
  t.name = 'Alterado';
  t.sections[0].fields[0].label = 'Novo campo';
  t.stages.reverse();
  assert.equal(d.template.name, 'Relatório');
  assert.equal(d.template.sections[0].fields[0].label, 'Nome');
  assert.equal(d.template.stages[0].id, 'e1');
  assert.equal(d.code, 'DOC-0002');
});
test('validação rejeita fluxo incompleto, grupo vazio e seleção sem opções', () => {
  assert.equal(validateTemplate(model, groups), null);
  const incomplete = structuredClone(model);
  incomplete.stages.shift();
  assert.match(validateTemplate(incomplete, groups), /Todas as seções/);
  assert.match(
    validateTemplate(
      model,
      groups.map((g) => ({ ...g, memberIds: [] })),
    ),
    /participantes/,
  );
  const noOptions = structuredClone(model);
  noOptions.sections[0].fields[0].type = 'select';
  assert.match(validateTemplate(noOptions, groups), /opções/);
});
import {
  processEvents,
  stageAppearance,
} from '../src/programas/documentos/process-history.js';
test('fluxograma liga devoluções às etapas e reabre etapas já executadas', () => {
  let d = transition(create(), a, groups, 'claim');
  d = transition(d, a, groups, 'complete', { name: 'Cliente' });
  d = transition(d, b, groups, 'claim');
  d = transition(d, b, groups, 'complete', { result: 'Diagnóstico' });
  d = transition(d, c, groups, 'claim');
  d = transition(d, c, groups, 'return', d.values, 'Completar diagnóstico');
  const event = processEvents(d).at(-1);
  assert.equal(event.kind, 'returned');
  assert.equal(event.stageId, 'e3');
  assert.equal(event.toStageId, 'e2');
  assert.equal(stageAppearance(d, 1).tone, 'returned');
  d = transition(d, b, groups, 'claim');
  d = transition(d, b, groups, 'return', d.values, 'Rever identificação');
  assert.equal(stageAppearance(d, 1).label, 'Aguardando nova passagem');
  assert.equal(processEvents(d).filter((e) => e.kind === 'returned').length, 2);
});
test('registros antigos mantêm conteúdo e recuperam encaminhamento e devolução', () => {
  let d = transition(create(), a, groups, 'claim');
  d = transition(d, a, groups, 'complete', { name: 'Cliente' });
  d = transition(d, b, groups, 'claim');
  d = transition(d, b, groups, 'return', d.values, 'Corrigir nome');
  const legacy = {
    ...d,
    history: d.history.map(({ id, at, actor, message }) => ({
      id,
      at,
      actor,
      message,
    })),
  };
  const snapshot = JSON.stringify(legacy);
  const events = processEvents(legacy);
  assert.equal(events.length, d.history.length);
  assert.equal(events.at(-1).stageId, 'e2');
  assert.equal(events.at(-1).toStageId, 'e1');
  assert.equal(JSON.stringify(legacy), snapshot);
});
test('exemplo antigo com histórico incompleto identifica a última devolução pelo estado atual', () => {
  const d = create();
  d.status = 'returned';
  d.history.push({
    id: 'old-return',
    at: d.updatedAt,
    actor: 'Bruno',
    message: 'Devolveu para correção: Identifique o cliente',
  });
  const events = processEvents(d);
  assert.equal(events.at(-1).stageId, 'e2');
  assert.equal(events.at(-1).toStageId, 'e1');
  const unknown = { ...d, status: 'active' };
  assert.equal(processEvents(unknown).at(-1).stageId, undefined);
});
