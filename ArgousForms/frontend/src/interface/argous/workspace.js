'use client';
import { pageReducer } from '../../utils/page-state.js';
import UserSettings from '../configuracoes/index.js';
import ForcaSenha from '../../components/acesso/forca-senha.js';
import { avaliarSenha } from '../../programas/login/politica-senha.js';
import {
  sessionRole,
  isEnabled,
  PLATFORM_KEY,
  SESSION_KEY,
  isLocalSession,
} from '../../programas/plataforma/access.js';
import { executar, sair, sessaoAtual } from '../../programas/login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  useEffect,
  createContext,
  useMemo,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  MenuItem,
  Menu as MuiMenu,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tab,
  Tabs,
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
} from '../../programas/documentos/domain.js';
import { readStore, writeStore } from '../../programas/documentos/storage.js';
export const WorkspaceContext = createContext({});
const nav = [
  ['home', 'Visão geral', LayoutDashboard],
  ['dashboards', 'Dashboards', ChartNoAxesCombined],
  ['documents', 'Documentos', Files],
  ['templates', 'Modelos', LayoutTemplate],
  ['organization', 'Organização e acessos', Users],
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
const profilePriority = ['ADMINISTRADOR', 'GESTOR', 'MODELADOR', 'PARTICIPANTE', 'ESSENCIAL'];
const profileSummary = (profiles) => {
  if (!profiles?.length) return 'Sem perfil';
  const sorted = [...profiles].sort((a, b) => {
    const first = profilePriority.indexOf(a);
    const second = profilePriority.indexOf(b);
    return (first < 0 ? profilePriority.length : first) -
      (second < 0 ? profilePriority.length : second) || a.localeCompare(b);
  });
  const main = sorted[0].toLocaleLowerCase('pt-BR');
  const label = main.charAt(0).toLocaleUpperCase('pt-BR') + main.slice(1);
  return sorted.length === 1 ? sorted[0] : `${label} + ${sorted.length - 1}`;
};
export default function Workspace() {
  const initialState = useMemo(
    () => ({
      telaAtual: 'Workspace',
      loading: false,
      state: null,
      usuario: null,
      loadError: '',
      dirty: false,
      actorId: 'admin',
      view: 'home',
      managementSection: 'groups',
      dashboardFilters: { ...defaultDashboardFilters },
      documentId: null,
      editor: null,
      mobile: false,
      search: '',
      status: 'all',
      modelFilter: 'all',
      groupFilter: 'all',
      toast: null,
      newOpen: false,
      newTemplate: '',
      newTitle: '',
      groupEdit: null,
      tagEdit: null,
      organizacao: null,
      organizacaoLoading: false,
      organizacaoError: '',
      organizacaoSaving: false,
      acessos: null,
      acessosLoading: false,
      acessosError: '',
      acessosSaving: false,
      pessoasUsuarios: null,
      pessoasUsuariosLoading: false,
      pessoasUsuariosError: '',
      papelEdit: null,
      perfilEdit: null,
      remocaoAcesso: null,
      personOpen: false,
      personName: '',
      personRole: 'participant',
      menuPessoalAnchor: null,
      senhaDialog: false,
      senhaAtual: '',
      senhaNova: '',
      senhaConfirmacao: '',
      senhaSaving: false,
      senhaError: '',
      conexoesDialog: false,
      conexoes: [],
      conexoesLoading: false,
      conexoesError: '',
      conexaoParaEncerrar: null,
      conexoesSaving: false,
      conexoesActionError: '',
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const {
    state,
    usuario,
    loadError,
    dirty,
    actorId,
    view,
    managementSection,
    documentId,
    editor,
    mobile,
    search,
    status,
    modelFilter,
    groupFilter,
    toast,
    newOpen,
    newTemplate,
    newTitle,
    groupEdit,
    tagEdit,
    organizacao,
    organizacaoLoading,
    organizacaoError,
    organizacaoSaving,
    acessos,
    acessosLoading,
    acessosError,
    acessosSaving,
    pessoasUsuarios,
    pessoasUsuariosLoading,
    pessoasUsuariosError,
    papelEdit,
    perfilEdit,
    remocaoAcesso,
    personOpen,
    personName,
    personRole,
    menuPessoalAnchor,
    senhaDialog,
    senhaAtual,
    senhaNova,
    senhaConfirmacao,
    senhaSaving,
    senhaError,
    conexoesDialog,
    conexoes,
    conexoesLoading,
    conexoesError,
    conexaoParaEncerrar,
    conexoesSaving,
    conexoesActionError,
  } = pageState;
  const updateDirty = useCallback(
    (value) => dispatch({ field: 'dirty', value }),
    [],
  );

  const { t: tr, locale, system } = useI18n();

  const carregarOrganizacao = useCallback(async () => {
    dispatch({ field: 'organizacaoLoading', value: true });
    dispatch({ field: 'organizacaoError', value: '' });
    try {
      const dados = await executar('LISTAR_ORGANIZACAO');
      dispatch({ field: 'organizacao', value: dados });
    } catch (erro) {
      dispatch({ field: 'organizacaoError', value: erro.message });
    } finally {
      dispatch({ field: 'organizacaoLoading', value: false });
    }
  }, []);

  useEffect(() => {
    if (view === 'organization' && usuario?.papeis?.includes('GESTOR_GRUPOS_TAGS'))
      carregarOrganizacao();
  }, [view, usuario, carregarOrganizacao]);

  const carregarAcessos = useCallback(async () => {
    dispatch({ field: 'acessosLoading', value: true });
    dispatch({ field: 'acessosError', value: '' });
    try {
      dispatch({ field: 'acessos', value: await executar('LISTAR_ACESSOS') });
    } catch (erro) {
      dispatch({ field: 'acessosError', value: erro.message });
    } finally {
      dispatch({ field: 'acessosLoading', value: false });
    }
  }, []);

  useEffect(() => {
    if (view === 'organization' && usuario?.papeis?.includes('GESTOR_ACESSOS'))
      carregarAcessos();
  }, [view, usuario, carregarAcessos]);

  const carregarPessoasUsuarios = useCallback(async () => {
    dispatch({ field: 'pessoasUsuariosLoading', value: true });
    dispatch({ field: 'pessoasUsuariosError', value: '' });
    try {
      dispatch({ field: 'pessoasUsuarios', value: await executar('LISTAR_PESSOAS_USUARIOS') });
    } catch (erro) {
      dispatch({ field: 'pessoasUsuariosError', value: erro.message });
    } finally {
      dispatch({ field: 'pessoasUsuariosLoading', value: false });
    }
  }, []);

  useEffect(() => {
    if (view === 'organization' && usuario?.papeis?.includes('ADMINISTRADOR_USUARIOS'))
      carregarPessoasUsuarios();
  }, [view, usuario, carregarPessoasUsuarios]);

  const salvarAcesso = async (tipo) => {
    const registro = tipo === 'papel' ? papelEdit : perfilEdit;
    if (!registro || acessosSaving) return;
    dispatch({ field: 'acessosSaving', value: true });
    try {
      await executar(tipo === 'papel' ? 'SALVAR_PAPEL' : 'SALVAR_PERFIL', {
        id: tipo === 'papel' ? registro.idPapel : registro.idPerfil,
        codigo: registro.codigo.trim(),
        nome: registro.nome.trim(),
        descricao: registro.descricao.trim(),
        ativo: registro.ativo,
        ...(tipo === 'perfil' ? { papeis: registro.papeis } : {}),
      });
      dispatch({ field: tipo === 'papel' ? 'papelEdit' : 'perfilEdit', value: null });
      dispatch({ field: 'toast', value: { text: tipo === 'papel' ? 'Papel salvo.' : 'Perfil salvo.', error: false } });
      await carregarAcessos();
    } catch (erro) {
      dispatch({ field: 'toast', value: { text: erro.message, error: true } });
    } finally {
      dispatch({ field: 'acessosSaving', value: false });
    }
  };

  const removerAcesso = async () => {
    if (!remocaoAcesso || acessosSaving) return;
    dispatch({ field: 'acessosSaving', value: true });
    try {
      const resultado = await executar(remocaoAcesso.tipo === 'papel' ? 'REMOVER_PAPEL' : 'REMOVER_PERFIL', { id: remocaoAcesso.id });
      dispatch({ field: 'remocaoAcesso', value: null });
      dispatch({ field: 'toast', value: { text: resultado.acao === 'excluido' ? 'Registro excluído.' : 'Registro inativado porque já foi utilizado.', error: false } });
      await carregarAcessos();
    } catch (erro) {
      dispatch({ field: 'toast', value: { text: erro.message, error: true } });
    } finally {
      dispatch({ field: 'acessosSaving', value: false });
    }
  };

  const salvarGrupo = async () => {
    if (!groupEdit || organizacaoSaving) return;
    dispatch({ field: 'organizacaoSaving', value: true });
    try {
      await executar('SALVAR_GRUPO', {
        idGrupo: groupEdit.idGrupo,
        nome: groupEdit.nome.trim(),
        ativo: groupEdit.ativo,
        tags: groupEdit.tags,
      });
      dispatch({ field: 'groupEdit', value: null });
      dispatch({ field: 'toast', value: { text: 'Grupo salvo.', error: false } });
      await carregarOrganizacao();
    } catch (erro) {
      dispatch({ field: 'toast', value: { text: erro.message, error: true } });
    } finally {
      dispatch({ field: 'organizacaoSaving', value: false });
    }
  };

  const salvarTag = async () => {
    if (!tagEdit || organizacaoSaving) return;
    dispatch({ field: 'organizacaoSaving', value: true });
    try {
      await executar(tagEdit.editando ? 'ALTERAR_TAG' : 'CRIAR_TAG', {
        codigo: tagEdit.codigo.trim(),
        descricao: tagEdit.descricao.trim(),
        grupo: tagEdit.grupo,
        usuario: tagEdit.usuario,
        vinculo: tagEdit.vinculo,
        ...(tagEdit.editando ? { ativa: tagEdit.ativo } : {}),
      });
      dispatch({ field: 'tagEdit', value: null });
      dispatch({ field: 'toast', value: { text: tagEdit.editando ? 'Tag alterada.' : 'Tag criada.', error: false } });
      await carregarOrganizacao();
    } catch (erro) {
      dispatch({ field: 'toast', value: { text: erro.message, error: true } });
    } finally {
      dispatch({ field: 'organizacaoSaving', value: false });
    }
  };

  const mayLeave = useCallback(
    () =>
      !dirty ||
      window.confirm(
        tr('Você tem alterações não salvas. Deseja sair e descartá-las?'),
      ),
    [dirty, tr],
  );

  useEffect(() => {
    async function carregar() {
      if (isLocalSession()) {
        try {
          const sessao = await sessaoAtual();
          if (
            !['user:', 'editor:'].some((prefix) => sessionStorage.getItem(SESSION_KEY) === `${prefix}${sessao.idUsuario}`)
          ) {
            sessionStorage.removeItem(SESSION_KEY);
            window.location.replace('/inicio');
            return;
          }
          dispatch({ field: 'usuario', value: sessao });
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          window.location.replace('/login');
          return;
        }
      }

      try {
        if (sessionRole() !== 'company') {
          window.location.replace(
            sessionRole() === 'platform' ? '/plataforma' : '/login',
          );
          return;
        }
        const data = readStore();
        writeStore(data);
        dispatch({ field: 'state', value: data });
        const saved = sessionStorage.getItem('argousdocs:actor');
        if (saved && isEnabled(saved) && data.people.some((p) => p.id === saved))
          dispatch({ field: 'actorId', value: saved });
      } catch (e) {
        dispatch({ field: 'loadError', value: e.message });
      }
    }
    carregar();
  }, []);
  const commit = useCallback(
    (next) => {
      try {
        if (sessionRole() !== 'company' || !isEnabled(actorId))
          throw Error(
            'Usuário desativado. Contate o administrador da plataforma.',
          );
        writeStore(next, state || undefined);
        dispatch({ field: 'state', value: next });
        return true;
      } catch (e) {
        dispatch({ field: 'toast', value: { text: e.message, error: true } });
        return false;
      }
    },
    [state, actorId],
  );
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
        dispatch({
          field: 'state',
          value: (current) => (current ? { ...current } : current),
        });
        if (sessionRole() !== 'company') window.location.replace('/login');
        else if (!isEnabled(actorId)) {
          dispatch({ field: 'actorId', value: 'admin' });
          sessionStorage.removeItem('argousdocs:actor');
          dispatch({ field: 'editor', value: null });
        }
      }
      if (e.key === 'argousdocs:workspace:v1')
        dispatch({
          field: 'toast',
          value: {
            text: 'Os dados foram alterados em outra aba. Recarregue esta página antes de continuar.',
            error: true,
          },
        });
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [actorId]);
  useEffect(() => {
    if (!state || (pageState.usuario && !pageState.usuario.papeis?.includes('CONSULTA_DOCUMENTOS'))) return;
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
          dispatch({ field: 'documentId', value: id });
          dispatch({ field: 'editor', value: null });
          dispatch({ field: 'view', value: 'documents' });
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
  }, [state, pageState.usuario]);
  const closeTemplate = useCallback(() => {
    if (mayLeave()) dispatch({ field: 'editor', value: null });
  }, [mayLeave]);
  const saveTemplate = useCallback(
    (t, startDocument = false) => {
      if (pageState.usuario && (!pageState.usuario.papeis?.includes('MODELADOR') ||
          (startDocument && !pageState.usuario.papeis?.includes('EDITOR_DE_DOCUMENTOS')))) return;
      const person =
        state.people.find((p) => p.id === actorId) || state.people[0];
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
              ...new Set(f.options.map((o) => o.trim()).filter(Boolean)),
            ],
          })),
        })),
      };
      const created = startDocument
        ? createDocument(saved, saved.name, state.documents.length, person.name)
        : null;
      if (
        commit({
          ...state,
          documents: created ? [...state.documents, created] : state.documents,
          templates: existing
            ? state.templates.map((x) => (x.id === t.id ? saved : x))
            : [...state.templates, saved],
        })
      ) {
        dispatch({ field: 'editor', value: null });
        if (created) {
          dispatch({ field: 'documentId', value: created.id });
          dispatch({ field: 'view', value: 'documents' });
        }
        dispatch({
          field: 'toast',
          value: {
            text: saved.draft
              ? 'Rascunho salvo. Continue a edição em Modelos.'
              : 'Modelo salvo. Novos documentos usarão esta versão.',
            error: false,
          },
        });
      }
    },
    [state, actorId, commit, tr, pageState.usuario],
  );
  const switchPerson = useCallback(
    (id) => {
      if (!mayLeave() || !state.people.some((p) => p.id === id)) return;
      dispatch({ field: 'actorId', value: id });
      sessionStorage.setItem('argousdocs:actor', id);
    },
    [state, mayLeave],
  );
  const closeDocument = useCallback(() => {
    if (mayLeave()) dispatch({ field: 'documentId', value: null });
  }, [mayLeave]);
  const performDocumentAction = useCallback(
    (action, values, reason) => {
      if (pageState.usuario && !pageState.usuario.papeis?.includes('EDITOR_DE_DOCUMENTOS')) return false;
      const person =
        state.people.find((p) => p.id === actorId) || state.people[0];
      const doc = state.documents.find((d) => d.id === documentId);
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
        dispatch({
          field: 'toast',
          value: {
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
          },
        });
        return true;
      } catch (e) {
        dispatch({
          field: 'toast',
          value: { text: e.message, error: true },
        });
        return false;
      }
    },
    [state, actorId, documentId, commit, pageState.usuario],
  );
  const openDocument = useCallback(
    (id) => dispatch({ field: 'documentId', value: id }),
    [],
  );
  const contextValues = useMemo(() => {
    const { telaAtual: _telaAtual, loading: _loading, ...value } = pageState;
    return {
      telaAtual: value.view,
      loading: !value.state && !value.loadError,
      value,
      dispatch,
      initialStateRef,
      onDirtyChange: updateDirty,
      saveTemplate,
      closeTemplate,
      performDocumentAction,
      closeDocument,
      switchPerson,
      openDocument,
    };
  }, [
    pageState,
    updateDirty,
    saveTemplate,
    closeTemplate,
    performDocumentAction,
    closeDocument,
    switchPerson,
    openDocument,
  ]);
  if (!state)
    return (
      <WorkspaceContext.Provider value={contextValues}>
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
      </WorkspaceContext.Provider>
    );
  const person = state.people.find((p) => p.id === actorId) || state.people[0];
  const hasRole = (role) => usuario
    ? usuario.papeis?.includes(role) === true
    : person.role === 'admin' || (role === 'MODELADOR' && person.role === 'designer') ||
      ['AUTOGESTAO', 'CONSULTA_DOCUMENTOS', 'EDITOR_DE_DOCUMENTOS'].includes(role);
  const admin = hasRole('ADMINISTRADOR_USUARIOS');
  const groupManager = Boolean(usuario) && hasRole('GESTOR_GRUPOS_TAGS');
  const accessManager = hasRole('GESTOR_ACESSOS');
  const designer = hasRole('MODELADOR');
  const canConsultDocuments = hasRole('CONSULTA_DOCUMENTOS');
  const canEditDocuments = hasRole('EDITOR_DE_DOCUMENTOS');
  const canManageOwnData = hasRole('AUTOGESTAO');
  const canView = (destination) => destination === 'home' ||
    (destination === 'settings' && canManageOwnData) ||
    (destination === 'documents' && canConsultDocuments) ||
    (destination === 'dashboards' && hasRole('ANALISTA_INDICADORES')) ||
    (destination === 'templates' && designer) ||
    (destination === 'organization' && (admin || groupManager || accessManager));
  const managementAreas = [
    ['groups', 'Grupos e tags', groupManager],
    ['access', 'Papéis e perfis', accessManager],
    ['users', 'Usuários e pessoas', admin],
  ].filter(([, , allowed]) => allowed);
  const activeManagementSection = managementAreas.some(([key]) => key === managementSection)
    ? managementSection
    : managementAreas[0]?.[0];
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
    if (!canView(v)) return;
    if (!mayLeave()) return;
    dispatch({ field: 'view', value: v });
    dispatch({ field: 'documentId', value: null });
    dispatch({ field: 'editor', value: null });
    dispatch({ field: 'search', value: '' });
    dispatch({ field: 'status', value: 'all' });
    dispatch({ field: 'modelFilter', value: 'all' });
    dispatch({ field: 'groupFilter', value: 'all' });
    dispatch({ field: 'mobile', value: false });
  };
  const encerrarSessao = async () => {
    if (!mayLeave()) return;
    dispatch({ field: 'menuPessoalAnchor', value: null });
    try {
      if (isLocalSession()) await sair();
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = '/login';
    } catch (falha) {
      dispatch({ field: 'toast', value: { text: falha.message, error: true } });
    }
  };
  const fecharTrocaSenha = (forcar = false) => {
    if (senhaSaving && !forcar) return;
    dispatch({ field: 'senhaDialog', value: false });
    dispatch({ field: 'senhaAtual', value: '' });
    dispatch({ field: 'senhaNova', value: '' });
    dispatch({ field: 'senhaConfirmacao', value: '' });
    dispatch({ field: 'senhaError', value: '' });
  };
  const trocarSenha = async () => {
    if (senhaSaving) return;
    if (!avaliarSenha(senhaNova).valida) {
      dispatch({ field: 'senhaError', value: 'A senha não atende à política de segurança.' });
      return;
    }
    if (senhaNova !== senhaConfirmacao) {
      dispatch({ field: 'senhaError', value: 'A confirmação não corresponde à nova senha.' });
      return;
    }
    dispatch({ field: 'senhaSaving', value: true });
    dispatch({ field: 'senhaError', value: '' });
    try {
      await executar('ALTERAR_SENHA', { senhaAtual, senhaNova });
      dispatch({ field: 'senhaSaving', value: false });
      fecharTrocaSenha(true);
      dispatch({ field: 'toast', value: { text: 'Senha alterada. As outras sessões foram encerradas.', error: false } });
    } catch (falha) {
      dispatch({ field: 'senhaError', value: falha.message });
      dispatch({ field: 'senhaSaving', value: false });
    }
  };
  const carregarConexoes = async () => {
    dispatch({ field: 'conexoesLoading', value: true });
    dispatch({ field: 'conexoesError', value: '' });
    try {
      const dados = await executar('LISTAR_CONEXOES_ATIVAS');
      dispatch({ field: 'conexoes', value: dados.conexoes || [] });
    } catch (falha) {
      dispatch({ field: 'conexoesError', value: falha.message });
    } finally {
      dispatch({ field: 'conexoesLoading', value: false });
    }
  };
  const abrirConexoes = () => {
    dispatch({ field: 'menuPessoalAnchor', value: null });
    dispatch({ field: 'conexoesDialog', value: true });
    dispatch({ field: 'conexoes', value: [] });
    carregarConexoes();
  };
  const encerrarConexao = async () => {
    if (!conexaoParaEncerrar || conexoesSaving) return;
    dispatch({ field: 'conexoesSaving', value: true });
    dispatch({ field: 'conexoesActionError', value: '' });
    try {
      const resultado = await executar('ENCERRAR_CONEXAO', { idLogin: conexaoParaEncerrar.idLogin });
      if (resultado.atual) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = '/login';
        return;
      }
      dispatch({ field: 'conexaoParaEncerrar', value: null });
      dispatch({ field: 'toast', value: { text: 'Conexão encerrada.', error: false } });
      await carregarConexoes();
    } catch (falha) {
      dispatch({ field: 'conexoesActionError', value: falha.message });
    } finally {
      dispatch({ field: 'conexoesSaving', value: false });
    }
  };
  const dataConexao = (valor) => valor ? new Date(valor).toLocaleString(locale) : '—';
  const openNew = (templateId) => {
    if (!canEditDocuments) return;
    dispatch({
      field: 'newTemplate',
      value: templateId || state.templates.find((t) => !t.draft)?.id || '',
    });
    dispatch({ field: 'newTitle', value: '' });
    dispatch({ field: 'newOpen', value: true });
  };
  const create = () => {
    if (!canEditDocuments) return;
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
        dispatch({ field: 'newOpen', value: false });
        dispatch({ field: 'documentId', value: d.id });
        dispatch({ field: 'view', value: 'documents' });
        dispatch({
          field: 'toast',
          value: {
            text: 'Documento iniciado. O primeiro grupo já pode assumir a etapa.',
            error: false,
          },
        });
      }
    } catch (e) {
      dispatch({ field: 'toast', value: { text: e.message, error: true } });
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
          .filter(([v]) => canView(v))
          .map(([v, label, Icon]) => (
            <button
              className={view === v ? 'active' : ''}
              key={v}
              onClick={() => navigate(v)}
            >
              <Icon size={19} />
              <span>{tr(label)}</span>
            </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-exit">
          {canManageOwnData && <Button
            onClick={(event) => dispatch({ field: 'menuPessoalAnchor', value: event.currentTarget })}
            aria-label={tr('Menu do usuário')}
            aria-haspopup="menu"
            aria-expanded={Boolean(menuPessoalAnchor)}
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
              {initials(usuario?.nome || person.name)}
            </Avatar>
            <div>
              <strong>{(usuario?.nome || person.name).trim().split(/\s+/)[0]}</strong>
              <small title={usuario?.perfis?.join(', ')}>{usuario ? profileSummary(usuario.perfis) : tr(roleLabel(person))}</small>
            </div>
          </Button>}
          {canManageOwnData && <MuiMenu anchorEl={menuPessoalAnchor} open={Boolean(menuPessoalAnchor)} onClose={() => dispatch({ field: 'menuPessoalAnchor', value: null })}>
            <MenuItem onClick={() => { dispatch({ field: 'menuPessoalAnchor', value: null }); navigate('settings'); }}>{tr('Dados cadastrais')}</MenuItem>
            {usuario && <MenuItem onClick={() => { dispatch({ field: 'menuPessoalAnchor', value: null }); dispatch({ field: 'senhaDialog', value: true }); }}>{tr('Trocar senha')}</MenuItem>}
            {usuario && <MenuItem onClick={abrirConexoes}>{tr('Conexões ativas')}</MenuItem>}
            <MenuItem onClick={encerrarSessao}>{tr('Sair')}</MenuItem>
          </MuiMenu>}
          {!canManageOwnData && <IconButton
            aria-label={tr('Sair')}
            onClick={encerrarSessao}
          >
            <LogOut size={17} />
          </IconButton>}
        </div>
      </div>
    </div>
  );
  let rows = state.documents;
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
                      dispatch({ field: 'documentId', value: d.id });
                      dispatch({ field: 'view', value: 'documents' });
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
                      dispatch({ field: 'documentId', value: d.id });
                      dispatch({ field: 'view', value: 'documents' });
                    }}
                    endIcon={<ChevronRight size={16} />}
                  >
                    {d.status === 'done'
                      ? tr('Ver documento')
                      : canEditDocuments && ((canWork(d, person, state.groups) &&
                            (!d.assignee || d.assignee === person.id)) ||
                          canContribute(d, person, state.groups))
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
                    {tr('Nenhum documento encontrado')}
                  </h3>
                  <p>
                    {canEditDocuments
                      ? tr('Ajuste os filtros ou inicie um novo documento.')
                      : tr('Ajuste os filtros para encontrar um documento.')}
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
    <WorkspaceContext.Provider value={contextValues}>
      <div className="app-shell">
        <aside className="desktop-sidebar">{sidebar}</aside>
        <Drawer
          open={mobile}
          onClose={() => dispatch({ field: 'mobile', value: false })}
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
                onClick={() => dispatch({ field: 'mobile', value: true })}
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
              <TemplateEditor key={editor.id} />
            ) : doc && canConsultDocuments ? (
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
              />
            ) : (
              <>
                {view === 'settings' && canManageOwnData && (
                  <>
                    <div className="page-heading">
                      <h1>{tr('Configurações do usuário')}</h1>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('home')}
                      >
                        {tr('Visão geral')}
                      </Button>
                    </div>
                    <UserSettings />
                  </>
                )}
                {view === 'dashboards' && canView('dashboards') && <Dashboards />}
                {view === 'home' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {tr('SEU ESPAÇO DE TRABALHO')}
                        </span>
                        <h1>
                          {tr('Olá,')}
                          {(usuario?.nome || person.name).trim().split(/\s+/)[0]}{' '}
                          <span className="greeting-dot">.</span>
                        </h1>
                        <p>
                          {tr('Uma visão clara de tudo que está em movimento.')}
                        </p>
                      </div>
                      {canEditDocuments && <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => openNew()}
                      >
                        {tr('Novo documento')}
                      </Button>}
                    </div>
                    {canConsultDocuments && <div className="stats-grid">
                      {[
                        [
                          Files,
                          'Em andamento',
                          active.length,
                          tr('Documentos em fluxo'),
                          'active',
                        ],
                        ...(canEditDocuments ? [[
                          Inbox,
                          tr('Minhas pendências'),
                          tasks.length,
                          tr('Etapas para o seu grupo'),
                          'tasks',
                        ]] : []),
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
                            navigate('documents');
                            if (key === 'reviews')
                              dispatch({
                                field: 'status',
                                value: 'Em aprovação',
                              });
                            if (key === 'done')
                              dispatch({
                                field: 'status',
                                value: 'Finalizado',
                              });
                            if (key === 'active')
                              dispatch({ field: 'status', value: 'open' });
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
                    </div>}
                    <div className="home-columns">
                      {canConsultDocuments && canEditDocuments && <section className="panel attention-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>{tr('Seu próximo passo')}</h2>
                            <p>{tr('As etapas que precisam de você.')}</p>
                          </div>
                          <Button
                            onClick={() => navigate('documents')}
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
                                dispatch({
                                  field: 'documentId',
                                  value: d.id,
                                });
                                dispatch({ field: 'view', value: 'documents' });
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
                      </section>}
                      {canEditDocuments && <section className="quick-start">
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
                      </section>}
                    </div>
                    {canConsultDocuments && <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{tr('Documentos recentes')}</h2>
                          <p>
                            {tr(
                              'Acompanhe as últimas movimentações da equipe.',
                            )}
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
                          .sort((a, b) =>
                            b.updatedAt.localeCompare(a.updatedAt),
                          )
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
                    </section>}
                  </>
                )}
                {view === 'documents' && canConsultDocuments && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {tr('DO INÍCIO À FINALIZAÇÃO')}
                        </span>
                        <h1>
                          {tr('Documentos')}
                        </h1>
                        <p>
                          {tr('Encontre, acompanhe e continue os documentos da equipe.')}
                        </p>
                      </div>
                      {canEditDocuments && <Button
                        variant="contained"
                        startIcon={<Plus size={18} />}
                        onClick={() => openNew()}
                      >
                        {tr('Novo documento')}
                      </Button>}
                    </div>
                    <section className="panel">
                      <div className="document-filters">
                        <TextField
                          placeholder={tr('Buscar documento…')}
                          value={search}
                          onChange={(e) =>
                            dispatch({
                              field: 'search',
                              value: e.target.value,
                            })
                          }
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Search size={18} />
                                </InputAdornment>
                              ),
                            },
                            htmlInput: {
                              'aria-label': tr('Buscar documento'),
                            },
                          }}
                        />
                        <TextField
                          select
                          label={tr('Status')}
                          value={status}
                          onChange={(e) =>
                            dispatch({
                              field: 'status',
                              value: e.target.value,
                            })
                          }
                        >
                          <MenuItem value="all">
                            {tr('Todos os status')}
                          </MenuItem>
                          <MenuItem value="open">
                            {tr('Todos em fluxo')}
                          </MenuItem>
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
                          onChange={(e) =>
                            dispatch({
                              field: 'modelFilter',
                              value: e.target.value,
                            })
                          }
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
                          onChange={(e) =>
                            dispatch({
                              field: 'groupFilter',
                              value: e.target.value,
                            })
                          }
                        >
                          <MenuItem value="all">
                            {tr('Todos os grupos')}
                          </MenuItem>
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
                            dispatch({ field: 'search', value: '' });
                            dispatch({ field: 'status', value: 'all' });
                            dispatch({ field: 'modelFilter', value: 'all' });
                            dispatch({ field: 'groupFilter', value: 'all' });
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
                        onClick={() =>
                          dispatch({
                            field: 'editor',
                            value: blankTemplate(),
                          })
                        }
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
                              onClick={() =>
                                dispatch({ field: 'editor', value: t })
                              }
                              startIcon={<Settings2 size={16} />}
                            >
                              {tr(
                                t.draft ? 'Continuar edição' : 'Editar modelo',
                              )}
                            </Button>
                            <Button
                              variant="contained"
                              disabled={!!t.draft || !canEditDocuments}
                              onClick={() => openNew(t.id)}
                            >
                              {tr('Usar modelo')}
                            </Button>
                          </div>
                        </article>
                      ))}
                      <button
                        className="new-template-card"
                        onClick={() =>
                          dispatch({
                            field: 'editor',
                            value: blankTemplate(),
                          })
                        }
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
                {view === 'organization' && canView('organization') && (
                  <>
                    <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {tr('ADMINISTRAÇÃO DA INSTITUIÇÃO')}
                        </span>
                        <h1>{tr('Organização e acessos')}</h1>
                        <p>{tr('Organize grupos, acessos e pessoas conforme suas responsabilidades.')}</p>
                      </div>
                    </div>
                    <Tabs
                      value={activeManagementSection}
                      onChange={(_, section) => dispatch({ field: 'managementSection', value: section })}
                      variant="scrollable"
                      scrollButtons="auto"
                      aria-label={tr('Áreas de organização e acessos')}
                      sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
                    >
                      {managementAreas.map(([key, label]) => (
                        <Tab key={key} value={key} label={tr(label)} />
                      ))}
                    </Tabs>
                    {activeManagementSection === 'groups' && (
                      <>
                        {organizacaoLoading && <LinearProgress sx={{ mb: 2 }} />}
                        {organizacaoError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={carregarOrganizacao}>{tr('Tentar novamente')}</Button>}>{system(organizacaoError)}</Alert>}
                        <div className="panel-heading">
                          <div><h2>{tr('Grupos')}</h2><p>{tr('Os integrantes poderão ser vinculados depois da criação do grupo.')}</p></div>
                          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => dispatch({ field: 'groupEdit', value: { idGrupo: null, nome: '', ativo: true, tags: [] } })}>{tr('Criar grupo')}</Button>
                        </div>
                        {!organizacaoError && organizacao && (
                          organizacao.grupos.length ? <div className="group-grid">
                            {organizacao.grupos.map((grupo) => <article className="panel group-card" key={grupo.idGrupo}>
                              <div className="template-card-top">
                                <span className="template-icon"><Users size={24} /></span>
                                <IconButton aria-label={`${tr('Editar grupo')} ${grupo.nome}`} onClick={() => dispatch({ field: 'groupEdit', value: { ...grupo, tags: grupo.tags || [] } })}><Settings2 size={18} /></IconButton>
                              </div>
                              <h2>{grupo.nome}</h2>
                              {!grupo.ativo && <Chip size="small" label={tr('Inativo')} />}
                              {!!grupo.tags?.length && <p>{grupo.tags.join(', ')}</p>}
                            </article>)}
                          </div> : <Alert severity="info">{tr('Nenhum grupo cadastrado.')}</Alert>
                        )}
                        <div className="panel-heading" style={{ marginTop: 32 }}>
                          <div><h2>{tr('Tags')}</h2><p>{tr('Cadastre tags de grupo, usuário ou vínculo. A atribuição será feita depois.')}</p></div>
                          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => dispatch({ field: 'tagEdit', value: { editando: false, codigo: '', descricao: '', grupo: false, usuario: false, vinculo: false, ativo: true } })}>{tr('Criar tag')}</Button>
                        </div>
                        {!organizacaoError && organizacao && (
                          organizacao.tags.length ? <TableContainer className="panel"><Table>
                            <TableHead><TableRow><TableCell>{tr('CÓDIGO')}</TableCell><TableCell>{tr('DESCRIÇÃO')}</TableCell><TableCell>{tr('APLICAÇÕES')}</TableCell><TableCell>{tr('SITUAÇÃO')}</TableCell><TableCell>{tr('AÇÕES')}</TableCell></TableRow></TableHead>
                            <TableBody>{organizacao.tags.map((tag) => <TableRow key={tag.codigo}>
                              <TableCell>{tag.codigo}</TableCell><TableCell>{tag.descricao || '—'}</TableCell>
                              <TableCell>{[
                                tag.grupo && tr('Tag de Grupo'),
                                tag.usuario && tr('Tag de Usuário'),
                                tag.vinculo && tr('Tag de Vínculo'),
                              ].filter(Boolean).join(', ') || '—'}</TableCell>
                              <TableCell>{tr(tag.ativo ? 'Ativa' : 'Inativa')}</TableCell>
                              <TableCell><IconButton aria-label={`${tr('Editar tag')} ${tag.codigo}`} onClick={() => dispatch({ field: 'tagEdit', value: { ...tag, editando: true } })}><Settings2 size={18} /></IconButton></TableCell>
                            </TableRow>)}</TableBody>
                          </Table></TableContainer> : <Alert severity="info">{tr('Nenhuma tag cadastrada.')}</Alert>
                        )}
                      </>
                    )}
                    {activeManagementSection === 'access' && (
                      <>
                        {acessosLoading && <LinearProgress sx={{ mb: 2 }} />}
                        {acessosError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={carregarAcessos}>{tr('Tentar novamente')}</Button>}>{system(acessosError)}</Alert>}
                        <div className="panel-heading">
                          <div><h2>{tr('Papéis')}</h2><p>{tr('Novos papéis poderão ser criados quando for possível definir suas permissões.')}</p></div>
                        </div>
                        {!acessosError && acessos && (
                          acessos.papeis.length ? <TableContainer className="panel"><Table>
                            <TableHead><TableRow><TableCell>{tr('CÓDIGO')}</TableCell><TableCell>{tr('NOME')}</TableCell><TableCell>{tr('DESCRIÇÃO')}</TableCell><TableCell>{tr('SITUAÇÃO')}</TableCell><TableCell>{tr('AÇÕES')}</TableCell></TableRow></TableHead>
                            <TableBody>{acessos.papeis.map((papel) => <TableRow key={papel.idPapel}>
                              <TableCell>{papel.codigo}</TableCell><TableCell>{papel.nome}{papel.sistema && <Chip size="small" sx={{ ml: 1 }} label={tr('Sistema')} />}</TableCell><TableCell>{papel.descricao}</TableCell><TableCell>{tr(papel.ativo ? 'Ativo' : 'Inativo')}</TableCell>
                              <TableCell><IconButton aria-label={`${tr('Editar papel')} ${papel.nome}`} onClick={() => dispatch({ field: 'papelEdit', value: { ...papel } })}><Settings2 size={18} /></IconButton>{!papel.sistema && <Button size="small" color="error" onClick={() => dispatch({ field: 'remocaoAcesso', value: { tipo: 'papel', id: papel.idPapel, nome: papel.nome } })}>{tr('Remover')}</Button>}</TableCell>
                            </TableRow>)}</TableBody>
                          </Table></TableContainer> : <Alert severity="info">{tr('Nenhum papel cadastrado.')}</Alert>
                        )}
                        <div className="panel-heading" style={{ marginTop: 32 }}>
                          <div><h2>{tr('Perfis')}</h2><p>{tr('Perfis reúnem papéis para atribuição aos usuários.')}</p></div>
                          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => dispatch({ field: 'perfilEdit', value: { idPerfil: null, codigo: '', nome: '', descricao: '', ativo: true, sistema: false, papeis: [] } })}>{tr('Criar perfil')}</Button>
                        </div>
                        {!acessosError && acessos && (
                          acessos.perfis.length ? <TableContainer className="panel"><Table>
                            <TableHead><TableRow><TableCell>{tr('CÓDIGO')}</TableCell><TableCell>{tr('NOME')}</TableCell><TableCell>{tr('PAPÉIS')}</TableCell><TableCell>{tr('SITUAÇÃO')}</TableCell><TableCell>{tr('AÇÕES')}</TableCell></TableRow></TableHead>
                            <TableBody>{acessos.perfis.map((perfil) => <TableRow key={perfil.idPerfil}>
                              <TableCell>{perfil.codigo}</TableCell><TableCell>{perfil.nome}{perfil.sistema && <Chip size="small" sx={{ ml: 1 }} label={tr('Sistema')} />}</TableCell>
                              <TableCell>{perfil.papeis.map((id) => acessos.papeis.find((papel) => papel.idPapel === id)?.nome || id).join(', ') || '—'}</TableCell><TableCell>{tr(perfil.ativo ? 'Ativo' : 'Inativo')}</TableCell>
                              <TableCell><IconButton aria-label={`${tr('Editar perfil')} ${perfil.nome}`} onClick={() => dispatch({ field: 'perfilEdit', value: { ...perfil, papeis: [...perfil.papeis] } })}><Settings2 size={18} /></IconButton>{!perfil.sistema && <Button size="small" color="error" onClick={() => dispatch({ field: 'remocaoAcesso', value: { tipo: 'perfil', id: perfil.idPerfil, nome: perfil.nome } })}>{tr('Remover')}</Button>}</TableCell>
                            </TableRow>)}</TableBody>
                          </Table></TableContainer> : <Alert severity="info">{tr('Nenhum perfil cadastrado.')}</Alert>
                        )}
                      </>
                    )}
                    {activeManagementSection === 'users' && usuario && (
                      <>
                        {pessoasUsuariosLoading && <LinearProgress sx={{ mb: 2 }} />}
                        {pessoasUsuariosError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={carregarPessoasUsuarios}>{tr('Tentar novamente')}</Button>}>{system(pessoasUsuariosError)}</Alert>}
                        <div className="panel-heading"><div><h2>{tr('Usuários')}</h2><p>{tr('Contas vinculadas a pessoas da instituição.')}</p></div></div>
                        {!pessoasUsuariosError && pessoasUsuarios && (pessoasUsuarios.usuarios.length ? <TableContainer className="panel"><Table>
                          <TableHead><TableRow><TableCell>{tr('NOME')}</TableCell><TableCell>{tr('E-MAIL')}</TableCell><TableCell>{tr('PERFIS')}</TableCell></TableRow></TableHead>
                          <TableBody>{pessoasUsuarios.usuarios.map((registro) => <TableRow key={registro.idUsuario}>
                            <TableCell>{registro.nome}</TableCell><TableCell>{registro.email}</TableCell><TableCell>{registro.perfis.join(', ') || '—'}</TableCell>
                          </TableRow>)}</TableBody>
                        </Table></TableContainer> : <Alert severity="info">{tr('Nenhum usuário cadastrado.')}</Alert>)}
                        <div className="panel-heading" style={{ marginTop: 32 }}><div><h2>{tr('Pessoas')}</h2><p>{tr('Pessoas sem conta de usuário.')}</p></div></div>
                        {!pessoasUsuariosError && pessoasUsuarios && (pessoasUsuarios.pessoas.length ? <TableContainer className="panel"><Table>
                          <TableHead><TableRow><TableCell>{tr('NOME')}</TableCell><TableCell>{tr('E-MAIL')}</TableCell><TableCell>{tr('TELEFONE')}</TableCell></TableRow></TableHead>
                          <TableBody>{pessoasUsuarios.pessoas.map((registro) => <TableRow key={registro.idPessoa}>
                            <TableCell>{registro.nomeSocial || registro.nome}</TableCell><TableCell>{registro.email || '—'}</TableCell><TableCell>{registro.telefone || '—'}</TableCell>
                          </TableRow>)}</TableBody>
                        </Table></TableContainer> : <Alert severity="info">{tr('Nenhuma pessoa cadastrada.')}</Alert>)}
                      </>
                    )}
                    {activeManagementSection === 'users' && !usuario && <section className="panel people-panel management-users-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{tr('Pessoas do espaço de trabalho')}</h2>
                          <p>{tr('Perfis disponíveis na demonstração.')}</p>
                        </div>
                        {admin && (
                          <Button
                            startIcon={<UserPlus size={17} />}
                            onClick={() => {
                              dispatch({ field: 'personName', value: '' });
                              dispatch({
                                field: 'personRole',
                                value: 'participant',
                              });
                              dispatch({ field: 'personOpen', value: true });
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
                    </section>}
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
        <Dialog
          open={newOpen && canEditDocuments}
          onClose={() => dispatch({ field: 'newOpen', value: false })}
        >
          <DialogTitle>{tr('Novo documento')}</DialogTitle>
          <DialogContent>
            {designer && (
              <Button
                variant="outlined"
                onClick={() => {
                  dispatch({ field: 'newOpen', value: false });
                  dispatch({ field: 'editor', value: blankTemplate() });
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
                onChange={(e) =>
                  dispatch({ field: 'newTemplate', value: e.target.value })
                }
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
                onChange={(e) =>
                  dispatch({ field: 'newTitle', value: e.target.value })
                }
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
            <Button
              onClick={() => dispatch({ field: 'newOpen', value: false })}
            >
              {tr('Cancelar')}
            </Button>
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
        <Dialog open={!!papelEdit} onClose={() => dispatch({ field: 'papelEdit', value: null })} fullWidth maxWidth="sm">
          <DialogTitle>{tr(papelEdit?.idPapel ? 'Editar papel' : 'Criar papel')}</DialogTitle>
          <DialogContent>
            {papelEdit && <div className="dialog-fields">
              <TextField label={tr('Código do papel')} autoFocus={!papelEdit.idPapel} disabled={!!papelEdit.idPapel} value={papelEdit.codigo} inputProps={{ maxLength: 70 }} onChange={(e) => dispatch({ field: 'papelEdit', value: { ...papelEdit, codigo: e.target.value } })} />
              <TextField label={tr('Nome')} autoFocus={!!papelEdit.idPapel} value={papelEdit.nome} inputProps={{ maxLength: 120 }} onChange={(e) => dispatch({ field: 'papelEdit', value: { ...papelEdit, nome: e.target.value } })} />
              <TextField label={tr('Descrição')} multiline minRows={2} value={papelEdit.descricao} onChange={(e) => dispatch({ field: 'papelEdit', value: { ...papelEdit, descricao: e.target.value } })} />
              <FormControlLabel control={<Checkbox checked={papelEdit.ativo} disabled={papelEdit.sistema} onChange={(e) => dispatch({ field: 'papelEdit', value: { ...papelEdit, ativo: e.target.checked } })} />} label={tr('Papel ativo')} />
              <p className="muted">{tr('As permissões dos papéis serão configuradas em uma etapa posterior.')}</p>
            </div>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch({ field: 'papelEdit', value: null })}>{tr('Cancelar')}</Button>
            <Button variant="contained" disabled={!papelEdit?.codigo.trim() || !papelEdit?.nome.trim() || !papelEdit?.descricao.trim() || acessosSaving} onClick={() => salvarAcesso('papel')}>{tr('Salvar papel')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!perfilEdit} onClose={() => dispatch({ field: 'perfilEdit', value: null })} fullWidth maxWidth="sm">
          <DialogTitle>{tr(perfilEdit?.idPerfil ? 'Editar perfil' : 'Criar perfil')}</DialogTitle>
          <DialogContent>
            {perfilEdit && <div className="dialog-fields">
              <TextField label={tr('Código do perfil')} autoFocus={!perfilEdit.idPerfil} disabled={!!perfilEdit.idPerfil} value={perfilEdit.codigo} inputProps={{ maxLength: 70 }} onChange={(e) => dispatch({ field: 'perfilEdit', value: { ...perfilEdit, codigo: e.target.value } })} />
              <TextField label={tr('Nome')} autoFocus={!!perfilEdit.idPerfil} value={perfilEdit.nome} inputProps={{ maxLength: 120 }} onChange={(e) => dispatch({ field: 'perfilEdit', value: { ...perfilEdit, nome: e.target.value } })} />
              <TextField label={tr('Descrição')} multiline minRows={2} value={perfilEdit.descricao} onChange={(e) => dispatch({ field: 'perfilEdit', value: { ...perfilEdit, descricao: e.target.value } })} />
              <FormControlLabel control={<Checkbox checked={perfilEdit.ativo} disabled={perfilEdit.sistema} onChange={(e) => dispatch({ field: 'perfilEdit', value: { ...perfilEdit, ativo: e.target.checked } })} />} label={tr('Perfil ativo')} />
              <div>
                <strong>{tr('Papéis do perfil')}</strong>
                {(acessos?.papeis || []).filter((papel) => papel.ativo || perfilEdit.papeis.includes(papel.idPapel)).map((papel) => <FormControlLabel key={papel.idPapel} sx={{ display: 'flex' }} control={<Checkbox checked={perfilEdit.papeis.includes(papel.idPapel)} disabled={perfilEdit.sistema || !papel.ativo} onChange={(e) => dispatch({ field: 'perfilEdit', value: { ...perfilEdit, papeis: e.target.checked ? [...perfilEdit.papeis, papel.idPapel] : perfilEdit.papeis.filter((id) => id !== papel.idPapel) } })} />} label={`${papel.nome} (${papel.codigo})${!papel.ativo ? ` — ${tr('Inativo')}` : ''}`} />)}
                {!acessos?.papeis?.length && <p className="muted">{tr('Nenhum papel cadastrado.')}</p>}
              </div>
            </div>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch({ field: 'perfilEdit', value: null })}>{tr('Cancelar')}</Button>
            <Button variant="contained" disabled={!perfilEdit?.codigo.trim() || !perfilEdit?.nome.trim() || !perfilEdit?.descricao.trim() || acessosSaving} onClick={() => salvarAcesso('perfil')}>{tr('Salvar perfil')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!remocaoAcesso} onClose={() => dispatch({ field: 'remocaoAcesso', value: null })} fullWidth maxWidth="xs">
          <DialogTitle>{tr('Remover registro')}</DialogTitle>
          <DialogContent>
            <p>{tr('Remover')} <strong>{remocaoAcesso?.nome}</strong>?</p>
            <p className="muted">{tr('Se já foi utilizado, o registro será inativado para preservar o histórico.')}</p>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch({ field: 'remocaoAcesso', value: null })}>{tr('Cancelar')}</Button>
            <Button color="error" variant="contained" disabled={acessosSaving} onClick={removerAcesso}>{tr('Confirmar')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={senhaDialog && canManageOwnData && Boolean(usuario)} onClose={() => fecharTrocaSenha()} fullWidth maxWidth="sm">
          <DialogTitle>{tr('Trocar senha')}</DialogTitle>
          <form onSubmit={(event) => { event.preventDefault(); trocarSenha(); }}>
            <DialogContent>
              <div className="dialog-fields">
                <TextField label={tr('Senha atual')} type="password" autoComplete="current-password" value={senhaAtual} required disabled={senhaSaving} onChange={(event) => dispatch({ field: 'senhaAtual', value: event.target.value })} />
                <TextField label={tr('Nova senha')} type="password" autoComplete="new-password" value={senhaNova} required disabled={senhaSaving} onChange={(event) => dispatch({ field: 'senhaNova', value: event.target.value })} slotProps={{ htmlInput: { minLength: 8, maxLength: 1024 } }} />
                <ForcaSenha senha={senhaNova} />
                <TextField label={tr('Confirmar nova senha')} type="password" autoComplete="new-password" value={senhaConfirmacao} required disabled={senhaSaving} onChange={(event) => dispatch({ field: 'senhaConfirmacao', value: event.target.value })} />
                {senhaError && <Alert severity="error">{system(senhaError)}</Alert>}
              </div>
            </DialogContent>
            <DialogActions>
              <Button type="button" disabled={senhaSaving} onClick={() => fecharTrocaSenha()}>{tr('Cancelar')}</Button>
              <Button type="submit" variant="contained" disabled={senhaSaving || !senhaAtual || !senhaNova || !senhaConfirmacao}>{tr('Salvar nova senha')}</Button>
            </DialogActions>
          </form>
        </Dialog>
        <Dialog open={conexoesDialog && canManageOwnData && Boolean(usuario)} onClose={() => dispatch({ field: 'conexoesDialog', value: false })} fullWidth maxWidth="md">
          <DialogTitle>{tr('Conexões ativas')}</DialogTitle>
          <DialogContent>
            {conexoesLoading && <LinearProgress sx={{ mb: 2 }} />}
            {conexoesError && <Alert severity="error" sx={{ mb: 2 }}>{system(conexoesError)}</Alert>}
            {!conexoesLoading && !conexoesError && (conexoes.length ? <TableContainer><Table aria-label={tr('Conexões ativas')}>
              <TableHead><TableRow><TableCell>{tr('INÍCIO')}</TableCell><TableCell>{tr('IP')}</TableCell><TableCell>{tr('DISPOSITIVO')}</TableCell><TableCell>{tr('VALIDADE')}</TableCell><TableCell>{tr('AÇÕES')}</TableCell></TableRow></TableHead>
              <TableBody>{conexoes.map((conexao) => <TableRow key={conexao.idLogin}>
                <TableCell>{dataConexao(conexao.inicio)}{conexao.atual && <Chip size="small" sx={{ ml: 1 }} label={tr('Esta conexão')} />}</TableCell>
                <TableCell>{conexao.enderecoIp}</TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 320 }}>{conexao.agente}</TableCell>
                <TableCell>{dataConexao(conexao.validade)}</TableCell>
                <TableCell><Button size="small" color="error" onClick={() => { dispatch({ field: 'conexaoParaEncerrar', value: conexao }); dispatch({ field: 'conexoesActionError', value: '' }); }}>{tr('Encerrar')}</Button></TableCell>
              </TableRow>)}</TableBody>
            </Table></TableContainer> : <Alert severity="info">{tr('Nenhuma conexão ativa encontrada.')}</Alert>)}
          </DialogContent>
          <DialogActions>
            <Button disabled={conexoesLoading} onClick={carregarConexoes}>{tr('Atualizar')}</Button>
            <Button onClick={() => dispatch({ field: 'conexoesDialog', value: false })}>{tr('Fechar')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={Boolean(conexaoParaEncerrar)} onClose={() => { if (!conexoesSaving) dispatch({ field: 'conexaoParaEncerrar', value: null }); }} fullWidth maxWidth="xs">
          <DialogTitle>{tr('Encerrar conexão')}</DialogTitle>
          <DialogContent>
            <p>{tr('Deseja encerrar a conexão de')} <strong>{conexaoParaEncerrar?.enderecoIp}</strong>?</p>
            {conexaoParaEncerrar?.atual && <Alert severity="warning">{tr('Esta é sua conexão atual. Você voltará à tela de login.')}</Alert>}
            {conexoesActionError && <Alert severity="error" sx={{ mt: 2 }}>{system(conexoesActionError)}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button disabled={conexoesSaving} onClick={() => dispatch({ field: 'conexaoParaEncerrar', value: null })}>{tr('Cancelar')}</Button>
            <Button color="error" variant="contained" disabled={conexoesSaving} onClick={encerrarConexao}>{tr('Encerrar conexão')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!groupEdit && groupManager}
          onClose={() => dispatch({ field: 'groupEdit', value: null })}
        >
          <DialogTitle>
            {groupEdit?.idGrupo
              ? tr('Editar grupo')
              : tr('Novo grupo')}
          </DialogTitle>
          <DialogContent>
            {groupEdit && (
              <div className="dialog-fields">
                <TextField
                  label={tr('Nome do grupo')}
                  autoFocus
                  value={groupEdit.nome}
                  onChange={(e) =>
                    dispatch({
                      field: 'groupEdit',
                      value: { ...groupEdit, nome: e.target.value },
                    })
                  }
                  inputProps={{ maxLength: 50 }}
                />
                {groupEdit.idGrupo && <FormControlLabel control={<Checkbox checked={groupEdit.ativo} onChange={(e) => dispatch({ field: 'groupEdit', value: { ...groupEdit, ativo: e.target.checked } })} />} label={tr('Grupo ativo')} />}
                <div>
                  <strong>{tr('Tags do grupo')}</strong>
                  <p className="muted">{tr('Selecione as tags aplicáveis a grupos.')}</p>
                  {(organizacao?.tags || []).filter((tag) => tag.grupo || groupEdit.tags.includes(tag.codigo)).map((tag) => (
                    <FormControlLabel
                      key={tag.codigo}
                      sx={{ display: 'flex' }}
                      control={<Checkbox checked={groupEdit.tags.includes(tag.codigo)} disabled={!tag.ativo && !groupEdit.tags.includes(tag.codigo)} onChange={(e) => dispatch({ field: 'groupEdit', value: { ...groupEdit, tags: e.target.checked ? [...groupEdit.tags, tag.codigo] : groupEdit.tags.filter((codigo) => codigo !== tag.codigo) } })} />}
                      label={`${tag.codigo}${tag.descricao ? ` — ${tag.descricao}` : ''}${!tag.ativo ? ` (${tr('Inativa')})` : ''}`}
                    />
                  ))}
                  {!organizacao?.tags?.some((tag) => tag.grupo || groupEdit.tags.includes(tag.codigo)) && <p className="muted">{tr('Nenhuma tag de grupo cadastrada.')}</p>}
                </div>
                <p className="muted">{tr('Os participantes serão vinculados ao grupo em uma etapa posterior.')}</p>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => dispatch({ field: 'groupEdit', value: null })}
            >
              {tr('Cancelar')}
            </Button>
            <Button
              variant="contained"
              disabled={!groupEdit?.nome.trim() || organizacaoSaving}
              onClick={salvarGrupo}
            >
              {tr('Salvar grupo')}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={!!tagEdit && groupManager} onClose={() => dispatch({ field: 'tagEdit', value: null })}>
          <DialogTitle>{tr(tagEdit?.editando ? 'Editar tag' : 'Criar tag')}</DialogTitle>
          <DialogContent>
            {tagEdit && <div className="dialog-fields">
              <TextField label={tr('Código da tag')} autoFocus={!tagEdit.editando} disabled={tagEdit.editando} value={tagEdit.codigo} inputProps={{ maxLength: 30 }} helperText={tagEdit.editando ? tr('O código da tag não pode ser alterado.') : undefined} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, codigo: e.target.value } })} />
              <TextField label={tr('Descrição')} value={tagEdit.descricao} inputProps={{ maxLength: 255 }} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, descricao: e.target.value } })} />
              <p className="muted">{tr('Onde esta tag poderá ser utilizada?')}</p>
              <FormControlLabel control={<Checkbox checked={tagEdit.grupo} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, grupo: e.target.checked } })} />} label={tr('Tag de Grupo')} />
              <FormControlLabel control={<Checkbox checked={tagEdit.usuario} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, usuario: e.target.checked } })} />} label={tr('Tag de Usuário')} />
              <FormControlLabel control={<Checkbox checked={tagEdit.vinculo} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, vinculo: e.target.checked } })} />} label={tr('Tag de Vínculo')} />
              {tagEdit.editando && <FormControlLabel control={<Checkbox checked={tagEdit.ativo} onChange={(e) => dispatch({ field: 'tagEdit', value: { ...tagEdit, ativo: e.target.checked } })} />} label={tr('Tag ativa')} />}
            </div>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => dispatch({ field: 'tagEdit', value: null })}>{tr('Cancelar')}</Button>
            <Button variant="contained" disabled={!tagEdit?.codigo.trim() || !(tagEdit?.grupo || tagEdit?.usuario || tagEdit?.vinculo) || organizacaoSaving} onClick={salvarTag}>{tr('Salvar tag')}</Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={personOpen && admin}
          onClose={() => dispatch({ field: 'personOpen', value: false })}
        >
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
                onChange={(e) =>
                  dispatch({ field: 'personName', value: e.target.value })
                }
              />
              <TextField
                select
                label={tr('Perfil')}
                value={personRole}
                onChange={(e) =>
                  dispatch({ field: 'personRole', value: e.target.value })
                }
              >
                <MenuItem value="participant">{tr('Participante')}</MenuItem>
                <MenuItem value="designer">{tr('Criador de modelos')}</MenuItem>
                <MenuItem value="admin">{tr('Administrador')}</MenuItem>
              </TextField>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => dispatch({ field: 'personOpen', value: false })}
            >
              {tr('Cancelar')}
            </Button>
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
                      {
                        id: uid(),
                        name: personName.trim(),
                        role: personRole,
                      },
                    ],
                  })
                ) {
                  dispatch({ field: 'personOpen', value: false });
                  dispatch({
                    field: 'toast',
                    value: {
                      text: 'Pessoa adicionada à demonstração.',
                      error: false,
                    },
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
          onClose={() => dispatch({ field: 'toast', value: null })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={toast?.error ? 'error' : 'success'}
            onClose={() => dispatch({ field: 'toast', value: null })}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {system(toast?.text || '')}
          </Alert>
        </Snackbar>
      </div>
    </WorkspaceContext.Provider>
  );
}
