import { createId } from '../../utils/uid.js';
import { validateLayout } from '../editor/layout-rules.js';
export const uid = () => createId();
export const timestamp = () => new Date().toISOString();
export function log(actor, message, context = {}) {
  return { id: uid(), at: timestamp(), actor, message, ...context };
}
export function canWork(doc, person, groups) {
  return (
    doc.status !== 'done' &&
    !!groups
      .find((g) => g.id === doc.template.stages[doc.stageIndex]?.groupId)
      ?.memberIds.includes(person.id)
  );
}
export function canEditField(doc, field, person, groups) {
  const stage = doc.template.stages[doc.stageIndex];
  if (
    doc.status === 'done' ||
    stage?.kind !== 'fill' ||
    !doc.template.sections.some(
      (section) =>
        stage.sectionIds.includes(section.id) &&
        section.fields.some((item) => item.id === field.id),
    )
  )
    return false;
  const responsibility = field.responsibility;
  if (responsibility?.type === 'user') return responsibility.id === person.id;
  if (responsibility?.type === 'group')
    return !!groups
      .find((group) => group.id === responsibility.id)
      ?.memberIds.includes(person.id);
  return canWork(doc, person, groups) && doc.assignee === person.id;
}
export function canContribute(doc, person, groups) {
  return doc.template.sections
    .flatMap((section) => section.fields)
    .some(
      (field) =>
        field.responsibility && canEditField(doc, field, person, groups),
    );
}
export function createDocument(template, title, count, actor) {
  if (template.draft)
    throw Error('Conclua e salve o modelo antes de iniciar um documento.');
  if (!title.trim()) throw Error('Informe um título para o documento.');
  const now = timestamp();
  return {
    id: uid(),
    code: `DOC-${String(count + 1).padStart(4, '0')}`,
    title: title.trim(),
    template: structuredClone(template),
    values: {},
    stageIndex: 0,
    status: 'active',
    assignee: null,
    createdAt: now,
    updatedAt: now,
    history: [
      log(actor, 'Documento iniciado.', {
        kind: 'created',
        stageId: template.stages[0]?.id,
      }),
    ],
  };
}
export function validateTemplate(t, groups, people = []) {
  const layoutError = validateLayout(t);
  if (layoutError) return layoutError;
  if (!t.name.trim()) return 'Dê um nome ao modelo.';
  if (!t.sections.length) return 'Adicione pelo menos uma seção.';
  if (t.sections.some((s) => !s.title.trim() || !s.fields.length))
    return 'Cada seção precisa de título e pelo menos um campo.';
  if (
    t.sections.some((s) =>
      s.fields.some(
        (f) =>
          !f.label.trim() ||
          (f.type === 'select' && !f.options.some((o) => o.trim())),
      ),
    )
  )
    return 'Dê um nome a cada campo e opções aos campos de seleção.';
  for (const field of t.sections.flatMap((section) => section.fields)) {
    const target = field.responsibility;
    if (
      target &&
      !(target.type === 'group'
        ? groups.some(
            (group) => group.id === target.id && group.memberIds.length,
          )
        : target.type === 'user' &&
          people.some((person) => person.id === target.id))
    )
      return 'Selecione um grupo com participantes ou um usuário válido para cada campo.';
  }
  if (!t.stages.length) return 'Adicione pelo menos uma etapa ao fluxo.';
  if (
    t.stages.some(
      (s) =>
        !s.title.trim() ||
        !groups.find((g) => g.id === s.groupId && g.memberIds.length),
    )
  )
    return 'Cada etapa precisa de nome e de um grupo com participantes.';
  if (t.stages.some((s) => s.kind === 'fill' && !s.sectionIds.length))
    return 'Selecione ao menos uma seção em cada etapa de preenchimento.';
  if (
    t.sections.some(
      (s) =>
        !t.stages.some((e) => e.kind === 'fill' && e.sectionIds.includes(s.id)),
    )
  )
    return 'Todas as seções precisam estar em uma etapa de preenchimento.';
  return null;
}
export function validateStage(doc, values) {
  const stage = doc.template.stages[doc.stageIndex];
  if (stage.kind === 'approve') return null;
  for (const section of doc.template.sections.filter((s) =>
    stage.sectionIds.includes(s.id),
  )) {
    for (const field of section.fields) {
      const value = values[field.id];
      if (field.required && !hasFieldValue(field, value))
        return `Preencha o campo “${field.label}”.`;
      if (
        value &&
        field.type === 'signature' &&
        (typeof value !== 'object' ||
          !/^data:image\/(png|jpeg|webp);base64,/.test(value.data || ''))
      )
        return 'Use uma imagem PNG, JPEG ou WebP para a assinatura.';
      if (
        value &&
        field.type === 'number' &&
        (typeof value !== 'string' || !Number.isFinite(Number(value)))
      )
        return `Informe um número válido em “${field.label}”.`;
      if (
        value &&
        field.type === 'select' &&
        (typeof value !== 'string' || !field.options.includes(value))
      )
        return `Escolha uma opção válida em “${field.label}”.`;
      if (
        value &&
        field.type === 'date' &&
        (typeof value !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(value)))
      )
        return `Informe uma data válida em “${field.label}”.`;
    }
  }
  return null;
}
export function hasFieldValue(field, value) {
  if (!value) return false;
  if (typeof value !== 'string') return !!value.data;
  if (field.type === 'richtext')
    return (
      /<img\b/i.test(value) ||
      !!value
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;|&#160;/g, ' ')
        .trim()
    );
  return !!value.trim();
}
export function transition(
  doc,
  person,
  groups,
  action,
  values = doc.values,
  reason = '',
) {
  const contribution = action === 'save' && canContribute(doc, person, groups);
  if (!contribution && !canWork(doc, person, groups))
    throw Error(
      'Esta etapa pertence a outro grupo. Troque o participante para continuar.',
    );
  if (!contribution && doc.assignee && doc.assignee !== person.id)
    throw Error('Esta etapa já foi assumida por outro participante.');
  if (!contribution && action !== 'claim' && doc.assignee !== person.id)
    throw Error('Assuma esta etapa antes de continuar.');
  const d = structuredClone(doc);
  d.updatedAt = timestamp();
  if (action === 'claim') {
    d.assignee = person.id;
    d.history.push(
      log(
        person.name,
        'Assumiu a etapa: ' + d.template.stages[d.stageIndex].title,
        { kind: 'claimed', stageId: d.template.stages[d.stageIndex].id },
      ),
    );
    return d;
  }
  const stage = d.template.stages[d.stageIndex];
  const editable = new Set(
    d.template.sections
      .filter((s) => stage.kind === 'fill' && stage.sectionIds.includes(s.id))
      .flatMap((s) =>
        s.fields
          .filter((f) => canEditField(doc, f, person, groups))
          .map((f) => f.id),
      ),
  );
  for (const [key, value] of Object.entries(values)) {
    if (editable.has(key)) d.values[key] = value;
  }
  if (action === 'save') {
    d.history.push(
      log(person.name, 'Salvou um rascunho.', {
        kind: 'saved',
        stageId: stage.id,
      }),
    );
    return d;
  }
  if (action === 'return') {
    if (d.stageIndex === 0)
      throw Error('A primeira etapa não tem etapa anterior.');
    if (!reason.trim()) throw Error('Explique o que precisa ser corrigido.');
    d.history.push(
      log(person.name, 'Devolveu para correção: ' + reason.trim(), {
        kind: 'returned',
        stageId: stage.id,
        toStageId: d.template.stages[d.stageIndex - 1].id,
      }),
    );
    d.stageIndex--;
    d.status = 'returned';
    d.assignee = null;
    return d;
  }
  const error = validateStage(d, d.values);
  if (error) throw Error(error);
  d.history.push(
    log(
      person.name,
      (stage.kind === 'approve' ? 'Aprovou' : 'Concluiu') +
        ' a etapa: ' +
        stage.title,
      {
        kind: 'completed',
        stageId: stage.id,
        toStageId: d.template.stages[d.stageIndex + 1]?.id,
      },
    ),
  );
  d.assignee = null;
  if (d.stageIndex === d.template.stages.length - 1) {
    d.status = 'done';
    d.history.push(
      log(person.name, 'Documento finalizado.', {
        kind: 'finished',
        stageId: stage.id,
      }),
    );
  } else {
    d.stageIndex++;
    d.status = 'active';
  }
  return d;
}
export function blankTemplate() {
  const section = uid();
  return {
    id: uid(),
    name: '',
    description: '',
    version: 1,
    sections: [
      {
        id: section,
        title: 'Informações gerais',
        fields: [
          {
            id: uid(),
            label: 'Descrição',
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
        id: uid(),
        title: 'Preenchimento',
        kind: 'fill',
        groupId: 'attendance',
        sectionIds: [section],
      },
    ],
  };
}
