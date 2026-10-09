'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  Alert,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react';
import AccessLayout from '../../components/acesso/layout.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { pageReducer } from '../../utils/page-state.js';
import { chamarCadastro } from '../../programas/cadastro/api.js';

export const CadastroContext = createContext({});

function DadosCadastro() {
  const { telaAtual, loading, value, dispatch } = useContext(CadastroContext);
  const { t: tr } = useI18n();
  const { nome, email, senha, show } = value;
  return (
    <>
      {telaAtual === 'Cadastro' && (
        <TextField
          label={tr('Nome completo')}
          autoComplete="name"
          value={nome}
          onChange={(e) => dispatch({ field: 'nome', value: e.target.value })}
          required
          disabled={loading}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
      )}
      <TextField
        label={tr('E-mail')}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => dispatch({ field: 'email', value: e.target.value })}
        required
        disabled={loading}
        slotProps={{ htmlInput: { maxLength: 254 } }}
      />
      <TextField
        label={tr('Senha')}
        type={show ? 'text' : 'password'}
        value={senha}
        autoComplete={
          telaAtual === 'Cadastro' ? 'new-password' : 'current-password'
        }
        onChange={(e) => dispatch({ field: 'senha', value: e.target.value })}
        required
        disabled={loading}
        helperText={tr('Use pelo menos 8 caracteres.')}
        slotProps={{
          htmlInput: { minLength: 8, maxLength: 1024 },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  disabled={loading}
                  aria-label={tr(show ? 'Ocultar senha' : 'Mostrar senha')}
                  aria-pressed={show}
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
    </>
  );
}

export default function Cadastro() {
  const initialState = useMemo(
    () => ({
      telaAtual: 'Cadastro',
      loading: false,
      nome: '',
      email: '',
      senha: '',
      show: false,
      codigo: '',
      idConfirmacao: '',
      error: '',
      aviso: '',
      avisoTipo: 'info',
      aguardarAte: 0,
      segundos: 0,
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);
  const {
    telaAtual,
    loading,
    nome,
    email,
    senha,
    codigo,
    idConfirmacao,
    error,
    aviso,
    avisoTipo,
    aguardarAte,
    segundos,
  } = pageState;
  const { t: tr } = useI18n();
  const requisicao = useRef(null);
  const titulo = useRef(null);

  useEffect(() => () => requisicao.current?.abort(), []);
  useEffect(() => {
    titulo.current?.focus();
  }, [telaAtual]);
  useEffect(() => {
    if (!aguardarAte) return;
    const atualizar = () =>
      dispatch({
        field: 'segundos',
        value: Math.max(0, Math.ceil((aguardarAte - Date.now()) / 1000)),
      });
    atualizar();
    const timer = setInterval(atualizar, 1000);
    return () => clearInterval(timer);
  }, [aguardarAte]);

  function navegar(tela) {
    if (requisicao.current) return;
    dispatch({ field: 'telaAtual', value: tela });
    dispatch({ field: 'error', value: '' });
    dispatch({ field: 'aviso', value: '' });
    dispatch({ field: 'codigo', value: '' });
    dispatch({ field: 'idConfirmacao', value: '' });
    dispatch({ field: 'show', value: false });
  }

  async function executar(operacao) {
    if (requisicao.current) return;
    const controller = new AbortController();
    requisicao.current = controller;
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'error', value: '' });
    try {
      const dados =
        operacao === 'CADASTRAR_USUARIO'
          ? { nome: nome.trim(), email: email.trim(), senha }
          : operacao === 'CONFIRMAR_EMAIL'
            ? { email: email.trim(), idConfirmacao, codigo }
            : { email: email.trim(), senha };
      const resultado = await chamarCadastro(operacao, dados, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (operacao === 'CONFIRMAR_EMAIL') {
        dispatch({ field: 'senha', value: '' });
        dispatch({ field: 'codigo', value: '' });
        dispatch({ field: 'idConfirmacao', value: '' });
        dispatch({ field: 'aviso', value: '' });
        dispatch({ field: 'telaAtual', value: 'Concluido' });
      } else {
        dispatch({ field: 'idConfirmacao', value: resultado.idConfirmacao });
        dispatch({ field: 'codigo', value: '' });
        dispatch({ field: 'show', value: false });
        dispatch({ field: 'aguardarAte', value: Date.now() + 60000 });
        dispatch({ field: 'segundos', value: 60 });
        dispatch({
          field: 'avisoTipo',
          value: resultado.emailEnviado ? 'info' : 'warning',
        });
        dispatch({
          field: 'aviso',
          value: resultado.emailEnviado
            ? 'O código é válido por 10 minutos. Confira também a pasta de spam.'
            : 'Seu cadastro foi salvo, mas o envio do e-mail não foi confirmado. Aguarde um minuto e solicite outro código.',
        });
        dispatch({ field: 'telaAtual', value: 'Confirmacao' });
      }
    } catch (falha) {
      if (!controller.signal.aborted)
        dispatch({ field: 'error', value: falha.message });
    } finally {
      if (!controller.signal.aborted)
        dispatch({ field: 'loading', value: false });
      if (requisicao.current === controller) requisicao.current = null;
    }
  }

  const titulos = {
    Cadastro: 'Criar cadastro',
    Retomar: 'Retomar cadastro',
    Confirmacao: 'Confirme seu e-mail',
    Concluido: 'E-mail confirmado',
  };
  return (
    <CadastroContext.Provider value={contextValues}>
      <AccessLayout backHref="/login" backLabel="Voltar ao login">
        <span className="eyebrow">{tr('SUA CONTA ARGOUSDOCS')}</span>
        <h2 ref={titulo} tabIndex={-1}>
          {tr(titulos[telaAtual])}
        </h2>
        {telaAtual === 'Cadastro' && (
          <p>
            {tr(
              'Informe seus dados para começar. Vamos confirmar seu e-mail antes de concluir o cadastro.',
            )}
          </p>
        )}
        {telaAtual === 'Retomar' && (
          <p>
            {tr(
              'Informe o e-mail e a senha usados no cadastro para receber um novo código.',
            )}
          </p>
        )}
        {telaAtual === 'Confirmacao' && (
          <p className="confirmation-address">
            {tr('Digite o código enviado para {email}.', { email })}
          </p>
        )}
        {telaAtual === 'Concluido' ? (
          <div className="registration-complete">
            <CheckCircle2 size={44} aria-hidden="true" />
            <Alert severity="success">
              {tr(
                'Seu e-mail foi confirmado e seu cadastro está concluído.',
              )}
            </Alert>
            <Button component="a" href="/login" variant="contained" fullWidth>
              {tr('Voltar ao login')}
            </Button>
          </div>
        ) : (
          <>
            <form
              aria-busy={loading}
              onSubmit={(event) => {
                event.preventDefault();
                executar(
                  telaAtual === 'Confirmacao'
                    ? 'CONFIRMAR_EMAIL'
                    : telaAtual === 'Retomar'
                      ? 'REENVIAR_CONFIRMACAO'
                      : 'CADASTRAR_USUARIO',
                );
              }}
            >
              {telaAtual === 'Confirmacao' ? (
                <>
                  {aviso && <Alert severity={avisoTipo}>{tr(aviso)}</Alert>}
                  <TextField
                    label={tr('Código de confirmação')}
                    value={codigo}
                    autoComplete="one-time-code"
                    required
                    disabled={loading}
                    onChange={(event) =>
                      dispatch({
                        field: 'codigo',
                        value: event.target.value
                          .replace(/[^0-9]/g, '')
                          .slice(0, 8),
                      })
                    }
                    helperText={tr('Digite os 8 dígitos do código.')}
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        pattern: '[0-9]{8}',
                        minLength: 8,
                        maxLength: 8,
                      },
                    }}
                  />
                </>
              ) : (
                <DadosCadastro />
              )}
              {error && <Alert severity="error">{tr(error)}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                endIcon={
                  telaAtual === 'Confirmacao' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
              >
                {tr(
                  loading
                    ? 'Aguarde…'
                    : telaAtual === 'Confirmacao'
                      ? 'Confirmar e-mail'
                      : telaAtual === 'Retomar'
                        ? 'Enviar novo código'
                        : 'Criar cadastro',
                )}
              </Button>
            </form>
            <div className="access-links">
              {telaAtual === 'Confirmacao' ? (
                <>
                  <Button
                    type="button"
                    fullWidth
                    startIcon={<Mail size={17} />}
                    disabled={loading || segundos > 0}
                    onClick={() => executar('REENVIAR_CONFIRMACAO')}
                  >
                    {segundos > 0
                      ? tr('Reenviar em {segundos}s', { segundos })
                      : tr('Reenviar código')}
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={() => navegar('Retomar')}
                  >
                    {tr('Usar outro e-mail')}
                  </Button>
                </>
              ) : (
                <>
                  <p>
                    {tr(
                      telaAtual === 'Cadastro'
                        ? 'Já iniciou seu cadastro?'
                        : 'Ainda não tem uma conta?',
                    )}
                  </p>
                  <Button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      navegar(telaAtual === 'Cadastro' ? 'Retomar' : 'Cadastro')
                    }
                  >
                    {tr(
                      telaAtual === 'Cadastro'
                        ? 'Retomar cadastro'
                        : 'Criar cadastro',
                    )}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </AccessLayout>
    </CadastroContext.Provider>
  );
}
