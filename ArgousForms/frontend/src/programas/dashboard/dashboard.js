import { processEvents } from '../documentos/process-history.js';
import { stageTimings } from '../documentos/stage-timing.js';
export const defaultDashboardFilters = {
  period: '30',
  templateId: 'all',
};
export function completionTime(doc, now) {
  if (doc.status !== 'done') return null;
  const last = doc.template.stages.at(-1)?.id;
  const times = processEvents(doc)
    .filter(
      (e) =>
        e.kind === 'finished' || (e.kind === 'completed' && e.stageId === last),
    )
    .map((e) => Date.parse(e.at))
    .filter(
      (at) =>
        Number.isFinite(at) && at >= Date.parse(doc.createdAt) && at <= now,
    );
  return times.length ? Math.max(...times) : null;
}
export function dayKey(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function buildDashboard(
  store,
  filters,
  now = Date.now(),
  locale = 'pt-BR',
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filters.period !== 'all')
    start.setDate(start.getDate() - Number(filters.period) + 1);
  const documents = store.documents.filter((d) => {
    const created = Date.parse(d.createdAt);
    return (
      Number.isFinite(created) &&
      created <= now &&
      (filters.period === 'all' || created >= start.getTime()) &&
      (filters.templateId === 'all' || d.template.id === filters.templateId)
    );
  });
  const infos = documents.map((doc) => {
    const timing = stageTimings(doc, now);
    const events = processEvents(doc);
    const completedAt = completionTime(doc, now);
    const returns = events.filter((e) => e.kind === 'returned').length;
    return {
      doc,
      timing,
      completedAt,
      returns,
      wasReturned: returns > 0 || doc.status === 'returned',
      cycleMs:
        completedAt === null ? null : completedAt - Date.parse(doc.createdAt),
    };
  });
  const completed = documents.filter((d) => d.status === 'done'),
    active = documents.filter((d) => d.status !== 'done');
  const unassigned = active.filter((d) => !d.assignee),
    review = active.filter(
      (d) =>
        d.status !== 'returned' &&
        d.template.stages[d.stageIndex]?.kind === 'approve',
    ),
    corrections = active.filter((d) => d.status === 'returned');
  const returnedDocuments = infos
    .filter((i) => i.wasReturned)
    .map((i) => i.doc);
  const cycleSamples = infos.filter((i) => i.cycleMs !== null);
  const meanCycleMs = cycleSamples.length
    ? cycleSamples.reduce((sum, i) => sum + i.cycleMs, 0) / cycleSamples.length
    : null;
  const distribution = [
    {
      key: 'fill',
      label: 'Em preenchimento',
      color: '#387c91',
      documents: active.filter(
        (d) =>
          d.status !== 'returned' &&
          d.template.stages[d.stageIndex]?.kind !== 'approve',
      ),
    },
    {
      key: 'review',
      label: 'Em aprovação',
      color: '#8c79ba',
      documents: review,
    },
    {
      key: 'returned',
      label: 'Em correção',
      color: '#d2a052',
      documents: corrections,
    },
    {
      key: 'done',
      label: 'Finalizados',
      color: '#398a69',
      documents: completed,
    },
  ];
  const stageMap = new Map();
  const flowMap = new Map();
  for (const info of infos) {
    const { doc, timing } = info;
    const flowKey = JSON.stringify([doc.template.id, doc.template.version]);
    let flow = flowMap.get(flowKey);
    if (!flow) {
      flow = {
        key: flowKey,
        name: doc.template.name,
        version: doc.template.version,
        stageCount: doc.template.stages.length,
        documents: [],
        completed: 0,
        returned: 0,
        cycleMs: 0,
        cycleSamples: 0,
      };
      flowMap.set(flowKey, flow);
    }
    flow.documents.push(doc);
    if (doc.status === 'done') flow.completed++;
    if (info.wasReturned) flow.returned++;
    if (info.cycleMs !== null) {
      flow.cycleMs += info.cycleMs;
      flow.cycleSamples++;
    }
    timing.stages.forEach((t, index) => {
      if (!t.visits && !t.active && !t.partial) return;
      const stage = doc.template.stages[index],
        key = JSON.stringify([doc.template.id, doc.template.version, stage.id]);
      let metric = stageMap.get(key);
      if (!metric) {
        metric = {
          key,
          name: stage.title,
          templateName: doc.template.name,
          version: doc.template.version,
          groupName:
            store.groups.find((g) => g.id === stage.groupId)?.name ||
            'Grupo indisponível',
          documents: [],
          measuredDocuments: [],
          totalMs: 0,
          waitingMs: 0,
          unknownMs: 0,
          visits: 0,
          partialCount: 0,
          currentCount: 0,
        };
        stageMap.set(key, metric);
      }
      metric.documents.push(doc);
      if (t.active) metric.currentCount++;
      if (t.partial) metric.partialCount++;
      else if (t.visits) {
        metric.measuredDocuments.push(doc);
        metric.totalMs += t.totalMs;
        metric.waitingMs += t.waitingMs;
        metric.unknownMs += t.unknownMs;
        metric.visits += t.visits;
      }
    });
  }
  const stages = [...stageMap.values()]
    .map((s) => ({
      ...s,
      averageMs: s.measuredDocuments.length
        ? s.totalMs / s.measuredDocuments.length
        : null,
    }))
    .sort((a, b) => (b.averageMs ?? -1) - (a.averageMs ?? -1));
  const flows = [...flowMap.values()]
    .map((f) => ({
      ...f,
      meanCycleMs: f.cycleSamples ? f.cycleMs / f.cycleSamples : null,
    }))
    .sort(
      (a, b) =>
        b.documents.length - a.documents.length || a.name.localeCompare(b.name),
    );
  const groupIds = [
    ...new Set(
      active
        .map((d) => d.template.stages[d.stageIndex]?.groupId)
        .filter(Boolean),
    ),
  ];
  const groups = groupIds
    .map((id) => {
      const docs = active.filter(
        (d) => d.template.stages[d.stageIndex]?.groupId === id,
      );
      return {
        id,
        name:
          store.groups.find((g) => g.id === id)?.name || 'Grupo indisponível',
        documents: docs,
        unassigned: docs.filter((d) => !d.assignee).length,
      };
    })
    .sort(
      (a, b) =>
        b.documents.length - a.documents.length || a.name.localeCompare(b.name),
    );
  const pending = infos
    .filter((i) => i.doc.status !== 'done')
    .map((i) => {
      const current = i.timing.stages[i.doc.stageIndex];
      return {
        doc: i.doc,
        stage: i.doc.template.stages[i.doc.stageIndex],
        elapsedMs: current?.partial ? null : (current?.totalMs ?? null),
        groupName:
          store.groups.find(
            (g) => g.id === i.doc.template.stages[i.doc.stageIndex]?.groupId,
          )?.name || 'Grupo indisponível',
      };
    })
    .sort((a, b) => (b.elapsedMs ?? -1) - (a.elapsedMs ?? -1));
  const days = filters.period === 'all' ? 30 : Number(filters.period);
  const trendStart = new Date(now);
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - days + 1);
  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(date.getDate() + index);
    return {
      key: dayKey(date.getTime()),
      day: date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
      }),
      created: 0,
      completed: 0,
    };
  });
  const buckets = new Map(trend.map((d) => [d.key, d]));
  for (const info of infos) {
    const created = buckets.get(dayKey(Date.parse(info.doc.createdAt)));
    if (created) created.created++;
    if (info.completedAt !== null) {
      const finished = buckets.get(dayKey(info.completedAt));
      if (finished) finished.completed++;
    }
  }
  return {
    documents,
    active,
    completed,
    unassigned,
    review,
    corrections,
    returnedDocuments,
    returnCount: infos.reduce((sum, i) => sum + i.returns, 0),
    returnRate: documents.length
      ? (returnedDocuments.length / documents.length) * 100
      : 0,
    completionRate: documents.length
      ? (completed.length / documents.length) * 100
      : 0,
    meanCycleMs,
    cycleSamples: cycleSamples.length,
    distribution,
    stages,
    flows,
    groups,
    pending,
    trend,
    trendDays: days,
    partialCount: infos.filter((i) => i.timing.partial).length,
    unknownCount: infos.filter((i) =>
      i.timing.stages.some((s) => s.unknownMs > 0),
    ).length,
  };
}
