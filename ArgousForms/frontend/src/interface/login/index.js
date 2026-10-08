'use client';
import { pageReducer } from '../../utils/page-state.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { createContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { loginDemo } from '../../programas/plataforma/access.js';
import {
  consultarDiagnostico,
  verificacoes,
} from '../../programas/login/diagnostico.js';
import {
  Button,
  TextField,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import AccessLayout from '../../components/acesso/layout.js';
export const LoginContext = createContext({});
export default function Login() {
  const initialState = useMemo(
    () => ({
      telaAtual: 'Login',
      loading: false,
      email: '',
      password: '',
      show: false,
      error: '',
      diagnosticos: Object.fromEntries(
        verificacoes.map(({ operacao }) => [operacao, { estado: 'pendente' }]),
      ),
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { email, password, show, error, diagnosticos } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t: tr, system } = useI18n();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const { operacao } of verificacoes) {
        consultarDiagnostico(operacao, { signal: controller.signal }).then(
          () => {
            if (!controller.signal.aborted)
              dispatch({
                field: 'diagnosticos',
                value: (anterior) => ({
                  ...anterior,
                  [operacao]: { estado: 'sucesso' },
                }),
              });
          },
          (falha) => {
            if (!controller.signal.aborted)
              dispatch({
                field: 'diagnosticos',
                value: (anterior) => ({
                  ...anterior,
                  [operacao]: { estado: 'erro', mensagem: falha.message },
                }),
              });
          },
        );
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <LoginContext.Provider value={contextValues}>
      <AccessLayout>
        <span className="eyebrow">{tr('BEM-VINDO AO ARGOUSDOCS')}</span>
        <h2>{tr('Vamos continuar?')}</h2>
        <p>{tr('Acesse seu espaço de trabalho.')}</p>
        <section className="login-diagnostics" aria-label={tr('Estado da instalação')} aria-live="polite">
          <strong>{tr('Estado da instalação')}</strong>
          {verificacoes.map(({ operacao, rotulo, sucesso }) => {
            const resultado = diagnosticos[operacao];
            const mensagem = resultado.estado === 'pendente'
              ? 'Verificando…'
              : resultado.estado === 'sucesso'
                ? sucesso
                : resultado.mensagem;
            return (
              <p key={operacao} data-state={resultado.estado}>
                <span className="login-diagnostic-dot" aria-hidden="true" />
                <b>{tr(rotulo)}:</b> {tr(mensagem)}
              </p>
            );
          })}
        </section>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              window.location.href = loginDemo(email, password);
            } catch (error) {
              dispatch({ field: 'error', value: error.message });
            }
          }}
        >
          <TextField
            label={tr('E-mail')}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) =>
              dispatch({ field: 'email', value: e.target.value })
            }
            required
          />
          <TextField
            label={tr('Senha')}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) =>
              dispatch({ field: 'password', value: e.target.value })
            }
            required
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        show ? tr('Ocultar senha') : tr('Mostrar senha')
                      }
                      onClick={() => dispatch({ field: 'show', value: !show })}
                      edge="end"
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {error && <Alert severity="error">{system(error)}</Alert>}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            endIcon={<ArrowRight size={18} />}
          >
            {tr('Entrar na plataforma')}
          </Button>
        </form>
        <div className="access-links">
          <p>{tr('Ainda não tem uma conta?')}</p>
          <Button component="a" href="/cadastro" variant="outlined" fullWidth>
            {tr('Criar cadastro')}
          </Button>
        </div>
        <div className="demo-access">
          <strong>{tr('Acesso de demonstração')}</strong>
          <p>{tr('teste@argous.com.br · senha 123')}</p>
          <Button
            size="small"
            onClick={() => {
              dispatch({
                field: 'email',
                value: 'teste@argous.com.br',
              });
              dispatch({ field: 'password', value: '123' });
              dispatch({ field: 'error', value: '' });
            }}
          >
            {tr('Preencher acesso de teste')}
          </Button>
          <p>{tr('Administrador da plataforma')}: adm@argous.com.br</p>
          <Button
            size="small"
            onClick={() => {
              dispatch({ field: 'email', value: 'adm@argous.com.br' });
              dispatch({ field: 'password', value: '123' });
              dispatch({ field: 'error', value: '' });
            }}
          >
            {tr('Preencher acesso de administrador')}
          </Button>
          <small>
            {tr('Ambiente simulado. Os dados ficam neste navegador.')}
          </small>
        </div>
      </AccessLayout>
    </LoginContext.Provider>
  );
}
