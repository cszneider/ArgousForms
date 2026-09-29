'use client';
import { useI18n, LanguageSelect } from '../../components/i18n/i18n.js';
import { useState } from 'react';
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
export default function Login() {
  const { t: tr, system } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  return (
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
            <LanguageSelect />
            <ThemeToggle />
          </div>
          <div>
            <span className="eyebrow">{tr('BEM-VINDO AO ARGOUSDOCS')}</span>
            <h2>{tr('Vamos continuar?')}</h2>
            <p>{tr('Acesse seu espaço de trabalho.')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  email.trim().toLowerCase() !== 'teste@argous.com.br' ||
                  password !== '123'
                ) {
                  setError(
                    'E-mail ou senha incorretos. Use o acesso de demonstração abaixo.',
                  );
                  return;
                }
                try {
                  sessionStorage.setItem('argousdocs:session', 'demo');
                  window.location.href = '/app';
                } catch {
                  setError(
                    'Permita o armazenamento do navegador para entrar na demonstração.',
                  );
                }
              }}
            >
              <TextField
                label={tr('E-mail')}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label={tr('Senha')}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            show ? tr('Ocultar senha') : tr('Mostrar senha')
                          }
                          onClick={() => setShow(!show)}
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
                  setEmail('teste@argous.com.br');
                  setPassword('123');
                  setError('');
                }}
              >
                {tr('Preencher acesso de teste')}
              </Button>
              <small>
                {tr('Ambiente simulado. Os dados ficam neste navegador.')}
              </small>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
