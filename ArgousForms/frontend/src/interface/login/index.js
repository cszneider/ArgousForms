'use client';
import { pageReducer } from '../../utils/page-state.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { createContext, useMemo, useReducer, useRef } from 'react';
import { loginDemo } from '../../programas/plataforma/access.js';
import {
  Button,
  TextField,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  FileStack,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { ThemeToggle } from '../../components/theme/theme.js';
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
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { email, password, show, error } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t: tr, system } = useI18n();

  return (
    <LoginContext.Provider value={contextValues}>
      <>
        <main className="login-page">
          <section className="login-story">
            <a href="/" className="brand">
              <span className="brand-icon">
                <FileStack size={24} />
              </span>
              Argous<span>Docs</span>
            </a>
            <div>
              <span className="eyebrow">{tr('CADA ETAPA CONTA')}</span>
              <h1>
                {tr('Seu próximo')}
                <br />
                {tr('documento começa')}
                <br />
                {tr('com uma boa conexão.')}
              </h1>
              <p>
                {tr('Modelos organizados. Equipes alinhadas.')}
                <br />
                {tr('Tudo no mesmo fluxo.')}
              </p>
              <div className="login-checks">
                {[
                  tr('Responsabilidades bem definidas'),
                  tr('Histórico de cada contribuição'),
                  tr('Um documento final, completo'),
                ].map((t) => (
                  <p key={t}>
                    <CheckCircle2 size={18} />
                    {t}
                  </p>
                ))}
              </div>
            </div>
            <small>{tr('ArgousDocs · Documentos em movimento')}</small>
          </section>
          <section className="login-form">
            <div className="login-tools">
              <a className="back-link" href="/">
                <ArrowLeft size={16} /> {tr('Voltar ao início')}
              </a>
              <ThemeToggle />
            </div>
            <div>
              <span className="eyebrow">{tr('BEM-VINDO AO ARGOUSDOCS')}</span>
              <h2>{tr('Vamos continuar?')}</h2>
              <p>{tr('Acesse seu espaço de trabalho.')}</p>
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
                            onClick={() =>
                              dispatch({ field: 'show', value: !show })
                            }
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
            </div>
          </section>
        </main>
      </>
    </LoginContext.Provider>
  );
}
