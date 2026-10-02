'use client';
import PlatformUsers from './users.js';
import UserSettings from '../configuracoes/index.js';
import { useEffect, useState } from 'react';
import PlatformNavigation from './navigation.js';
import FrontendKnowledge from './frontend-knowledge.js';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  setUserEnabled,
} from '../../programas/plataforma/access.js';
export default function Platform() {
  const { t, locale } = useI18n();
  const [view, setView] = useState('overview');
  const [mobile, setMobile] = useState(false);
  const [data, setData] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const refresh = () => {
    try {
      if (sessionRole() !== 'platform') {
        window.location.replace('/login');
        return;
      }
      setData(readPlatform());
      setWorkspace(readStore());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    // Hydrate browser-only demo storage after server rendering.
    // oxlint-disable-next-line react/react-compiler
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  const date = (value) => new Date(value).toLocaleString(locale);
  const companyAccesses =
    data?.accesses.filter((access) => access.role === 'company') || [];
  const active =
    workspace?.people.filter((person) => !data.disabledIds.includes(person.id))
      .length || 0;
  const title =
    view === 'users'
      ? t('Usuários')
      : view === 'settings'
        ? t('Configurações do usuário')
        : view === 'overview'
          ? t('Administração da plataforma')
          : view === 'backend'
            ? 'Backend'
            : 'Frontend';
  const signOut = () => {
    logout();
    window.location.href = '/login';
  };
  return (
    <div className="app-shell">
      <PlatformNavigation
        view={view}
        onSelect={setView}
        mobile={mobile}
        onClose={() => setMobile(false)}
        onLogout={signOut}
      />
      <div className="app-body">
        <header className="topbar no-print">
          <div className="breadcrumbs">
            <IconButton
              className="mobile-menu"
              aria-label={t('Abrir navegação')}
              onClick={() => setMobile(true)}
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
              <span className="eyebrow">
                {['overview', 'settings', 'users'].includes(view)
                  ? 'ARGOUSDOCS'
                  : t('Base de conhecimento')}
              </span>
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
                  [t('Clientes'), 1],
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
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h5">{t('Clientes')}</Typography>
              </Stack>
              <Paper className="panel" variant="outlined" sx={{ p: 3, mb: 4 }}>
                <Stack direction="row" gap={2} alignItems="center" mb={1}>
                  <Typography variant="h6">{t('Empresa de teste')}</Typography>
                  <Chip size="small" label={t('Ambiente local')} />
                </Stack>
                <Typography color="text.secondary">
                  {t('Administrador da empresa')}: teste@argous.com.br
                </Typography>
                <Typography color="text.secondary">
                  {t('Documentos')}: {workspace.documents.length} ·{' '}
                  {t('Modelos')}: {workspace.templates.length} · {t('Usuários')}
                  : {workspace.people.length}
                </Typography>
                <Typography color="text.secondary">
                  {t('Último acesso')}:{' '}
                  {companyAccesses.length
                    ? date(companyAccesses.at(-1).at)
                    : t('Nenhum acesso registrado')}
                </Typography>
              </Paper>
              <Typography variant="h5" mb={2}>
                {t('Controle de usuários')}
              </Typography>
              <Typography color="text.secondary" mb={2}>
                {t(
                  'Desativar impede o acesso de teste ou a seleção do participante na empresa. Os dados e as responsabilidades são preservados.',
                )}
              </Typography>
              <TableContainer
                component={Paper}
                className="panel"
                variant="outlined"
                sx={{ mb: 4 }}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      {['Nome', 'Perfil', 'Ativo'].map((label) => (
                        <TableCell key={label}>{t(label)}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workspace.people.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell>
                          {person.name}
                          {person.id === 'admin' && (
                            <Typography variant="caption" display="block">
                              teste@argous.com.br
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {t(
                            person.role === 'admin'
                              ? 'Administrador da empresa'
                              : 'Participante',
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!data.disabledIds.includes(person.id)}
                            slotProps={{
                              input: {
                                'aria-label': `${t('Ativo')}: ${person.name}`,
                              },
                            }}
                            onChange={(_, enabled) => {
                              try {
                                setData(
                                  setUserEnabled(
                                    person.id,
                                    enabled,
                                    readStore().people,
                                  ),
                                );
                                setError('');
                              } catch (e) {
                                setError(e.message);
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="h5" mb={2}>
                {t('Acessos recentes')}
              </Typography>
              <TableContainer
                component={Paper}
                className="panel"
                variant="outlined"
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Data e hora')}</TableCell>
                      <TableCell>{t('Perfil')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.accesses
                      .slice(-20)
                      .reverse()
                      .map((access, index) => (
                        <TableRow key={index}>
                          <TableCell>{date(access.at)}</TableCell>
                          <TableCell>
                            {t(
                              access.role === 'platform'
                                ? 'Administrador da plataforma'
                                : 'Administrador da empresa',
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    {!data.accesses.length && (
                      <TableRow>
                        <TableCell colSpan={2}>
                          {t('Nenhum acesso registrado')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          {data && workspace && view === 'users' && (
            <PlatformUsers
              onChange={refresh}
              people={workspace.people}
              disabledIds={data.disabledIds}
            />
          )}
          {data && workspace && view === 'settings' && <UserSettings />}
          {data && workspace && ['frontend', 'backend'].includes(view) && (
            <Paper
              className="panel"
              variant="outlined"
              sx={{ p: { xs: 3, md: 5 } }}
            >
              <Typography variant="overline" color="primary">
                {t('Base de conhecimento')}
              </Typography>
              <Typography variant="h5" component="h1" gutterBottom>
                {view === 'backend' ? 'Backend' : 'Frontend'}
              </Typography>
              {view === 'frontend' ? (
                <FrontendKnowledge />
              ) : (
                <Typography color="text.secondary">
                  {t('Nenhum conteúdo cadastrado nesta seção.')}
                </Typography>
              )}
            </Paper>
          )}
        </Box>
      </div>
    </div>
  );
}
