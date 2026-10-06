'use client';
import { pageReducer } from '../../utils/page-state.js';
import { useEffect, createContext, useMemo, useReducer, useRef } from 'react';
import { accountId } from '../../programas/plataforma/users.js';
import {
  readProfile,
  saveProfile,
  validateProfile,
} from '../../programas/plataforma/profile.js';
import { readStore } from '../../programas/documentos/storage.js';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Alert,
} from '@mui/material';
import { LanguageSelect, useI18n } from '../../components/i18n/i18n.js';
export const UserSettingsContext = createContext({});
export default function UserSettings() {
  const initialState = useMemo(
    () => ({
      telaAtual: 'UserSettings',
      loading: false,
      profile: null,
      errors: {},
      message: null,
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { profile, errors, message } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t } = useI18n();

  useEffect(() => {
    try {
      const id = accountId(sessionStorage.getItem('argousdocs:session'));
      if (!id) throw Error('Entre novamente para salvar seu cadastro.');
      const person =
        id === 'admin' ? readStore().people.find((p) => p.id === id) : null;
      // Hydrate the browser-only profile when opening settings.
      // oxlint-disable-next-line react/react-compiler
      dispatch({
        field: 'profile',
        value: readProfile(id, {
          name: person?.name || 'Administrador da plataforma',
          email:
            person?.email ||
            (id === 'admin' ? 'teste@argous.com.br' : 'adm@argous.com.br'),
        }),
      });
    } catch {
      dispatch({
        field: 'message',
        value: {
          error: true,
          text: 'Não foi possível carregar seu cadastro.',
        },
      });
    }
  }, []);
  const update = (key, value) => {
    dispatch({
      field: 'profile',
      value: (current) => ({ ...current, [key]: value }),
    });
    dispatch({ field: 'message', value: null });
  };

  return (
    <UserSettingsContext.Provider value={contextValues}>
      <section className="panel">
        {message && (
          <Alert severity={message.error ? 'error' : 'success'}>
            {t(message.text)}
          </Alert>
        )}
        {profile && (
          <Box
            component="form"
            noValidate
            sx={{ p: 3 }}
            onSubmit={(event) => {
              event.preventDefault();
              const nextErrors = validateProfile(profile);
              dispatch({ field: 'errors', value: nextErrors });
              if (Object.keys(nextErrors).length) return;
              try {
                dispatch({ field: 'profile', value: saveProfile(profile) });
                dispatch({
                  field: 'message',
                  value: { text: 'Cadastro salvo.' },
                });
              } catch {
                dispatch({
                  field: 'message',
                  value: {
                    error: true,
                    text: 'Não foi possível salvar seu cadastro. Tente novamente.',
                  },
                });
              }
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('Dados cadastrais')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              {[
                ['name', 'Nome', 'text', true],
                ['birthDate', 'Data de nascimento', 'date', true],
                ['cpf', 'CPF', 'text', true],
                ['email', 'E-mail', 'email', true],
                ['phone', 'Telefone', 'tel', false],
              ].map(([key, label, type, required]) => (
                <TextField
                  key={key}
                  label={t(label)}
                  type={type}
                  required={required}
                  value={profile[key]}
                  onChange={(event) => update(key, event.target.value)}
                  error={Boolean(errors[key])}
                  helperText={errors[key] ? t(errors[key]) : undefined}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ))}
              <TextField
                select
                label={t('Gênero')}
                value={profile.gender}
                onChange={(event) => update('gender', event.target.value)}
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
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mt: 2 }}
            >
              {t('O e-mail cadastral não altera o login de demonstração.')}
            </Typography>
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>
              {t('Salvar')}
            </Button>
          </Box>
        )}

        <div className="panel-heading">
          <h2>{t('Preferências do usuário')}</h2>
        </div>
        <Box
          sx={{
            p: 3,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 3,
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Typography fontWeight={600}>{t('Idioma')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('A preferência de idioma é salva neste navegador.')}
            </Typography>
          </div>
          <LanguageSelect />
        </Box>
      </section>
    </UserSettingsContext.Provider>
  );
}
