'use client';
import { PlatformContext } from './index.js';
import { PlatformUsersContext } from './users.js';
import { pageReducer } from '../../utils/page-state.js';
import UserStatus from '../../components/user-status.js';
import { createContext, useMemo, useReducer, useRef, useContext } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  IconButton,
  Tooltip,
  TextField,
  Typography,
} from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  readProfile,
  validateProfile,
} from '../../programas/plataforma/profile.js';
import {
  deleteManagedUser,
  saveManagedProfile,
} from '../../programas/plataforma/user-management.js';
import { readStore } from '../../programas/documentos/storage.js';
import {
  isEnabled,
  setUserEnabled,
} from '../../programas/plataforma/access.js';
export const UserDetailsContext = createContext({});
export default function UserDetails() {
  const { value: usersValue, dispatch: usersDispatch } =
    useContext(PlatformUsersContext);
  const { refresh: onChange } = useContext(PlatformContext);
  const user = usersValue.selected;
  const onBack = () => usersDispatch({ field: 'selected', value: null });
  const initialState = useMemo(
    () => ({
      telaAtual: 'UserDetails',
      loading: false,
      profile: readProfile(user.id, user),
      expected: JSON.stringify(readProfile(user.id)),
      editing: false,
      errors: {},
      message: null,
      confirm: false,
    }),
    [user],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { profile, expected, editing, errors, message, confirm } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t } = useI18n();

  const active = user.id === 'platform-admin' || isEnabled(user.id);
  const back = () => {
    if (!editing || window.confirm(t('Descartar alterações não salvas?')))
      onBack();
  };
  return (
    <UserDetailsContext.Provider value={contextValues}>
      <section className="panel">
        <Box sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mb: 1,
            }}
          >
            <Typography variant="h6">{profile.name}</Typography>
            <Tooltip title={t('Voltar à lista')}>
              <IconButton aria-label={t('Voltar à lista')} onClick={back}>
                <ArrowLeft size={22} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              mb: 3,
            }}
          >
            <Chip
              size="small"
              variant="outlined"
              label={t(
                user.company === 'platform' ? 'Plataforma' : 'Empresa de teste',
              )}
            />
            <UserStatus active={active} />
          </Box>
          {message && (
            <Alert
              severity={message.error ? 'error' : 'success'}
              sx={{ mb: 2 }}
            >
              {t(message.text)}
            </Alert>
          )}
          <Box
            component="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) return;
              const next = validateProfile(profile);
              dispatch({ field: 'errors', value: next });
              if (Object.keys(next).length) return;
              try {
                dispatch({
                  field: 'profile',
                  value: saveManagedProfile(user.id, profile, expected),
                });
                dispatch({
                  field: 'expected',
                  value: JSON.stringify(readProfile(user.id)),
                });
                dispatch({ field: 'editing', value: false });
                dispatch({
                  field: 'message',
                  value: { text: 'Cadastro salvo.' },
                });
                onChange();
              } catch (e) {
                dispatch({
                  field: 'message',
                  value: { error: true, text: e.message },
                });
              }
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              {[
                ['name', 'Nome', 'text', true],
                ['email', 'E-mail', 'email', true],
                ['cpf', 'CPF', 'text', true],
                ['birthDate', 'Data de nascimento', 'date', true],
                ['phone', 'Telefone', 'tel', false],
              ].map(([key, label, type, required]) => (
                <TextField
                  key={key}
                  label={t(label)}
                  type={type}
                  required={required}
                  value={profile[key]}
                  onChange={(e) =>
                    dispatch({
                      field: 'profile',
                      value: { ...profile, [key]: e.target.value },
                    })
                  }
                  slotProps={{
                    input: { readOnly: !editing },
                    inputLabel: { shrink: true },
                  }}
                  error={Boolean(errors[key])}
                  helperText={errors[key] && t(errors[key])}
                />
              ))}
              <TextField
                select
                disabled={!editing}
                label={t('Gênero')}
                value={profile.gender}
                onChange={(e) =>
                  dispatch({
                    field: 'profile',
                    value: { ...profile, gender: e.target.value },
                  })
                }
              >
                {[
                  '',
                  'Feminino',
                  'Masculino',
                  'Não binário',
                  'Outro',
                  'Prefiro não informar',
                ].map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(value || 'Não informado')}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Typography variant="body2" sx={{ my: 2 }}>
              {t('O e-mail cadastral não altera o login de demonstração.')}
            </Typography>
            <Box
              sx={{
                display: editing ? 'grid' : 'flex',
                flexWrap: 'wrap',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: editing
                    ? 'repeat(2, minmax(150px, 190px))'
                    : 'repeat(3, minmax(130px, 170px))',
                },
                justifyContent: 'end',
                gap: 1.5,
                mt: 3,
              }}
            >
              {editing && (
                <>
                  <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    type="submit"
                  >
                    {t('Salvar')}
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    onClick={() => {
                      dispatch({
                        field: 'profile',
                        value: readProfile(user.id, user),
                      });
                      dispatch({
                        field: 'expected',
                        value: JSON.stringify(readProfile(user.id)),
                      });
                      dispatch({ field: 'editing', value: false });
                      dispatch({ field: 'errors', value: {} });
                    }}
                  >
                    {t('Cancelar')}
                  </Button>
                </>
              )}
              {!editing && (
                <>
                  <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    color="error"
                    sx={{ width: { xs: '100%', sm: 170 } }}
                    disabled={editing || user.id === 'platform-admin'}
                    onClick={() => dispatch({ field: 'confirm', value: true })}
                  >
                    {t('Excluir')}
                  </Button>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 1.5,
                      width: { xs: '100%', sm: 352 },
                      ml: { sm: 'auto' },
                    }}
                  >
                    <Button
                      fullWidth
                      variant="contained"
                      size="medium"
                      color="info"
                      disabled={editing || user.id === 'platform-admin'}
                      onClick={() => {
                        try {
                          setUserEnabled(user.id, !active, readStore().people);
                          onChange();
                          dispatch({ field: 'message', value: null });
                        } catch (e) {
                          dispatch({
                            field: 'message',
                            value: { error: true, text: e.message },
                          });
                        }
                      }}
                    >
                      {t(active ? 'Inativar' : 'Reativar')}
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      size="medium"
                      color="success"
                      disabled={editing}
                      onClick={() =>
                        dispatch({ field: 'editing', value: true })
                      }
                    >
                      {t('Editar')}
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Box>
          <Dialog
            open={confirm}
            onClose={() => dispatch({ field: 'confirm', value: false })}
          >
            <DialogTitle>{t('Excluir usuário')}</DialogTitle>
            <DialogContent>
              <Typography>{profile.name}</Typography>
              <Typography>
                {t(
                  'Confirma a exclusão deste usuário? Esta ação não pode ser desfeita.',
                )}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                fullWidth
                variant="contained"
                size="medium"
                onClick={() => dispatch({ field: 'confirm', value: false })}
              >
                {t('Cancelar')}
              </Button>
              <Button
                fullWidth
                variant="contained"
                size="medium"
                color="error"
                onClick={() => {
                  dispatch({ field: 'confirm', value: false });
                  try {
                    deleteManagedUser(user.id);
                    onChange();
                    onBack();
                  } catch (e) {
                    dispatch({
                      field: 'message',
                      value: { error: true, text: e.message },
                    });
                  }
                }}
              >
                {t('Excluir')}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </section>
    </UserDetailsContext.Provider>
  );
}
