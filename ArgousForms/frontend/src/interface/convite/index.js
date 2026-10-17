'use client';

import { createContext, useMemo, useReducer, useRef } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import AccessLayout from '../../components/acesso/layout.js';
import ForcaSenha from '../../components/acesso/forca-senha.js';
import { avaliarSenha } from '../../programas/login/politica-senha.js';
import { executar } from '../../programas/login/autenticacao.js';
import { pageReducer } from '../../utils/page-state.js';
import { useI18n } from '../../components/i18n/i18n.js';

export const ConviteContext = createContext({});

export default function Convite() {
  const initialState = useMemo(() => ({ telaAtual: 'Convite', loading: false, email: '', codigo: '', senha: '', confirmacao: '', erro: '', concluido: false }), []);
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { loading, email, codigo, senha, confirmacao, erro, concluido } = pageState;
  const contextValues = useMemo(() => {
    const { telaAtual, loading: carregando, ...value } = pageState;
    return { telaAtual, loading: carregando, value, dispatch, initialStateRef };
  }, [pageState]);
  const { t } = useI18n();

  async function aceitar(event) {
    event.preventDefault();
    if (senha !== confirmacao) return dispatch({ field: 'erro', value: 'As senhas não conferem.' });
    if (!avaliarSenha(senha).valida) return dispatch({ field: 'erro', value: 'A senha não atende à política de segurança.' });
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'erro', value: '' });
    try {
      await executar('ACEITAR_CONVITE', { email: email.trim(), codigo: codigo.trim(), senha });
      dispatch({ field: 'senha', value: '' });
      dispatch({ field: 'confirmacao', value: '' });
      dispatch({ field: 'concluido', value: true });
    } catch (falha) {
      dispatch({ field: 'erro', value: falha.message });
    } finally {
      dispatch({ field: 'loading', value: false });
    }
  }

  return <ConviteContext.Provider value={contextValues}>
    <AccessLayout backHref="/login" backLabel="Voltar ao login">
      <span className="eyebrow">{t('SUA CONTA ARGOUSDOCS')}</span>
      <h2>{t('Aceitar convite')}</h2>
      {concluido ? <><Alert severity="success">{t('Convite aceito. Seu e-mail foi confirmado e sua senha foi definida.')}</Alert>
        <Button component="a" href="/login" variant="contained" fullWidth sx={{ mt: 2 }}>{t('Entrar')}</Button></> :
        <form onSubmit={aceitar} style={{ display: 'grid', gap: 16 }}>
          <p>{t('Informe o e-mail que recebeu o convite, o código de oito dígitos e a nova senha.')}</p>
          <TextField label={t('E-mail')} type="email" required value={email} onChange={(e) => dispatch({ field: 'email', value: e.target.value })} />
          <TextField label={t('Código')} required value={codigo} onChange={(e) => dispatch({ field: 'codigo', value: e.target.value })} />
          <TextField label={t('Nova senha')} type="password" required value={senha} onChange={(e) => dispatch({ field: 'senha', value: e.target.value })} />
          <ForcaSenha senha={senha} />
          <TextField label={t('Confirme a nova senha')} type="password" required value={confirmacao} onChange={(e) => dispatch({ field: 'confirmacao', value: e.target.value })} />
          {erro && <Alert severity="error">{erro}</Alert>}
          <Button type="submit" variant="contained" disabled={loading}>{loading ? t('Confirmando…') : t('Aceitar convite')}</Button>
        </form>}
    </AccessLayout>
  </ConviteContext.Provider>;
}
