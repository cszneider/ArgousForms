import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stageTimings,
  durationLabel,
} from '../src/programas/documentos/stage-timing.js';
const base = Date.parse('2026-09-01T00:00:00Z'),
  hour = 3600000;
const at = (h) => new Date(base + h * hour).toISOString();
function event(h, kind, stageId = 'one', toStageId) {
  return {
    id: `${kind}-${h}-${stageId}`,
    at: at(h),
    actor: 'Ana',
    message: kind || '',
    kind,
    stageId,
    toStageId,
  };
}
function doc(history, stageIndex = 0, status = 'active', assignee = null) {
  return {
    id: 'd',
    code: 'DOC-0001',
    title: 'Exemplo',
    template: {
      id: 't',
      name: 'Modelo',
      description: '',
      version: 1,
      sections: [],
      stages: ['one', 'two', 'three'].map((id, i) => ({
        id,
        title: `Etapa ${i + 1}`,
        kind: 'fill',
        groupId: 'group',
        sectionIds: [],
      })),
    },
    values: {},
    stageIndex,
    status,
    assignee,
    createdAt: at(0),
    updatedAt: history.at(-1)?.at || at(0),
    history: [event(0, 'created'), ...history],
  };
}
test('etapa atual conta desde a chegada; etapas futuras não acumulam espera', () => {
  const result = stageTimings(doc([]), base + 3 * hour);
  assert.equal(result.stages[0].totalMs, 3 * hour);
  assert.equal(result.stages[0].waitingMs, 3 * hour);
  assert.equal(result.stages[0].active, true);
  assert.equal(result.stages[1].totalMs, 0);
  assert.equal(result.stages[1].visits, 0);
  assert.deepEqual(result.longestIds, ['one']);
});
test('separa espera da atribuição e acumula novas passagens após devolução', () => {
  const d = doc(
    [
      event(2, 'claimed'),
      event(5, 'completed', 'one', 'two'),
      event(10, 'claimed', 'two'),
      event(12, 'returned', 'two', 'one'),
    ],
    0,
    'returned',
  );
  const result = stageTimings(d, base + 20 * hour);
  const [first, second] = result.stages;
  assert.equal(first.totalMs, 13 * hour);
  assert.equal(first.waitingMs, 10 * hour);
  assert.equal(first.assignedMs, 3 * hour);
  assert.equal(first.visits, 2);
  assert.equal(second.totalMs, 7 * hour);
  assert.equal(second.waitingMs, 5 * hour);
  assert.equal(second.assignedMs, 2 * hour);
  assert.equal(result.totalMs, 20 * hour);
  assert.deepEqual(result.longestIds, ['one']);
  assert.equal(result.partial, false);
});
test('mudança de atribuição volta a contar espera e não duplica períodos', () => {
  const d = doc(
    [
      event(2, 'claimed'),
      event(4, 'unassigned'),
      event(6, 'claimed'),
      event(7, 'saved'),
      event(10, 'completed', 'one', 'two'),
    ],
    1,
  );
  const r = stageTimings(d, base + 10 * hour).stages[0];
  assert.equal(r.totalMs, 10 * hour);
  assert.equal(r.waitingMs, 4 * hour);
  assert.equal(r.assignedMs, 6 * hour);
  assert.equal(r.unknownMs, 0);
});
test('documentos finalizados congelam a duração na conclusão', () => {
  const d = doc(
    [
      event(4, 'completed', 'one', 'two'),
      event(7, 'completed', 'two', 'three'),
      event(9, 'completed', 'three'),
      event(9, 'finished', 'three'),
    ],
    2,
    'done',
  );
  const result = stageTimings(d, base + 100 * hour);
  assert.equal(result.totalMs, 9 * hour);
  assert.equal(result.stages[2].totalMs, 2 * hour);
  assert.ok(result.stages.every((r) => !r.active));
  assert.equal(result.stages[0].unknownMs, 4 * hour);
});
test('registros antigos sem atribuição preservam total sem inventar tempo de trabalho', () => {
  const d = doc(
    [
      {
        id: 'old',
        at: at(5),
        actor: 'Ana',
        message: 'Concluiu a etapa: Etapa 1',
      },
    ],
    1,
  );
  const r = stageTimings(d, base + 7 * hour);
  assert.equal(r.stages[0].totalMs, 5 * hour);
  assert.equal(r.stages[0].unknownMs, 5 * hour);
  assert.equal(r.stages[0].assignedMs, 0);
  assert.equal(r.stages[0].waitingMs, 0);
  assert.equal(r.stages[1].waitingMs, 2 * hour);
});
test('lacunas no histórico não viram tempo atribuído à etapa errada', () => {
  const d = doc([event(12, 'returned', 'two', 'one')], 0, 'returned');
  const r = stageTimings(d, base + 20 * hour);
  assert.equal(r.partial, true);
  assert.equal(r.totalMs, 8 * hour);
  assert.equal(r.stages[0].totalMs, 8 * hour);
  assert.equal(r.stages[1].totalMs, 0);
  assert.equal(r.stages[1].partial, true);
});
test('empates são identificados e contagem zero não marca gargalo', () => {
  const r = stageTimings(
    doc([event(5, 'completed', 'one', 'two')], 1),
    base + 10 * hour,
  );
  assert.deepEqual(r.longestIds, ['one', 'two']);
  assert.deepEqual(stageTimings(doc([]), base).longestIds, []);
});
test('apresenta durações em minutos, horas e dias', () => {
  assert.equal(durationLabel(0), '0 min');
  assert.equal(durationLabel(1000), 'Menos de 1 min');
  assert.equal(durationLabel(90 * 60000), '1 h 30 min');
  assert.equal(durationLabel(27 * hour), '1 d 3 h');
});
