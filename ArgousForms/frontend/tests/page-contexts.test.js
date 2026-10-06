import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { JSDOM } from 'jsdom';
register('./helpers/jsx-loader.js', import.meta.url);
const browser = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
globalThis.window = browser.window;
globalThis.document = browser.window.document;
globalThis.localStorage = browser.window.localStorage;
globalThis.sessionStorage = browser.window.sessionStorage;
const render = (element) =>
  renderToString(
    createElement(
      CacheProvider,
      { value: createCache({ key: 'test' }) },
      element,
    ),
  );
const { default: Workspace, WorkspaceContext } =
  await import('../src/interface/argous/workspace.js');
const { default: Platform, PlatformContext } =
  await import('../src/interface/plataforma/index.js');
const { default: Login } = await import('../src/interface/login/index.js');
const { TemplateEditor } =
  await import('../src/programas/modelos/template-editor.js');
const { DocumentView, DocumentViewContext } =
  await import('../src/programas/documentos/document-view.js');
const { ProcessFlow } =
  await import('../src/programas/documentos/process-flow.js');
const { Dashboards } = await import('../src/programas/dashboard/dashboards.js');
const { default: PlatformUsers } =
  await import('../src/interface/plataforma/users.js');
const { createDocument } =
  await import('../src/programas/documentos/domain.js');
const { stageTimings } =
  await import('../src/programas/documentos/stage-timing.js');
const { defaultDashboardFilters } =
  await import('../src/programas/dashboard/dashboard.js');
const person = { id: 'admin', name: 'Administrador', role: 'admin' };
const template = {
  id: 'modelo',
  name: 'Modelo de teste',
  version: 1,
  sections: [
    {
      id: 'dados',
      title: 'Dados',
      fields: [
        {
          id: 'nome',
          label: 'Nome',
          type: 'text',
          required: true,
          options: [],
        },
      ],
    },
  ],
  stages: [
    {
      id: 'preencher',
      title: 'Preencher',
      kind: 'fill',
      groupId: 'grupo',
      sectionIds: ['dados'],
    },
  ],
  layout: {
    kind: 'pdf',
    assetId: 'arquivo-do-teste',
    name: 'Modelo.pdf',
    pages: [{ width: 595, height: 842 }],
    placements: [],
  },
};
const doc = {
  ...createDocument(template, 'Documento de teste', 0, person.name),
  assignee: person.id,
};
const store = {
  schema: 1,
  people: [person],
  groups: [{ id: 'grupo', name: 'Grupo', memberIds: [person.id] }],
  templates: [template],
  documents: [doc],
};
const noop = () => {};
const workspace = {
  value: {
    state: store,
    editor: template,
    documentId: doc.id,
    actorId: person.id,
    dashboardFilters: defaultDashboardFilters,
  },
  dispatch: noop,
  onDirtyChange: noop,
  saveTemplate: noop,
  closeTemplate: noop,
  performDocumentAction: noop,
  closeDocument: noop,
  switchPerson: noop,
  openDocument: noop,
};
const renderInWorkspace = (Component) =>
  render(
    createElement(
      WorkspaceContext.Provider,
      { value: workspace },
      createElement(Component),
    ),
  );

test('telas principais inicializam sem executar filtros como função', () => {
  assert.match(
    render(createElement(Workspace)),
    /Abrindo seu espaço de trabalho/,
  );
  const platform = render(createElement(Platform));
  assert.match(platform, /Administração da plataforma/);
  assert.doesNotMatch(platform, /Base de conhecimento|Frontend|Backend/);
  assert.match(render(createElement(Login)), /Vamos continuar/);
});

test('editor visual e documento recebem os dados exclusivamente do contexto do workspace', () => {
  assert.match(renderInWorkspace(TemplateEditor), /Prefira PDF/);
  assert.match(renderInWorkspace(DocumentView), /Documento de teste/);
});

test('dashboard e histórico recebem filtros, documento e seleção por contexto', () => {
  assert.match(renderInWorkspace(Dashboards), /Dashboards/);
  const value = {
    doc,
    groups: store.groups,
    people: store.people,
    historyStage: 'preencher',
    historyNow: Date.now(),
    analysis: stageTimings(doc),
  };
  const html = render(
    createElement(
      DocumentViewContext.Provider,
      { value: { value, dispatch: noop, selectHistoryStage: noop } },
      createElement(ProcessFlow),
    ),
  );
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /O caminho deste documento/);
  assert.match(html, /Preencher/);
});

test('lista administrativa mostra somente contas da plataforma e exclui participantes das empresas', () => {
  const html = render(
    createElement(
      PlatformContext.Provider,
      {
        value: {
          value: { workspace: store, data: { disabledIds: [] } },
          refresh: noop,
        },
      },
      createElement(PlatformUsers),
    ),
  );
  assert.match(html, /Administrador/);
  assert.match(html, /adm@argous.com.br/);
  assert.doesNotMatch(html, /Empresa de teste/);
  assert.doesNotMatch(html, />Administrador</);
});

test('cadastro empresarial consulta dados sem campos editáveis ou informações inventadas', async () => {
  const { ClientsContext, CompanyDetails } =
    await import('../src/interface/plataforma/clients.js');
  const client = { id: 'test-company', name: 'Empresa de teste', users: 1 };
  const html = render(
    createElement(
      ClientsContext.Provider,
      {
        value: { value: { client }, dispatch: noop },
      },
      createElement(CompanyDetails),
    ),
  );
  assert.match(html, /Cadastro da empresa/);
  assert.match(html, /Razão social/);
  assert.match(html, /CNPJ/);
  assert.equal((html.match(/placeholder="Não informado"/g) || []).length, 7);
  const page = new browser.window.DOMParser().parseFromString(
    html,
    'text/html',
  );
  const fields = [
    ...page.querySelectorAll('input, textarea:not([aria-hidden="true"])'),
  ];
  assert.equal(fields.length, 8);
  assert.ok(fields.every((field) => field.readOnly));
  assert.doesNotMatch(html, /Salvar|Editar|teste@argous.com.br/);
});
