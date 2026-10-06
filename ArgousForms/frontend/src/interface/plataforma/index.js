'use client';
import { pageReducer } from '../../utils/page-state.js';
import PlatformUsers from './users.js';
import PlatformClients from './clients.js';
import UserSettings from '../configuracoes/index.js';
import {
  useEffect,
  createContext,
  useMemo,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import PlatformNavigation from './navigation.js';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { ChevronRight, Menu } from 'lucide-react';
import { ThemeToggle } from '../../components/theme/theme.js';
import { readStore } from '../../programas/documentos/storage.js';
import {
  logout,
  readPlatform,
  sessionRole,
} from '../../programas/plataforma/access.js';
export const PlatformContext = createContext({});
export default function Platform() {
  const initialState = useMemo(
    () => ({
      telaAtual: 'Platform',
      loading: false,
      view: 'overview',
      mobile: false,
      data: null,
      workspace: null,
      error: '',
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { view, data, workspace, error } = pageState;
  // The current local installation has one registered company, not a remote client registry.
  const clients = useMemo(
    () =>
      workspace
        ? [
            {
              id: 'test-company',
              name: 'Empresa de teste',
              users: workspace.people.length,
              documents: workspace.documents.length,
              templates: workspace.templates.length,
            },
          ]
        : [],
    [workspace],
  );

  const { t } = useI18n();

  const refresh = useCallback(() => {
    try {
      if (sessionRole() !== 'platform') {
        window.location.replace('/login');
        return;
      }
      dispatch({ field: 'data', value: readPlatform() });
      dispatch({ field: 'workspace', value: readStore() });
      dispatch({ field: 'error', value: '' });
    } catch (e) {
      dispatch({ field: 'error', value: e.message });
    }
  }, []);
  useEffect(() => {
    // Hydrate browser-only demo storage after server rendering.
    // oxlint-disable-next-line react/react-compiler
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [refresh]);
  const companyAccesses =
    data?.accesses.filter((access) => access.role === 'company') || [];
  const active =
    workspace?.people.filter((person) => !data.disabledIds.includes(person.id))
      .length || 0;
  const title =
    view === 'users'
      ? t('Usuários')
      : view === 'clients'
        ? t('Clientes')
        : view === 'settings'
          ? t('Configurações do usuário')
          : t('Administração da plataforma');
  const signOut = useCallback(() => {
    logout();
    window.location.href = '/login';
  }, []);
  const contextValues = useMemo(() => {
    const { telaAtual: _telaAtual, loading: _loading, ...value } = pageState;
    return {
      telaAtual: value.view,
      loading: !value.data && !value.error,
      value: { ...value, clients },
      dispatch,
      initialStateRef,
      refresh,
      signOut,
    };
  }, [pageState, clients, refresh, signOut]);
  return (
    <PlatformContext.Provider value={contextValues}>
      <div className="app-shell">
        <PlatformNavigation />
        <div className="app-body">
          <header className="topbar no-print">
            <div className="breadcrumbs">
              <IconButton
                className="mobile-menu"
                aria-label={t('Abrir navegação')}
                onClick={() => dispatch({ field: 'mobile', value: true })}
              >
                <Menu size={22} />
              </IconButton>
              <span>{t('Administração da plataforma')}</span>
              <ChevronRight size={14} />
              <strong>{view === 'overview' ? t('Visão geral') : title}</strong>
            </div>
            <div className="participant-picker">
              <ThemeToggle />
            </div>
          </header>
          <Box component="main" className="workspace-main">
            <div className="page-heading">
              <div>
                <h1>{title}</h1>
              </div>
              {view === 'overview' && (
                <Button variant="outlined" onClick={refresh}>
                  {t('Atualizar')}
                </Button>
              )}
            </div>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {t(error)}
              </Alert>
            )}
            {data && workspace && view === 'overview' && (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                    mb: 4,
                  }}
                >
                  {[
                    [t('Clientes'), clients.length],
                    [t('Usuários ativos'), active],
                    [t('Acessos da empresa'), companyAccesses.length],
                  ].map(([label, value]) => (
                    <Paper
                      className="stat-card"
                      key={label}
                      variant="outlined"
                      sx={{ p: 3 }}
                    >
                      <Typography color="text.secondary">{label}</Typography>
                      <Typography variant="h3" sx={{ mt: 1 }}>
                        {value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </>
            )}
            {data && workspace && view === 'users' && <PlatformUsers />}
            {data && workspace && view === 'clients' && <PlatformClients />}
            {data && workspace && view === 'settings' && <UserSettings />}
          </Box>
        </div>
      </div>
    </PlatformContext.Provider>
  );
}
