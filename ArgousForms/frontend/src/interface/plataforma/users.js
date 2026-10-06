'use client';
import { PlatformContext } from './index.js';
import { pageReducer } from '../../utils/page-state.js';
import UserStatus from '../../components/user-status.js';
import UserDetails from './user-details.js';
import { readProfile } from '../../programas/plataforma/profile.js';
import { createContext, useMemo, useReducer, useRef, useContext } from 'react';
import {
  Box,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  filterUsers,
  userRows,
  USER_LANGUAGE_PREFIX,
} from '../../programas/plataforma/users.js';
export const PlatformUsersContext = createContext({});
export default function PlatformUsers() {
  const { value: platformValue } = useContext(PlatformContext);
  const { disabledIds } = platformValue.data;
  const initialState = useMemo(
    () => ({
      telaAtual: 'PlatformUsers',
      loading: false,
      selected: null,
      filters: {
        status: '',
        language: '',
      },
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { selected, filters } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t } = useI18n();

  const rows = filterUsers(
    userRows([], disabledIds, (id) =>
      localStorage.getItem(USER_LANGUAGE_PREFIX + id),
    ),
    { ...filters, company: 'platform' },
  );
  rows.forEach((row) => {
    const profile = readProfile(row.id, row);
    row.name = profile.name;
    row.email = profile.email;
  });
  const languages = {
    'pt-BR': 'Português',
    'en-US': 'English',
    'es-ES': 'Español',
  };
  if (selected)
    return (
      <PlatformUsersContext.Provider value={contextValues}>
        <UserDetails key={selected.id} />
      </PlatformUsersContext.Provider>
    );
  return (
    <PlatformUsersContext.Provider value={contextValues}>
      <section className="panel">
        <Box sx={{ p: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[
            [
              'status',
              'Status',
              [
                ['active', 'Ativo'],
                ['inactive', 'Inativo'],
              ],
            ],
            [
              'language',
              'Idioma',
              [...Object.entries(languages), ['unset', 'Não configurado']],
            ],
          ].map(([key, label, options]) => (
            <TextField
              select
              key={key}
              label={t(label)}
              value={filters[key]}
              onChange={(e) =>
                dispatch({
                  field: 'filters',
                  value: { ...filters, [key]: e.target.value },
                })
              }
              sx={{ minWidth: 200, flex: 1 }}
            >
              <MenuItem value="">{t('Todos')}</MenuItem>
              {options.map(([value, text]) => (
                <MenuItem key={value} value={value}>
                  {t(text)}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Nome', 'E-mail', 'Empresa', 'Status', 'Idioma'].map(
                  (label) => (
                    <TableCell key={label}>{t(label)}</TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  tabIndex={0}
                  onClick={() => dispatch({ field: 'selected', value: row })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      dispatch({ field: 'selected', value: row });
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <TableCell>
                    {row.name === 'Administrador da plataforma'
                      ? t(row.name)
                      : row.name}
                  </TableCell>
                  <TableCell>{row.email || '—'}</TableCell>
                  <TableCell>
                    {t(
                      row.company === 'platform'
                        ? 'Plataforma'
                        : 'Empresa de teste',
                    )}
                  </TableCell>
                  <TableCell>
                    <UserStatus active={row.active} />
                  </TableCell>
                  <TableCell>
                    {languages[row.language] || t('Não configurado')}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={5}>
                    {t(
                      'Nenhum usuário encontrado para os filtros selecionados.',
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    </PlatformUsersContext.Provider>
  );
}
