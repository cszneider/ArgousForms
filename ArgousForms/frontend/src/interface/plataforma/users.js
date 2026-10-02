'use client';
import UserDetails from './user-details.js';
import { readProfile } from '../../programas/plataforma/profile.js';
import { useState } from 'react';
import {
  Box,
  Chip,
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
export default function PlatformUsers({ people, disabledIds, onChange }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    company: '',
    status: '',
    language: '',
  });
  const rows = filterUsers(
    userRows(people, disabledIds, (id) =>
      localStorage.getItem(USER_LANGUAGE_PREFIX + id),
    ),
    filters,
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
      <UserDetails
        key={selected.id}
        user={selected}
        onBack={() => setSelected(null)}
        onChange={onChange}
      />
    );
  return (
    <section className="panel">
      <Box sx={{ p: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {[
          [
            'company',
            'Empresa',
            [
              ['platform', 'Plataforma'],
              ['test-company', 'Empresa de teste'],
            ],
          ],
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
            onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
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
                onClick={() => setSelected(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(row);
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
                  <Chip
                    size="small"
                    color={row.active ? 'success' : 'default'}
                    label={t(row.active ? 'Ativo' : 'Inativo')}
                  />
                </TableCell>
                <TableCell>
                  {languages[row.language] || t('Não configurado')}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  {t('Nenhum usuário encontrado para os filtros selecionados.')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </section>
  );
}
