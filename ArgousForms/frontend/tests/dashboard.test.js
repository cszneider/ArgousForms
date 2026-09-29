import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboard,
  dayKey,
} from '../src/programas/dashboard/dashboard.js';
const hour = 3600000,
  now = new Date(2026, 8, 8, 12).getTime();
const at = (hoursAgo) => new Date(now - hoursAgo * hour).toISOString();
function make(id, createdAgo = 24, version = 1) {
  return {
    id,
    code: id,
    title: id,
    template: {
      id: 'template',
      name: 'Modelo',
      version,
      description: '',
      sections: [],
      stages: [
        {
          id: 's1',
          title: 'Preencher',
          groupId: 'a',
          kind: 'fill',
          sectionIds: [],
        },
        {
          id: 's2',
          title: 'Aprovar',
          groupId: 'b',
          kind: 'approve',
          sectionIds: [],
        },
      ],
    },
    values: {},
    stageIndex: 0,
    status: 'active',
    assignee: null,
    createdAt: at(createdAgo),
    updatedAt: at(createdAgo),
    history: [
      {
        id: id + '-start',
        at: at(createdAgo),
        actor: 'Ana',
        message: 'Documento iniciado.',
        kind: 'created',
        stageId: 's1',
      },
    ],
  };
}
function event(id, ago, kind, stageId = 's1', toStageId) {
  return {
    id,
    at: at(ago),
    actor: 'Ana',
    message: kind || '',
    kind,
    stageId,
    toStageId,
  };
}
function store(documents) {
  return {
    schema: 1,
    documents,
    templates: [],
    people: [],
    groups: [
      { id: 'a', name: 'Atendimento', description: '', memberIds: [] },
      { id: 'b', name: 'Supervisão', description: '', memberIds: [] },
    ],
  };
}
const all = { period: 'all', templateId: 'all' };
test('dashboard mantém contagens, distribuição e filas consistentes', () => {
  const fill = make('fill'),
    review = make('review'),
    returned = make('returned'),
    done = make('done');
  review.stageIndex = 1;
  review.history.push(event('advance', 12, 'completed', 's1', 's2'));
  returned.status = 'returned';
  returned.history.push(event('return', 2, 'returned', 's2', 's1'));
  done.status = 'done';
  done.stageIndex = 1;
  done.history.push(
    event('finish1', 12, 'completed', 's1', 's2'),
    event('finish2', 3, 'completed', 's2'),
  );
  const data = buildDashboard(store([fill, review, returned, done]), all, now);
  assert.equal(data.documents.length, 4);
  assert.equal(data.active.length, 3);
  assert.equal(data.completed.length, 1);
  assert.equal(data.unassigned.length, 3);
  assert.equal(data.returnRate, 25);
  assert.equal(data.completionRate, 25);
  assert.equal(data.returnCount, 1);
  assert.deepEqual(
    data.distribution.map((s) => s.documents.length),
    [1, 1, 1, 1],
  );
  assert.equal(
    data.groups.reduce((n, g) => n + g.documents.length, 0),
    3,
  );
  assert.equal(data.groups[0].name, 'Atendimento');
});
test('média de conclusão exclui documentos abertos e finalizações sem horário', () => {
  const done = make('done');
  done.status = 'done';
  done.stageIndex = 1;
  done.history.push(event('complete', 4, 'completed', 's2'));
  const incomplete = make('missing');
  incomplete.status = 'done';
  const data = buildDashboard(
    store([done, incomplete, make('active')]),
    all,
    now,
  );
  assert.equal(data.cycleSamples, 1);
  assert.equal(data.meanCycleMs, 20 * hour);
  assert.equal(data.completed.length, 2);
});
test('período filtra data de criação e modelo, sem incluir documentos futuros', () => {
  const recent = make('recent', 1),
    old = make('old', 24 * 10),
    future = make('future', -1),
    other = make('other', 2);
  other.template.id = 'another';
  const data = buildDashboard(
    store([recent, old, future, other]),
    { period: '7', templateId: 'template' },
    now,
  );
  assert.deepEqual(
    data.documents.map((d) => d.id),
    ['recent'],
  );
  assert.equal(data.trend.length, 7);
  assert.equal(
    data.trend.reduce((n, d) => n + d.created, 0),
    1,
  );
});
test('compara versões separadas e não mede etapas futuras', () => {
  const first = make('v1', 6, 1),
    second = make('v2', 12, 2);
  const data = buildDashboard(store([first, second]), all, now);
  assert.equal(data.flows.length, 2);
  assert.equal(data.stages.length, 2);
  assert.ok(data.stages.every((s) => s.name === 'Preencher'));
  assert.equal(data.stages[0].version, 2);
  assert.equal(data.stages[0].averageMs, 12 * hour);
  assert.equal(data.stages[0].measuredDocuments.length, 1);
});
test('médias por etapa excluem histórico parcial e retorno soma no mesmo documento', () => {
  const valid = make('valid', 20);
  valid.history.push(
    event('claim1', 19, 'claimed'),
    event('forward', 15, 'completed', 's1', 's2'),
    event('claim2', 14, 'claimed', 's2'),
    event('back', 10, 'returned', 's2', 's1'),
  );
  valid.status = 'returned';
  const partial = make('partial', 100);
  partial.history.push(event('missing-forward', 8, 'returned', 's2', 's1'));
  partial.status = 'returned';
  const data = buildDashboard(store([valid, partial]), all, now);
  const first = data.stages.find((s) => s.name === 'Preencher');
  assert.equal(first.averageMs, 15 * hour);
  assert.equal(first.measuredDocuments.length, 1);
  assert.equal(first.partialCount, 1);
  assert.equal(first.documents.length, 2);
  assert.equal(data.returnedDocuments.length, 2);
  assert.equal(data.partialCount, 1);
});
test('gráfico usa o dia real da conclusão, inclusive para documentos antigos no filtro geral', () => {
  const d = make('old', 24 * 80);
  d.status = 'done';
  d.stageIndex = 1;
  d.history.push(event('complete', 1, 'completed', 's2'));
  const data = buildDashboard(store([d]), all, now);
  assert.equal(
    data.trend.reduce((n, t) => n + t.created, 0),
    0,
  );
  assert.equal(
    data.trend.find((t) => t.key === dayKey(now - hour)).completed,
    1,
  );
  assert.equal(
    data.trend.reduce((n, t) => n + t.completed, 0),
    1,
  );
});
test('recorte vazio retorna indicadores vazios sem médias ou percentuais inválidos', () => {
  const data = buildDashboard(store([]), all, now);
  assert.equal(data.meanCycleMs, null);
  assert.equal(data.returnRate, 0);
  assert.equal(data.completionRate, 0);
  assert.deepEqual(data.stages, []);
  assert.deepEqual(data.groups, []);
  assert.equal(data.trend.length, 30);
});
