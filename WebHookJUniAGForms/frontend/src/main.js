import React, { useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert, Box, Button, CircularProgress, CssBaseline, IconButton,
  InputAdornment, TextField, ThemeProvider, Typography, createTheme,
} from '@mui/material';
import './styles.css';
import { LoginContext } from './login-context.js';
const PainelAdministrativo = React.lazy(() => import('./administracao/painel.js').then((modulo) => ({ default: modulo.PainelAdministrativo })));

export { LoginContext };
const reducer = (state, { field, value }) => ({ ...state, [field]: typeof value === 'function' ? value(state[field]) : value });

const theme = createTheme({
  palette: {
    primary: { main: '#12665b', dark: '#0a4f46' },
    background: { default: '#f5f7fa' },
    text: { primary: '#172b41', secondary: '#6c7c8e' },
  },
  typography: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiTextField: { defaultProps: { variant: 'outlined', size: 'medium', fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

function Simbolo({ pequeno = false }) {
  return <svg className={pequeno ? 'simbolo pequeno' : 'simbolo'} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M13 12h13a9 9 0 0 1 0 18h-4M35 36H22a9 9 0 0 1 0-18h4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="4" fill="currentColor" /><circle cx="36" cy="36" r="4" fill="currentColor" />
  </svg>;
}

function Identidade() {
  const { value } = useContext(LoginContext);
  return <aside className="identidade">
    <div className="marca"><Simbolo pequeno /><span>Argous Forms <span className="marca-divisor">/</span> Integrações</span></div>
    <div className="identidade-conteudo">
      <span className="sobretitulo">AMBIENTE ADMINISTRATIVO</span>
      <Typography component="h1" className="instituicao">{value.nomeInstituicao || 'Sua integração começa aqui.'}</Typography>
      <Typography component="p" className="subtitulo">Sistema de Controle <br />da Integração</Typography>
      <span className="assinatura">Argous Forms</span>
      <div className="conexao" aria-hidden="true"><span>ERP</span><i /><Simbolo /><i /><span>Argous<br />Forms</span></div>
      <p className="identidade-descricao">Um ponto de encontro entre os seus sistemas.<br />Visibilidade e controle para cada conexão.</p>
    </div>
    <div className="identidade-rodape"><span className="ponto" /> Administração da integração</div>
  </aside>;
}

async function apiAutenticacao(operacao, campos) {
  let response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/autenticacao/${operacao}`, {
      method: campos === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-Webhook-Admin': '1', ...(campos === undefined ? {} : { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }) },
      body: campos === undefined ? undefined : new URLSearchParams(campos),
      signal: AbortSignal.timeout(65000),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const erro = new Error(data.mensagem || 'Não foi possível concluir a operação.');
    erro.codigo = data.codigo;
    erro.status = response.status;
    throw erro;
  }
  return data;
}

function CampoSenha({ campo, label, autoComplete, ajuda }) {
  const { value, dispatch } = useContext(LoginContext);
  const [visivel, setVisivel] = React.useState(false);
  return <TextField label={label} type={visivel ? 'text' : 'password'} name={campo} autoComplete={autoComplete} required disabled={value.enviando} value={value[campo]} onChange={(e) => dispatch({ field: campo, value: e.target.value })} helperText={ajuda} slotProps={{ htmlInput: { maxLength: 1024 }, input: { endAdornment: <InputAdornment position="end"><IconButton disabled={value.enviando} onClick={() => setVisivel(!visivel)} aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visivel} edge="end"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />{visivel && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.6" />}</svg></IconButton></InputAdornment> } }} />;
}

function FormularioEntrada() {
  const { value, dispatch, entrar } = useContext(LoginContext);
  return <>
    <Typography component="h2" variant="h4" className="titulo-login">Bem-vindo.</Typography>
    <Typography color="text.secondary" className="intro">Entre com sua conta para administrar a integração.</Typography>
    <Box component="form" onSubmit={entrar} className="formulario">
      <TextField label="E-mail do administrador" type="email" name="email" autoComplete="username" required disabled={value.enviando} value={value.email} onChange={(e) => dispatch({ field: 'email', value: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} />
      <CampoSenha campo="senha" label="Senha" autoComplete="current-password" />
      {value.aviso && <Alert severity="error" role="alert">{value.aviso}</Alert>}
      <Button disabled={value.enviando} type="submit" variant="contained" fullWidth className="botao-entrar">{value.enviando ? 'Entrando…' : 'Entrar'} <span aria-hidden="true">→</span></Button>
    </Box>
    <div className="primeiro-acesso"><span className="primeiro-icone" aria-hidden="true">↗</span><div><strong>É seu primeiro acesso?</strong><p>Use o e-mail e a senha inicial definidos na instalação. A troca da senha será solicitada antes de continuar.</p></div></div>
  </>;
}

function TrocaSenha() {
  const { value, alterarSenha, sair, dispatch } = useContext(LoginContext);
  const obrigatoria = value.sessao.trocarSenha;
  return <>
    <Typography component="h2" variant="h4" className="titulo-login">{obrigatoria ? 'Defina sua nova senha.' : 'Altere sua senha.'}</Typography>
    <Typography color="text.secondary" className="intro">{obrigatoria ? 'Antes de continuar, substitua a senha inicial por uma senha pessoal e segura.' : 'Confirme sua senha atual e escolha uma nova.'}</Typography>
    <Box component="form" onSubmit={alterarSenha} className="formulario">
      <input type="text" name="username" autoComplete="username" value={value.sessao.email} readOnly hidden />
      <CampoSenha campo="senhaAtual" label="Senha atual" autoComplete="current-password" />
      <CampoSenha campo="novaSenha" label="Nova senha" autoComplete="new-password" ajuda="De 8 a 1024 caracteres. Combine ao menos três categorias: maiúsculas, minúsculas, números e símbolos." />
      <CampoSenha campo="confirmacao" label="Confirme a nova senha" autoComplete="new-password" />
      {value.aviso && <Alert severity="error" role="alert">{value.aviso}</Alert>}
      <Button disabled={value.enviando} type="submit" variant="contained" fullWidth className="botao-entrar">{value.enviando ? 'Salvando…' : 'Salvar nova senha'}</Button>
      <Button disabled={value.enviando} onClick={obrigatoria ? sair : () => { dispatch({ field: 'trocaManual', value: false }); dispatch({ field: 'aviso', value: '' }); for (const field of ['senhaAtual', 'novaSenha', 'confirmacao']) dispatch({ field, value: '' }); }}> {obrigatoria ? 'Sair' : 'Voltar'} </Button>
    </Box>
  </>;
}

function Formulario() {
  const { value, loading, carregar } = useContext(LoginContext);
  return <main className="acesso">
    <div className="painel-login">
      <div className="rotulo-acesso"><span className="cadeado" aria-hidden="true">◇</span> Acesso administrativo</div>
      {loading ? <div className="estado" role="status"><CircularProgress size={28} /><Typography>Preparando seu ambiente…</Typography></div> : value.erro ? <>
        <Typography component="h2" variant="h4" className="titulo-login">Vamos preparar o ambiente</Typography>
        <Typography color="text.secondary" className="intro">A configuração inicial ainda não está disponível.</Typography>
        <Alert severity="warning">Não foi possível preparar a instalação ou consultar sua sessão. Confira o servidor e tente novamente.</Alert>
        <Button variant="contained" fullWidth onClick={carregar} sx={{ mt: 3, py: 1.6 }}>Verificar novamente</Button>
      </> : !value.sessao ? <FormularioEntrada /> : value.sessao.trocarSenha || value.trocaManual ? <TrocaSenha /> : null}
    </div>
    <footer className="rodape-acesso">Argous Forms <span>·</span> Sistema de Controle da Integração</footer>
  </main>;
}

function Login() {
  const initialState = useMemo(() => ({ loading: true, nomeInstituicao: '', email: '', senha: '', senhaAtual: '', novaSenha: '', confirmacao: '', erro: false, aviso: '', sessao: null, enviando: false, trocaManual: false }), []);
  const initialStateRef = useRef(initialState);
  const [value, dispatch] = useReducer(reducer, initialState);
  const requisicaoAtual = useRef(0);
  const operacaoAtual = useRef(false);
  const limparSenhas = React.useCallback(() => {
    for (const field of ['senha', 'senhaAtual', 'novaSenha', 'confirmacao']) dispatch({ field, value: '' });
  }, []);
  const aplicarSessao = React.useCallback(async (sessao) => {
    const confirmada = sessao && !sessao.trocarSenha ? await apiAutenticacao('administracao') : sessao;
    dispatch({ field: 'sessao', value: confirmada });
    dispatch({ field: 'trocaManual', value: false });
    dispatch({ field: 'aviso', value: '' });
    limparSenhas();
  }, [limparSenhas]);
  const executar = React.useCallback(async (operacao) => {
    if (operacaoAtual.current) return;
    operacaoAtual.current = true;
    dispatch({ field: 'enviando', value: true });
    dispatch({ field: 'aviso', value: '' });
    try {
      await operacao();
    } catch (erro) {
      if (erro.codigo === 'SESSAO_INVALIDA') {
        dispatch({ field: 'sessao', value: null });
        dispatch({ field: 'trocaManual', value: false });
      }
      dispatch({ field: 'aviso', value: erro.message });
    } finally {
      limparSenhas();
      dispatch({ field: 'enviando', value: false });
      operacaoAtual.current = false;
    }
  }, [limparSenhas]);
  const entrar = React.useCallback((event) => {
    event.preventDefault();
    executar(async () => aplicarSessao(await apiAutenticacao('entrar', { email: value.email, senha: value.senha })));
  }, [executar, aplicarSessao, value.email, value.senha]);
  const alterarSenha = React.useCallback((event) => {
    event.preventDefault();
    executar(async () => {
      if (value.novaSenha !== value.confirmacao) throw new Error('A confirmação não corresponde à nova senha.');
      await aplicarSessao(await apiAutenticacao('senha', { senhaAtual: value.senhaAtual, novaSenha: value.novaSenha, confirmacao: value.confirmacao }));
    });
  }, [executar, aplicarSessao, value.senhaAtual, value.novaSenha, value.confirmacao]);
  const sair = React.useCallback(() => executar(async () => {
    await apiAutenticacao('sair', {});
    await aplicarSessao(null);
  }), [executar, aplicarSessao]);
  const carregar = React.useCallback(async () => {
    const id = ++requisicaoAtual.current;
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'erro', value: false });
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/inicializacao`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Configuração indisponível');
      const data = await response.json();
      if (typeof data.nomeInstituicao !== 'string' || !data.nomeInstituicao.trim()) throw new Error('Identificação inválida');
      let sessao = null;
      try { sessao = await apiAutenticacao('sessao'); } catch (erro) { if (erro.status !== 401) throw erro; }
      if (id !== requisicaoAtual.current) return;
      dispatch({ field: 'nomeInstituicao', value: data.nomeInstituicao });
      document.title = `${data.nomeInstituicao} | Controle da Integração`;
      await aplicarSessao(sessao);
    } catch {
      if (id !== requisicaoAtual.current) return;
      dispatch({ field: 'erro', value: true });
    } finally {
      if (id === requisicaoAtual.current) dispatch({ field: 'loading', value: false });
    }
  }, [aplicarSessao]);
  useEffect(() => { carregar(); return () => { requisicaoAtual.current++; }; }, [carregar]);
  const telaAtual = !value.sessao ? 'login' : value.sessao.trocarSenha || value.trocaManual ? 'senha' : 'administracao';
  const contextValues = useMemo(() => ({ telaAtual, loading: value.loading, value, dispatch, initialStateRef, carregar, entrar, alterarSenha, sair }), [telaAtual, value, carregar, entrar, alterarSenha, sair]);
  return <LoginContext.Provider value={contextValues}>{value.sessao && !value.sessao.trocarSenha && !value.trocaManual && !value.loading && !value.erro ? <React.Suspense fallback={<div className="estado" role="status" style={{ justifyContent: 'center', minHeight: '100svh' }}><CircularProgress size={28} /><Typography>Abrindo administração…</Typography></div>}><PainelAdministrativo /></React.Suspense> : <div className="pagina-login"><Identidade /><Formulario /></div>}</LoginContext.Provider>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline /><Login /></ThemeProvider></React.StrictMode>);

