'use client';
import UserSettings from '../configuracoes/index.js';
import {
  sessionRole,
  isEnabled,
  PLATFORM_KEY,
} from '../../programas/plataforma/access.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { useEffect, useState } from 'react';
import {
  Button,
  TextField,
  MenuItem,
  Avatar,
  AvatarGroup,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  LinearProgress,
  IconButton,
  Drawer,
  InputAdornment,
} from '@mui/material';
import {
  FileStack,
  LayoutDashboard,
  ChartNoAxesCombined,
  Inbox,
  Files,
  LayoutTemplate,
  Users,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Search,
  ChevronRight,
  GitBranch,
  Clock,
  CheckCircle2,
  LogOut,
  Menu,
  FileText,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { ThemeToggle } from '../../components/theme/theme.js';
import { Dashboards } from '../../programas/dashboard/dashboards.js';
import { defaultDashboardFilters } from '../../programas/dashboard/dashboard.js';
import { TemplateEditor } from '../../programas/modelos/template-editor.js';
import {
  DocumentView,
  Status,
  statusLabel,
  dateLabel,
} from '../../programas/documentos/document-view.js';
import {
  blankTemplate,
  createDocument,
  transition,
  canWork,
  canContribute,
  uid,
  log,
  timestamp,
} from '../../programas/documentos/domain.js';
import { readStore, writeStore } from '../../programas/documentos/storage.js';
const nav = [
  ['home', 'Visão geral', LayoutDashboard],
  ['dashboards', 'Dashboards', ChartNoAxesCombined],
  ['tasks', 'Minhas pendências', Inbox],
  ['documents', 'Documentos', Files],
  ['templates', 'Modelos', LayoutTemplate],
  ['groups', 'Grupos e pessoas', Users],
];
const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
const roleLabel = (p) =>
  p.role === 'admin'
    ? 'Administrador'
    : p.role === 'designer'
      ? 'Criador de modelos'
      : 'Participante';
export default function Workspace() {
  return <WorkspaceInner />;
}
function WorkspaceInner() {
  const { t: tr, locale, system } = useI18n();
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dirty, setDirty] = useState(false);
  const mayLeave = () =>
    !dirty ||
    window.confirm(
      tr('Você tem alterações não salvas. Deseja sair e descartá-las?'),
    );
  const [actorId, setActorId] = useState('admin');
  const [view, setView] = useState('home');
  const [dashboardFilters, setDashboardFilters] = useState(
    defaultDashboardFilters,
  );
  const [documentId, setDocumentId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [groupEdit, setGroupEdit] = useState(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personRole, setPersonRole] = useState('participant');
  useEffect(() => {
    try {
      if (sessionRole() !== 'company') {
        window.location.replace(
          sessionRole() === 'platform' ? '/plataforma' : '/login',
        );
        return;
      }
      const data = readStore();
      writeStore(data);
      setState(data);
      const saved = sessionStorage.getItem('argousdocs:actor');
      if (saved && isEnabled(saved) && data.people.some((p) => p.id === saved))
        setActorId(saved);
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);
  const commit = (next) => {
    try {
      if (sessionRole() !== 'company' || !isEnabled(actorId))
        throw Error(
          'Usuário desativado. Contate o administrador da plataforma.',
        );
      writeStore(next, state || undefined);
      setState(next);
      return true;
    } catch (e) {
      setToast({ text: e.message, error: true });
      return false;
    }
  };
  useEffect(() => {
    const prevent = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === PLATFORM_KEY) {
        setState((current) => (current ? { ...current } : current));
        if (sessionRole() !== 'company') window.location.replace('/login');
        else if (!isEnabled(actorId)) {
          setActorId('admin');
          sessionStorage.removeItem('argousdocs:actor');
          setEditor(null);
        }
      }
      if (e.key === 'argousdocs:workspace:v1')
        setToast({
          text: 'Os dados foram alterados em outra aba. Recarregue esta página antes de continuar.',
          error: true,
        });
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [actorId]);
  useEffect(() => {
    if (!state) return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    for (const tool of [
      {
        name: 'argousdocs_list_documents',
        description:
          'Lista os documentos salvos nesta demonstração local e seus status.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (input) => {
          if (!input || typeof input !== 'object' || Object.keys(input).length)
            throw Error('Use um objeto vazio.');
          return state.documents.map((d) => ({
            id: d.id,
            title: d.title,
            status: statusLabel(d),
          }));
        },
      },
      {
        name: 'argousdocs_open_document',
        description:
          'Abre um documento existente na ferramenta, sem modificar seu conteúdo.',
        inputSchema: {
          type: 'object',
          properties: { documentId: { type: 'string' } },
          required: ['documentId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const id = input?.documentId;
          if (
            typeof id !== 'string' ||
            !state.documents.some((d) => d.id === id)
          )
            throw Error('Documento não encontrado.');
          setDocumentId(id);
          setEditor(null);
          setView('documents');
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          return { id, opened: true };
        },
      },
    ]) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, [state]);
  if (!state)
    return (
      <main className="loading-app">
        {loadError ? (
          <Alert severity="error">{system(loadError)}</Alert>
        ) : (
          <>
            <FileStack size={32} />
            <p>{tr('Abrindo seu espaço de trabalho…')}</p>
            <LinearProgress sx={{ width: 200 }} />
          </>
        )}
      </main>
    );
  const person = state.people.find((p) => p.id === actorId) || state.people[0];
  const admin = person.role === 'admin';
  const designer = admin || person.role === 'designer';
  const tasks = state.documents.filter(
    (d) =>
      (canWork(d, person, state.groups) &&
        (!d.assignee || d.assignee === person.id)) ||
      canContribute(d, person, state.groups),
  );
  const active = state.documents.filter((d) => d.status !== 'done');
  const done = state.documents.filter((d) => d.status === 'done');
  const reviews = active.filter(
    (d) => d.template.stages[d.stageIndex].kind === 'approve',
  );
  const doc = state.documents.find((d) => d.id === documentId);
  const navigate = (v) => {
    if (!mayLeave()) return;
    setView(v);
    setDocumentId(null);
    setEditor(null);
    setSearch('');
    setStatus('all');
    setModelFilter('all');
    setGroupFilter('all');
    setMobile(false);
  };
  const openNew = (templateId) => {
    setNewTemplate(
      templateId || state.templates.find((t) => !t.draft)?.id || '',
    );
    setNewTitle('');
    setNewOpen(true);
  };
  const create = () => {
    const t = state.templates.find((t) => t.id === newTemplate);
    if (!t) return;
    try {
      const d = createDocument(
        t,
        newTitle,
        state.documents.length,
        person.name,
      );
      if (commit({ ...state, documents: [d, ...state.documents] })) {
        setNewOpen(false);
        setDocumentId(d.id);
        setView('documents');
        setToast({
          text: 'Documento iniciado. O primeiro grupo já pode assumir a etapa.',
          error: false,
        });
      }
    } catch (e) {
      setToast({ text: e.message, error: true });
    }
  };
  const sidebar = (
    <div className="sidebar-inner">
      <div className="brand sidebar-brand" role="img" aria-label="ArgousDocs">
        <span className="brand-icon">
          <FileStack size={23} />
        </span>
        Argous<span>Docs</span>
      </div>
      <span className="nav-label">{tr('ESPAÇO DE TRABALHO')}</span>
      <nav className="side-nav">
        {nav
          .filter(([v]) => designer || !['templates', 'groups'].includes(v))
          .map(([v, label, Icon]) => (
            <button
              className={view === v ? 'active' : ''}
              key={v}
              onClick={() => navigate(v)}
            >
              <Icon size={19} />
              <span>{tr(label)}</span>
              {v === 'tasks' && tasks.length > 0 && <b>{tasks.length}</b>}
            </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-exit">
          <Button
            onClick={() => navigate('settings')}
            aria-label={tr('Configurações do usuário')}
            sx={{
              display: 'flex',
              gap: 1.25,
              textTransform: 'none',
              color: 'inherit',
              textAlign: 'left',
              justifyContent: 'flex-start',
              flex: 1,
              minWidth: 0,
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: 'action.selected',
                color: 'text.primary',
                fontSize: 13,
              }}
            >
              {initials(person.name)}
            </Avatar>
            <div>
              <strong>{person.name}</strong>
              <small>{tr(roleLabel(person))}</small>
            </div>
          </Button>
          <IconButton
            aria-label={tr('Sair')}
            onClick={() => {
              if (!mayLeave()) return;
              sessionStorage.removeItem('argousdocs:session');
              window.location.href = '/login';
            }}
          >
            <LogOut size={17} />
          </IconButton>
        </div>
      </div>
    </div>
  );
  let rows = view === 'tasks' ? tasks : state.documents;
  rows = rows.filter(
    (d) =>
      (!search ||
        `${d.title} ${d.code} ${d.template.name}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (status === 'all' ||
        (status === 'open' && d.status !== 'done') ||
        statusLabel(d) === status) &&
      (modelFilter === 'all' || d.template.id === modelFilter) &&
      (groupFilter === 'all' ||
        (d.status !== 'done' &&
          d.template.stages[d.stageIndex].groupId === groupFilter)),
  );
  const documentsTable = (items, compact = false) => (
    <TableContainer>
      <Table aria-label={tr('Lista de documentos')}>
        <TableHead>
          <TableRow>
            <TableCell>{tr('DOCUMENTO')}</TableCell>
            <TableCell>{tr('STATUS')}</TableCell>
            <TableCell>{tr('ETAPA ATUAL')}</TableCell>
            {!compact && <TableCell>{tr('COM QUEM ESTÁ')}</TableCell>}
            <TableCell>{tr('ATUALIZADO')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length ? (
            items.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>
                  <button
                    className="document-link"
                    onClick={() => {
                      setDocumentId(d.id);
                      setView('documents');
                    }}
                  >
                    <span
                      className={
                        'doc-icon ' + (d.status === 'done' ? 'green' : '')
                      }
                    >
                      <FileText size={19} />
                    </span>
                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        {d.code} · {d.template.name}
                      </small>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <Status doc={d} />
                </TableCell>
                <TableCell>
                  <span className="table-stage">
                    {d.status === 'done'
                      ? tr('Todas concluídas')
                      : d.template.stages[d.stageIndex].title}
                  </span>
                  <small className="table-step-count">
                    {d.status === 'done'
                      ? tr('Fluxo concluído')
                      : tr('Etapa {0} de {1}', {
                          0: d.stageIndex + 1,
                          1: d.template.stages.length,
                        })}
                  </small>
                  <div className="mini-steps">
                    {d.template.stages.map((s, i) => (
                      <span
                        key={s.id}
                        className={
                          d.status === 'done' || i <= d.stageIndex
                            ? 'filled'
                            : ''
                        }
                      />
                    ))}
                  </div>
                </TableCell>
                {!compact && (
                  <TableCell>
                    {d.status === 'done'
                      ? '—'
                      : state.people.find((p) => p.id === d.assignee)?.name ||
                        state.groups.find(
                          (g) =>
                            g.id === d.template.stages[d.stageIndex].groupId,
                        )?.name}
                  </TableCell>
                )}
                <TableCell>
                  <span className="muted">
                    {dateLabel(d.updatedAt, locale)}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    className="document-open-button"
                    onClick={() => {
                      setDocumentId(d.id);
                      setView('documents');
                    }}
                    endIcon={<ChevronRight size={16} />}
                  >
                    {d.status === 'done'
                      ? tr('Ver documento')
                      : (canWork(d, person, state.groups) &&
                            (!d.assignee || d.assignee === person.id)) ||
                          canContribute(d, person, state.groups)
                        ? tr('Continuar')
                        : tr('Acompanhar')}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={compact ? 5 : 6}>
                <div className="empty-state">
                  <Inbox size={30} />
                  <h3>
                    {view === 'tasks'
                      ? tr('Nenhuma pendência por aqui')
                      : tr('Nenhum documento encontrado')}
                  </h3>
                  <p>
                    {view === 'tasks'
                      ? tr(
                          'Quando uma etapa chegar ao seu grupo, ela aparecerá aqui.',
                        )
                      : tr('Ajuste os filtros ou inicie um novo documento.')}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">{sidebar}</aside>
      <Drawer
        open={mobile}
        onClose={() => setMobile(false)}
        slotProps={{ paper: { sx: { width: 255 } } }}
      >
        {sidebar}
      </Drawer>
      <div className="app-body">
        <header className="topbar no-print">
          <div className="breadcrumbs">
            <IconButton
              className="mobile-menu"
              aria-label={tr('Abrir navegação')}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </IconButton>
            <span>{tr('Empresa de teste')}</span>
            <ChevronRight size={14} />
            <strong>
              {tr(
                view === 'settings'
                  ? 'Configurações do usuário'
                  : nav.find((n) => n[0] === view)?.[1] || '',
              )}
            </strong>
          </div>
          <div className="participant-picker">
            <ThemeToggle />
          </div>
        </header>
        <main className="workspace-main">
          {editor && designer ? (
            <TemplateEditor
              key={editor.id}
              initial={editor}
              people={state.people}
              groups={state.groups}
              onDirtyChange={setDirty}
              onClose={() => {
                if (mayLeave()) setEditor(null);
              }}
              onSave={(t, startDocument = false) => {
                const existing = state.templates.find((x) => x.id === t.id);
                const saved = {
                  ...t,
                  name: t.name.trim() || tr('Modelo sem título'),
                  version: existing ? existing.version + 1 : 1,
                  sections: t.sections.map((s) => ({
                    ...s,
                    fields: s.fields.map((f) => ({
                      ...f,
                      options: [
                        ...new Set(
                          f.options.map((o) => o.trim()).filter(Boolean),
                        ),
                      ],
                    })),
                  })),
                };
                const created = startDocument
                  ? createDocument(
                      saved,
                      saved.name,
                      state.documents.length,
                      person.name,
                    )
                  : null;
                if (
                  commit({
                    ...state,
                    documents: created
                      ? [...state.documents, created]
                      : state.documents,
                    templates: existing
                      ? state.templates.map((x) => (x.id === t.id ? saved : x))
                      : [...state.templates, saved],
                  })
                ) {
                  setEditor(null);
                  if (created) {
                    setDocumentId(created.id);
                    setView('documents');
                  }
                  setToast({
                    text: saved.draft
                      ? 'Rascunho salvo. Continue a edição em Modelos.'
                      : 'Modelo salvo. Novos documentos usarão esta versão.',
                    error: false,
                  });
                }
              }}
            />
          ) : doc ? (
            <DocumentView
              key={
                doc.id +
                ':' +
                doc.stageIndex +
                ':' +
                doc.status +
                ':' +
                person.id
              }
              doc={doc}
              onDirtyChange={setDirty}
              onSwitchPerson={(id) => {
                if (!mayLeave() || !state.people.some((p) => p.id === id))
                  return;
                setActorId(id);
                sessionStorage.setItem('argousdocs:actor', id);
              }}
              person={person}
              people={state.people}
              groups={state.groups}
              onBack={() => {
                if (mayLeave()) setDocumentId(null);
              }}
              onAction={(action, values, reason) => {
                try {
                  const updated = transition(
                    doc,
                    person,
                    state.groups,
                    action,
                    values,
                    reason,
                  );
                  if (
                    !commit({
                      ...state,
                      documents: state.documents.map((d) =>
                        d.id === doc.id ? updated : d,
                      ),
                    })
                  )
                    return false;
                  setToast({
                    text:
                      action === 'claim'
                        ? 'Etapa assumida.'
                        : action === 'save'
                          ? 'Rascunho salvo.'
                          : action === 'return'
                            ? 'Documento devolvido para correção.'
                            : updated.status === 'done'
                              ? 'Documento finalizado com sucesso.'
                              : 'Etapa concluída. Documento encaminhado ao próximo grupo.',
                    error: false,
                  });
                  return true;
                } catch (e) {
                  setToast({ text: e.message, error: true });
                  return false;
                }
              }}
            />
          ) : (
            <>
              {view === 'settings' && (
                <>
                  <div className="page-heading">
                    <h1>{tr('Configurações do usuário')}</h1>
                    <Button variant="outlined" onClick={() => navigate('home')}>
                      {tr('Visão geral')}
                    </Button>
                  </div>
                  <UserSettings />
                </>
              )}
              {view === 'dashboards' && (
                <Dashboards
                  store={state}
                  filters={dashboardFilters}
                  onFilters={setDashboardFilters}
                  onOpenDocument={(id) => setDocumentId(id)}
                />
              )}
              {view === 'home' && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {tr('SEU ESPAÇO DE TRABALHO')}
                      </span>
                      <h1>
                        {tr('Olá,')}
                        {person.name.split(' ')[0]}{' '}
                        <span className="greeting-dot">.</span>
                      </h1>
                      <p>
                        {tr('Uma visão clara de tudo que está em movimento.')}
                      </p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={18} />}
                      onClick={() => openNew()}
                    >
                      {tr('Novo documento')}
                    </Button>
                  </div>
                  <div className="stats-grid">
                    {[
                      [
                        Files,
                        'Em andamento',
                        active.length,
                        tr('Documentos em fluxo'),
                        'active',
                      ],
                      [
                        Inbox,
                        tr('Minhas pendências'),
                        tasks.length,
                        tr('Etapas para o seu grupo'),
                        'tasks',
                      ],
                      [
                        Clock,
                        'Em aprovação',
                        reviews.length,
                        tr('Aguardando revisão'),
                        'reviews',
                      ],
                      [
                        CheckCircle2,
                        tr('Finalizados'),
                        done.length,
                        tr('Documentos completos'),
                        'done',
                      ],
                    ].map(([Icon, title, count, sub, key]) => (
                      <button
                        className={'stat-card ' + key}
                        key={key}
                        onClick={() => {
                          navigate(key === 'tasks' ? 'tasks' : 'documents');
                          if (key === 'reviews') setStatus('Em aprovação');
                          if (key === 'done') setStatus('Finalizado');
                          if (key === 'active') setStatus('open');
                        }}
                      >
                        <div className="stat-top">
                          <span>{tr(title)}</span>
                          <Icon size={19} />
                        </div>
                        <strong>{count.toString().padStart(2, '0')}</strong>
                        <small>{sub}</small>
                      </button>
                    ))}
                  </div>
                  <div className="home-columns">
                    <section className="panel attention-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{tr('Seu próximo passo')}</h2>
                          <p>{tr('As etapas que precisam de você.')}</p>
                        </div>
                        <Button
                          onClick={() => navigate('tasks')}
                          endIcon={<ArrowUpRight size={16} />}
                        >
                          {tr('Ver pendências')}
                        </Button>
                      </div>
                      {tasks.length ? (
                        tasks.slice(0, 2).map((d) => (
                          <button
                            className="task-preview"
                            key={d.id}
                            onClick={() => {
                              setDocumentId(d.id);
                              setView('tasks');
                            }}
                          >
                            <span className="task-preview-icon">
                              <FileText size={22} />
                            </span>
                            <span className="task-preview-copy">
                              <strong>{d.title}</strong>
                              <small>
                                {d.template.stages[d.stageIndex].title} ·{' '}
                                {
                                  state.groups.find(
                                    (g) =>
                                      g.id ===
                                      d.template.stages[d.stageIndex].groupId,
                                  )?.name
                                }
                              </small>
                            </span>
                            <Status doc={d} />
                            <ArrowRight size={18} />
                          </button>
                        ))
                      ) : (
                        <div className="empty-state compact">
                          <CheckCircle2 size={25} />
                          <h3>{tr('Tudo em dia')}</h3>
                          <p>{tr('Seu grupo não tem etapas pendentes.')}</p>
                        </div>
                      )}
                    </section>
                    <section className="quick-start">
                      <div className="quick-start-top">
                        <LayoutTemplate size={25} />
                        <span>{tr('DO MODELO À AÇÃO')}</span>
                      </div>
                      <h2>
                        {tr('Um bom documento')}
                        <br />
                        {tr('começa com um modelo.')}
                      </h2>
                      <p>
                        {tr(
                          'Use o relatório de atendimento para experimentar um fluxo completo.',
                        )}
                      </p>
                      <Button
                        variant="contained"
                        color="inherit"
                        endIcon={<ArrowUpRight size={17} />}
                        onClick={() => openNew()}
                      >
                        {tr('Usar um modelo')}
                      </Button>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{tr('Documentos recentes')}</h2>
                        <p>
                          {tr('Acompanhe as últimas movimentações da equipe.')}
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate('documents')}
                        endIcon={<ArrowRight size={16} />}
                      >
                        {tr('Ver todos')}
                      </Button>
                    </div>
                    {documentsTable(
                      [...state.documents]
                        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                        .slice(0, 5),
                      true,
                    )}
                    <div className="table-footer">
                      {state.documents.length}{' '}
                      {' ' + tr('documentos no espaço de trabalho')}{' '}
                      <span>
                        <span className="dot" /> {tr('Dados de demonstração')}
                      </span>
                    </div>
                  </section>
                </>
              )}
              {(view === 'documents' || view === 'tasks') && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {view === 'tasks'
                          ? tr('O TRABALHO CHEGA ATÉ VOCÊ')
                          : tr('DO INÍCIO À FINALIZAÇÃO')}
                      </span>
                      <h1>
                        {view === 'tasks'
                          ? tr('Minhas pendências')
                          : tr('Documentos')}
                      </h1>
                      <p>
                        {view === 'tasks'
                          ? tr(
                              'Etapas disponíveis ou atribuídas a você nos seus grupos.',
                            )
                          : tr(
                              'Encontre, acompanhe e continue os documentos da equipe.',
                            )}
                      </p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={18} />}
                      onClick={() => openNew()}
                    >
                      {tr('Novo documento')}
                    </Button>
                  </div>
                  <section className="panel">
                    <div className="document-filters">
                      <TextField
                        placeholder={tr('Buscar documento…')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search size={18} />
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { 'aria-label': tr('Buscar documento') },
                        }}
                      />
                      <TextField
                        select
                        label={tr('Status')}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <MenuItem value="all">{tr('Todos os status')}</MenuItem>
                        <MenuItem value="open">{tr('Todos em fluxo')}</MenuItem>
                        {[
                          'Em andamento',
                          'Em aprovação',
                          'Em correção',
                          'Finalizado',
                        ].map((s) => (
                          <MenuItem value={s} key={s}>
                            {tr(s)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label={tr('Modelo')}
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                      >
                        <MenuItem value="all">
                          {tr('Todos os modelos')}
                        </MenuItem>
                        {state.templates.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label={tr('Grupo')}
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                      >
                        <MenuItem value="all">{tr('Todos os grupos')}</MenuItem>
                        {state.groups.map((g) => (
                          <MenuItem key={g.id} value={g.id}>
                            {g.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </div>
                    {documentsTable(rows)}
                    <div className="table-footer">
                      {rows.length} {tr('documentos encontrados')}
                      <Button
                        size="small"
                        onClick={() => {
                          setSearch('');
                          setStatus('all');
                          setModelFilter('all');
                          setGroupFilter('all');
                        }}
                      >
                        {tr('Limpar filtros')}
                      </Button>
                    </div>
                  </section>
                </>
              )}
              {view === 'templates' && designer && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {tr('ESTRUTURA PARA REPETIR O QUE FUNCIONA')}
                      </span>
                      <h1>{tr('Modelos de documento')}</h1>
                      <p>
                        {tr(
                          'Crie a estrutura uma vez. Use em cada novo documento.',
                        )}
                      </p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={18} />}
                      onClick={() => setEditor(blankTemplate())}
                    >
                      {tr('Criar modelo')}
                    </Button>
                  </div>
                  <div className="template-grid">
                    {state.templates.map((t) => (
                      <article className="panel template-card" key={t.id}>
                        <div className="template-card-top">
                          <span className="template-icon">
                            <LayoutTemplate size={25} />
                          </span>
                          <Chip
                            label={'' + tr('Versão') + ' ' + t.version}
                            variant="outlined"
                            size="small"
                          />
                        </div>
                        <h2>{t.name}</h2>
                        {t.draft && (
                          <Chip
                            label={tr('Rascunho')}
                            color="warning"
                            size="small"
                          />
                        )}
                        <p>
                          {t.description ||
                            tr('Modelo de documento estruturado.')}
                        </p>
                        <div className="template-stats">
                          <span>
                            <Files size={15} />
                            {t.sections.length} {tr('seções')}
                          </span>
                          <span>
                            <GitBranch size={15} />
                            {t.stages.length} {tr('etapas')}
                          </span>
                          <span>
                            {t.sections.reduce(
                              (n, s) => n + s.fields.length,
                              0,
                            )}{' '}
                            {tr('campos')}
                          </span>
                        </div>
                        <div className="template-flow">
                          {t.stages.map((s, i) => (
                            <span key={s.id}>
                              {i > 0 && <ChevronRight size={13} />}
                              <span>
                                {
                                  state.groups.find((g) => g.id === s.groupId)
                                    ?.name
                                }
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="template-actions">
                          <Button
                            variant="outlined"
                            onClick={() => setEditor(t)}
                            startIcon={<Settings2 size={16} />}
                          >
                            {tr(t.draft ? 'Continuar edição' : 'Editar modelo')}
                          </Button>
                          <Button
                            variant="contained"
                            disabled={!!t.draft}
                            onClick={() => openNew(t.id)}
                          >
                            {tr('Usar modelo')}
                          </Button>
                        </div>
                      </article>
                    ))}
                    <button
                      className="new-template-card"
                      onClick={() => setEditor(blankTemplate())}
                    >
                      <Plus size={28} />
                      <strong>{tr('Seu próximo modelo')}</strong>
                      <span>{tr('Comece com uma estrutura em branco.')}</span>
                    </button>
                  </div>
                  <Alert severity="info" sx={{ mt: 3 }}>
                    {tr(
                      'Cada documento guarda uma cópia do modelo. Editar um modelo não altera documentos em andamento ou finalizados.',
                    )}
                  </Alert>
                </>
              )}
              {view === 'groups' && designer && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        {tr('PESSOAS CERTAS, ETAPAS CLARAS')}
                      </span>
                      <h1>{tr('Grupos e pessoas')}</h1>
                      <p>
                        {tr('Organize quem participa de cada parte do fluxo.')}
                      </p>
                    </div>
                    {admin && (
                      <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() =>
                          setGroupEdit({
                            id: uid(),
                            name: '',
                            description: '',
                            memberIds: [],
                          })
                        }
                      >
                        {tr('Criar grupo')}
                      </Button>
                    )}
                  </div>
                  <div className="group-grid">
                    {state.groups.map((g) => (
                      <article className="panel group-card" key={g.id}>
                        <div className="template-card-top">
                          <span className="template-icon">
                            <Users size={24} />
                          </span>
                          {admin && (
                            <IconButton
                              aria-label={
                                '' + tr('Editar grupo') + ' ' + g.name
                              }
                              onClick={() => setGroupEdit(structuredClone(g))}
                            >
                              <Settings2 size={18} />
                            </IconButton>
                          )}
                        </div>
                        <h2>{g.name}</h2>
                        <p>{g.description}</p>
                        <div className="group-members">
                          <AvatarGroup max={4}>
                            {g.memberIds.map((id) => {
                              const p = state.people.find((p) => p.id === id);
                              return p ? (
                                <Avatar
                                  key={id}
                                  title={p.name}
                                  sx={{
                                    width: 33,
                                    height: 33,
                                    fontSize: 12,
                                    bgcolor: 'action.selected',
                                    color: 'text.primary',
                                  }}
                                >
                                  {initials(p.name)}
                                </Avatar>
                              ) : null;
                            })}
                          </AvatarGroup>
                          <span>
                            {g.memberIds.length} {tr('participantes')}
                          </span>
                        </div>
                        <div className="group-names">
                          {g.memberIds
                            .map(
                              (id) =>
                                state.people.find((p) => p.id === id)?.name,
                            )
                            .join(', ') || tr('Nenhum participante')}
                        </div>
                      </article>
                    ))}
                  </div>
                  <section className="panel people-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{tr('Pessoas do espaço de trabalho')}</h2>
                        <p>{tr('Perfis disponíveis na demonstração.')}</p>
                      </div>
                      {admin && (
                        <Button
                          startIcon={<UserPlus size={17} />}
                          onClick={() => {
                            setPersonName('');
                            setPersonRole('participant');
                            setPersonOpen(true);
                          }}
                        >
                          {tr('Adicionar pessoa')}
                        </Button>
                      )}
                    </div>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>{tr('PESSOA')}</TableCell>
                            <TableCell>{tr('PERFIL')}</TableCell>
                            <TableCell>{tr('GRUPOS')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {state.people.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <div className="person-name">
                                  <Avatar
                                    sx={{
                                      width: 31,
                                      height: 31,
                                      fontSize: 12,
                                      bgcolor: 'action.selected',
                                      color: 'text.primary',
                                    }}
                                  >
                                    {initials(p.name)}
                                  </Avatar>
                                  <strong>{p.name}</strong>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={tr(roleLabel(p))}
                                />
                              </TableCell>
                              <TableCell>
                                {state.groups
                                  .filter((g) => g.memberIds.includes(p.id))
                                  .map((g) => g.name)
                                  .join(', ') || tr('Sem grupo')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </section>
                </>
              )}
            </>
          )}
          <div className="workspace-footer no-print">
            <span>ArgousDocs</span>
            <span>
              {tr('Ambiente local de demonstração · Salvo neste navegador')}
            </span>
          </div>
        </main>
      </div>
      <Dialog open={newOpen} onClose={() => setNewOpen(false)}>
        <DialogTitle>{tr('Novo documento')}</DialogTitle>
        <DialogContent>
          {designer && (
            <Button
              variant="outlined"
              onClick={() => {
                setNewOpen(false);
                setEditor(blankTemplate());
              }}
            >
              {tr('Criar no editor ou importar modelo')}
            </Button>
          )}
          <p className="muted">
            {tr(
              'Escolha um modelo para começar. O fluxo e os campos já estarão preparados.',
            )}
          </p>
          <div className="dialog-fields">
            <TextField
              select
              label={tr('Modelo de documento')}
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
            >
              {state.templates
                .filter((t) => !t.draft)
                .map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name} · v{t.version}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              autoFocus
              label={tr('Título do documento')}
              placeholder={tr('Ex.: Manutenção • Empresa Horizonte')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <div className="dialog-flow">
              {state.templates
                .find((t) => t.id === newTemplate)
                ?.stages.map((s, i) => (
                  <div key={s.id}>
                    <span className="step-number">{i + 1}</span>
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {state.groups.find((g) => g.id === s.groupId)?.name}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)}>{tr('Cancelar')}</Button>
          <Button
            variant="contained"
            disabled={!newTitle.trim() || !newTemplate}
            endIcon={<ArrowRight size={17} />}
            onClick={create}
          >
            {tr('Iniciar documento')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={!!groupEdit} onClose={() => setGroupEdit(null)}>
        <DialogTitle>
          {state.groups.some((g) => g.id === groupEdit?.id)
            ? tr('Editar grupo')
            : tr('Novo grupo')}
        </DialogTitle>
        <DialogContent>
          {groupEdit && (
            <div className="dialog-fields">
              <TextField
                label={tr('Nome do grupo')}
                autoFocus
                value={groupEdit.name}
                onChange={(e) =>
                  setGroupEdit({ ...groupEdit, name: e.target.value })
                }
              />
              <TextField
                label={tr('Descrição')}
                value={groupEdit.description}
                onChange={(e) =>
                  setGroupEdit({ ...groupEdit, description: e.target.value })
                }
              />
              <div>
                <p className="field-label">{tr('Participantes')}</p>
                {state.people.map((p) => (
                  <FormControlLabel
                    key={p.id}
                    label={p.name}
                    control={
                      <Checkbox
                        checked={groupEdit.memberIds.includes(p.id)}
                        onChange={(e) =>
                          setGroupEdit({
                            ...groupEdit,
                            memberIds: e.target.checked
                              ? [...groupEdit.memberIds, p.id]
                              : groupEdit.memberIds.filter((id) => id !== p.id),
                          })
                        }
                      />
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupEdit(null)}>{tr('Cancelar')}</Button>
          <Button
            variant="contained"
            disabled={!groupEdit?.name.trim() || !groupEdit.memberIds.length}
            onClick={() => {
              if (!groupEdit || !admin) return;
              const g = { ...groupEdit, name: groupEdit.name.trim() };
              if (
                state.groups.some(
                  (x) =>
                    x.id !== g.id &&
                    x.name.toLowerCase() === g.name.toLowerCase(),
                )
              ) {
                setToast({
                  text: 'Já existe um grupo com esse nome.',
                  error: true,
                });
                return;
              }
              const updatedDocs = state.documents.map((d) =>
                d.status !== 'done' &&
                d.template.stages[d.stageIndex].groupId === g.id &&
                d.assignee &&
                !g.memberIds.includes(d.assignee)
                  ? {
                      ...d,
                      assignee: null,
                      updatedAt: timestamp(),
                      history: [
                        ...d.history,
                        log(
                          person.name,
                          'Reabriu a atribuição da etapa após alterar os participantes do grupo.',
                          {
                            kind: 'unassigned',
                            stageId: d.template.stages[d.stageIndex].id,
                          },
                        ),
                      ],
                    }
                  : d,
              );
              if (
                commit({
                  ...state,
                  documents: updatedDocs,
                  groups: state.groups.some((x) => x.id === g.id)
                    ? state.groups.map((x) => (x.id === g.id ? g : x))
                    : [...state.groups, g],
                })
              ) {
                setGroupEdit(null);
                setToast({ text: 'Grupo salvo.', error: false });
              }
            }}
          >
            {tr('Salvar grupo')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={personOpen} onClose={() => setPersonOpen(false)}>
        <DialogTitle>{tr('Adicionar pessoa de demonstração')}</DialogTitle>
        <DialogContent>
          <p className="muted">
            {tr(
              'A pessoa ficará disponível na troca de participante. Depois, adicione-a a um grupo.',
            )}
          </p>
          <div className="dialog-fields">
            <TextField
              label={tr('Nome')}
              autoFocus
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
            />
            <TextField
              select
              label={tr('Perfil')}
              value={personRole}
              onChange={(e) => setPersonRole(e.target.value)}
            >
              <MenuItem value="participant">{tr('Participante')}</MenuItem>
              <MenuItem value="designer">{tr('Criador de modelos')}</MenuItem>
              <MenuItem value="admin">{tr('Administrador')}</MenuItem>
            </TextField>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPersonOpen(false)}>{tr('Cancelar')}</Button>
          <Button
            variant="contained"
            disabled={!personName.trim()}
            onClick={() => {
              if (!admin) return;
              if (
                commit({
                  ...state,
                  people: [
                    ...state.people,
                    { id: uid(), name: personName.trim(), role: personRole },
                  ],
                })
              ) {
                setPersonOpen(false);
                setToast({
                  text: 'Pessoa adicionada à demonstração.',
                  error: false,
                });
              }
            }}
          >
            {tr('Adicionar pessoa')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.error ? null : 4500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.error ? 'error' : 'success'}
          onClose={() => setToast(null)}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {system(toast?.text || '')}
        </Alert>
      </Snackbar>
    </div>
  );
}
