import { processEvents } from './process-history.js';
/** Wall-clock residence time, accumulated across visits; future stages never accrue time. */
export function stageTimings(doc, now = Date.now()) {
  const rows = doc.template.stages.map((s) => ({
    stageId: s.id,
    totalMs: 0,
    waitingMs: 0,
    assignedMs: 0,
    unknownMs: 0,
    visits: 0,
    active: false,
    partial: false,
  }));
  const row = (id) => rows.find((r) => r.stageId === id);
  let visit;
  const begin = (id, at) => {
    const r = row(id);
    if (!r) return;
    if (!Number.isFinite(at) || at > now) {
      r.partial = true;
      return;
    }
    r.visits++;
    visit = {
      id: r.stageId,
      entered: at,
      last: at,
      phase: 'waiting',
      waiting: 0,
      assigned: 0,
      unknown: 0,
      evidence: false,
    };
  };
  const accrue = (at) => {
    if (!visit) return false;
    if (!Number.isFinite(at) || at < visit.last || at > now) {
      row(visit.id).partial = true;
      return false;
    }
    const delta = at - visit.last;
    if (visit.phase === 'waiting') visit.waiting += delta;
    else visit.assigned += delta;
    visit.last = at;
    return true;
  };
  const discard = (source) => {
    if (visit) row(visit.id).partial = true;
    const r = row(source);
    if (r) r.partial = true;
    visit = undefined;
  };
  const finish = (at, open = false) => {
    if (!visit) return;
    if (!accrue(at)) {
      visit = undefined;
      return;
    }
    const r = row(visit.id);
    const total = at - visit.entered;
    r.totalMs += total;
    // Completion without a claim means old history cannot tell waiting from work.
    if (!open && !visit.evidence) {
      r.unknownMs += total;
    } else {
      r.waitingMs += visit.waiting;
      r.assignedMs += visit.assigned;
      r.unknownMs += visit.unknown;
    }
    r.active = open;
    visit = undefined;
  };
  begin(doc.template.stages[0]?.id, Date.parse(doc.createdAt));
  for (const e of processEvents(doc)) {
    const at = Date.parse(e.at);
    if (e.kind === 'created') continue;
    if (!Number.isFinite(at) || at > now) {
      if (row(e.stageId)) row(e.stageId).partial = true;
      continue;
    }
    if (e.kind === 'claimed' || e.kind === 'saved' || e.kind === 'unassigned') {
      if (!visit || visit.id !== e.stageId) {
        discard(e.stageId);
        continue;
      }
      if (!accrue(at)) continue;
      if (e.kind === 'unassigned') visit.phase = 'waiting';
      else {
        if (e.kind === 'saved' && !visit.evidence) {
          visit.unknown += visit.waiting;
          visit.waiting = 0;
        }
        visit.phase = 'assigned';
        visit.evidence = true;
      }
    } else if (e.kind === 'completed' || e.kind === 'returned') {
      if (visit && visit.id === e.stageId) finish(at);
      else discard(e.stageId);
      if (e.toStageId) begin(e.toStageId, at);
    } else if (e.kind === 'finished') {
      if (visit && visit.id === e.stageId) finish(at);
    }
  }
  const current = row(doc.template.stages[doc.stageIndex]?.id);
  if (doc.status !== 'done') {
    if (visit && visit.id === current?.stageId) {
      // Old records or membership changes may omit the assignment event.
      if (Boolean(doc.assignee) !== (visit.phase === 'assigned')) {
        current.partial = true;
        visit.unknown += visit.waiting + visit.assigned;
        visit.waiting = 0;
        visit.assigned = 0;
        if (accrue(now)) {
          visit.unknown += visit.waiting + visit.assigned;
          visit.waiting = 0;
          visit.assigned = 0;
        }
        visit.evidence = true;
      }
      finish(now, true);
    } else {
      discard(current?.stageId);
      if (current) current.active = true;
    }
  } else if (visit) discard(visit.id);
  const maximum = Math.max(0, ...rows.map((r) => r.totalMs));
  return {
    stages: rows,
    longestIds:
      maximum > 0
        ? rows.filter((r) => r.totalMs === maximum).map((r) => r.stageId)
        : [],
    totalMs: rows.reduce((sum, r) => sum + r.totalMs, 0),
    partial: rows.some((r) => r.partial),
  };
}
export function durationLabel(ms, locale = 'pt-BR') {
  if (ms <= 0) return '0 min';
  const minutes = Math.floor(ms / 60000);
  if (!minutes)
    return locale === 'en-US' ? 'Less than 1 min' : 'Menos de 1 min';
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    rest = minutes % 60;
  if (days) return `${days} d${hours ? ` ${hours} h` : ''}`;
  if (hours) return `${hours} h${rest ? ` ${rest} min` : ''}`;
  return `${rest} min`;
}
