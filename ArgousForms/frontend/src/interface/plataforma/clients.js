'use client';
import { createContext, useContext, useMemo, useReducer, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { pageReducer } from '../../utils/page-state.js';
import {
  Box,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { PlatformContext } from './index.js';
import { useI18n } from '../../components/i18n/i18n.js';

export const ClientsContext = createContext({});

export default function PlatformClients() {
  const {
    value: { clients },
  } = useContext(PlatformContext);
  const initialState = useMemo(() => ({ selectedClientId: null }), []);
  const initialStateRef = useRef(initialState);
  const [state, dispatch] = useReducer(pageReducer, initialState);
  const client = clients.find((item) => item.id === state.selectedClientId);
  const contextValues = useMemo(
    () => ({
      telaAtual: client ? 'details' : 'list',
      loading: false,
      value: { ...state, client },
      dispatch,
      initialStateRef,
    }),
    [state, client],
  );
  const { t } = useI18n();
  const openClient = (id) => dispatch({ field: 'selectedClientId', value: id });
  return (
    <ClientsContext.Provider value={contextValues}>
      <section className="panel">
        {client ? (
          <CompanyDetails />
        ) : (
          <TableContainer>
            <Table aria-label={t('Clientes')}>
              <TableHead>
                <TableRow>
                  {['Empresa', 'Usuários', 'Documentos', 'Modelos'].map(
                    (label, index) => (
                      <TableCell key={label} align={index ? 'right' : 'left'}>
                        {t(label)}
                      </TableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow
                    key={client.id}
                    hover
                    tabIndex={0}
                    onClick={() => openClient(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openClient(client.id);
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
                    <TableCell component="th" scope="row">
                      {t(client.name)}
                    </TableCell>
                    <TableCell align="right">{client.users}</TableCell>
                    <TableCell align="right">{client.documents}</TableCell>
                    <TableCell align="right">{client.templates}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>
    </ClientsContext.Provider>
  );
}

export function CompanyDetails() {
  const {
    value: { client },
    dispatch,
  } = useContext(ClientsContext);
  const { t } = useI18n();
  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6">{t(client.name)}</Typography>
          <Typography color="text.secondary">
            {t('Cadastro da empresa')}
          </Typography>
        </Box>
        <Tooltip title={t('Voltar à lista')}>
          <IconButton
            aria-label={t('Voltar à lista')}
            onClick={() => dispatch({ field: 'selectedClientId', value: null })}
          >
            <ArrowLeft size={22} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        {[
          ['legalName', 'Razão social'],
          ['tradeName', 'Nome fantasia'],
          ['cnpj', 'CNPJ'],
          ['contactName', 'Responsável pelo contato'],
          ['email', 'E-mail'],
          ['phone', 'Telefone'],
          ['address', 'Endereço'],
        ].map(([key, label]) => (
          <TextField
            key={key}
            label={t(label)}
            value={client[key] || ''}
            placeholder={t('Não informado')}
            slotProps={{
              input: { readOnly: true },
              inputLabel: { shrink: true },
            }}
            multiline={key === 'address'}
            minRows={key === 'address' ? 2 : undefined}
            sx={key === 'address' ? { gridColumn: '1 / -1' } : undefined}
          />
        ))}
        <TextField
          label={t('Quantidade de usuários')}
          value={client.users}
          slotProps={{
            input: { readOnly: true },
            inputLabel: { shrink: true },
          }}
        />
      </Box>
    </Box>
  );
}
