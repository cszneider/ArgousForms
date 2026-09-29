/** Old documents retain their text records. Only unambiguous legacy transitions are linked. */
export function processEvents(doc) {
  let cursor;
  return doc.history.map((entry, index) => {
    if (entry.kind) {
      const source = doc.template.stages.findIndex(
        (s) => s.id === entry.stageId,
      );
      const target = doc.template.stages.findIndex(
        (s) => s.id === entry.toStageId,
      );
      if (target >= 0) cursor = target;
      else if (source >= 0) cursor = source;
      return { ...entry, kind: entry.kind };
    }
    const message = entry.message;
    if (message === 'Documento iniciado.') {
      cursor = 0;
      return { ...entry, kind: 'created', stageId: doc.template.stages[0]?.id };
    }
    const match =
      /^(Assumiu|Concluiu|Aprovou) a etapa: (.+?)(?:\. Documento finalizado\.)?$/.exec(
        message,
      );
    if (match) {
      const matches = doc.template.stages
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.title === match[2]);
      if (matches.length === 1) {
        const { s, i } = matches[0];
        const kind = match[1] === 'Assumiu' ? 'claimed' : 'completed';
        cursor =
          kind === 'completed'
            ? Math.min(i + 1, doc.template.stages.length - 1)
            : i;
        return {
          ...entry,
          kind,
          stageId: s.id,
          ...(kind === 'completed' && i + 1 < doc.template.stages.length
            ? { toStageId: doc.template.stages[i + 1].id }
            : {}),
        };
      }
    }
    if (message.startsWith('Devolveu para correção:')) {
      // A returned document identifies the destination of its latest return,
      // even if early demo records omitted the preceding completion.
      const latestReturn =
        doc.status === 'returned' &&
        !doc.history
          .slice(index + 1)
          .some(
            (e) =>
              e.kind === 'returned' ||
              e.kind === 'completed' ||
              /^(Devolveu|Concluiu|Aprovou)/.test(e.message),
          );
      const source = latestReturn ? doc.stageIndex + 1 : cursor;
      if (
        source !== undefined &&
        source > 0 &&
        source < doc.template.stages.length
      ) {
        cursor = source - 1;
        return {
          ...entry,
          kind: 'returned',
          stageId: doc.template.stages[source].id,
          toStageId: doc.template.stages[cursor].id,
        };
      }
      return { ...entry, kind: 'returned' };
    }
    if (
      message ===
      'Reabriu a atribuição da etapa após alterar os participantes do grupo.'
    )
      return {
        ...entry,
        kind: 'unassigned',
        stageId:
          cursor === undefined ? undefined : doc.template.stages[cursor]?.id,
      };
    if (message === 'Documento finalizado.')
      return {
        ...entry,
        kind: 'finished',
        stageId: doc.template.stages.at(-1)?.id,
      };
    if (message === 'Salvou um rascunho.')
      return {
        ...entry,
        kind: 'saved',
        stageId:
          cursor === undefined ? undefined : doc.template.stages[cursor]?.id,
      };
    return { ...entry, kind: 'note' };
  });
}
export function stageAppearance(doc, index) {
  if (doc.status === 'done' || index < doc.stageIndex)
    return { tone: 'done', label: 'Concluída' };
  if (index === doc.stageIndex)
    return {
      tone: doc.status === 'returned' ? 'returned' : 'current',
      label:
        doc.status === 'returned'
          ? 'Correção solicitada'
          : doc.assignee
            ? 'Em execução'
            : 'Etapa atual',
    };
  const previouslyCompleted = processEvents(doc).some(
    (e) =>
      e.stageId === doc.template.stages[index].id && e.kind === 'completed',
  );
  return {
    tone: 'pending',
    label: previouslyCompleted ? 'Aguardando nova passagem' : 'Aguardando',
  };
}
