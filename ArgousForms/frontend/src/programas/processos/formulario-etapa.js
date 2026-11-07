'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from '@mui/material';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { formatarValorExemplo, normalizarValorTexto } from '../protocolos/variavel-texto.js';

function valorInicial(campo) {
  if (campo.tipo === 'V') return campo.valor == null ? { moeda: campo.moeda || '', valor: '' } : { moeda: campo.moeda || '', valor: String(campo.valor) };
  return campo.valor == null ? '' : campo.valor;
}

export default function FormularioEtapa({ idEtapa, aoFechar, aoSalvar }) {
  const { t } = useI18n();
  const [etapa, setEtapa] = useState(null);
  const [valores, setValores] = useState({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [campoEmEdicao, setCampoEmEdicao] = useState('');
  const [errosCampos, setErrosCampos] = useState({});
  const [alterado, setAlterado] = useState(false);
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const dados = await executar('CONSULTAR_ETAPA_PROCESSO', { idEtapa });
      setEtapa(dados);
      setValores(Object.fromEntries((dados.campos || []).map((campo) => [campo.id, valorInicial(campo)])));
      setAlterado(false);
    } catch (falha) { setErro(falha.message); }
    finally { setCarregando(false); }
  }

  useEffect(() => {
    if (!idEtapa) return;
    let cancelado = false;
    executar('CONSULTAR_ETAPA_PROCESSO', { idEtapa }).then((dados) => {
      if (!cancelado) {
        setEtapa(dados);
        setValores(Object.fromEntries((dados.campos || []).map((campo) => [campo.id, valorInicial(campo)])));
        setAlterado(false);
        setErro('');
      }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); });
    return () => { cancelado = true; };
  }, [idEtapa]);

  async function assumir() {
    setGravando(true);
    setErro('');
    try { await executar('ASSUMIR_ETAPA_PROCESSO', { idEtapa }); await carregar(); aoSalvar?.(); }
    catch (falha) { setErro(falha.message); }
    finally { setGravando(false); }
  }

  async function salvar(completo = false) {
    setGravando(true);
    setErro('');
    try {
      const editaveis = {};
      const novosErros = {};
      for (const campo of etapa.campos || []) {
        if (campo.acesso !== 'E') continue;
        let valor = valores[campo.id];
        if (completo && campo.obrigatorio && (valor == null || valor === '' || campo.tipo === 'V' && (!valor.moeda || !valor.valor))) {
          novosErros[campo.id] = t('Campo obrigatório.');
        }
        if (campo.tipo === 'S' && valor && (completo || !errosCampos[campo.id])) {
          const resultado = normalizarValorTexto(valor, campo.definicao);
          if (resultado.erro && completo) novosErros[campo.id] = resultado.erro;
          else if (!resultado.erro) valor = resultado.valor;
        }
        editaveis[campo.id] = valor;
      }
      if (Object.keys(novosErros).length) { setErrosCampos(novosErros); return false; }
      await executar(completo ? 'SALVAR_ETAPA_COMPLETA' : 'SALVAR_ETAPA_PARCIAL', { idEtapa, valores: editaveis });
      await carregar();
      setErrosCampos({});
      aoSalvar?.();
      return true;
    } catch (falha) { setErro(falha.message); return false; }
    finally { setGravando(false); }
  }

  async function finalizar() {
    setConfirmarFinalizacao(false);
    if (!await salvar(true)) return;
    setGravando(true);
    try {
      await executar('FINALIZAR_ETAPA_PROCESSO', { idEtapa });
      aoFechar();
      aoSalvar?.();
    } catch (falha) { setErro(falha.message); }
    finally { setGravando(false); }
  }

  function campoVisual(campo) {
    const editavel = etapa.podeEditar && campo.acesso === 'E';
    const valor = valores[campo.id];
    const alterar = (novo) => {
      if (JSON.stringify(novo) !== JSON.stringify(valor)) setAlterado(true);
      setValores((anteriores) => ({ ...anteriores, [campo.id]: novo }));
      setErrosCampos((anteriores) => ({ ...anteriores, [campo.id]: '' }));
    };
    if (campo.tipo === 'B') return <FormControlLabel key={campo.id} control={<Switch checked={valor === true} disabled={!editavel} onChange={(evento) => alterar(evento.target.checked)} />} label={campo.nome} />;
    if (campo.tipo === 'V') return <div key={campo.id} style={{ display: 'flex', gap: 12 }}>
      <TextField label={`${campo.nome} · ${t('Moeda')}`} value={valor?.moeda || ''} disabled={!editavel} onChange={(evento) => alterar({ ...valor, moeda: evento.target.value.toUpperCase() })} inputProps={{ maxLength: 3 }} sx={{ width: 120 }} />
      <TextField label={t('Valor')} value={valor?.valor || ''} disabled={!editavel} onChange={(evento) => alterar({ ...valor, valor: evento.target.value })} fullWidth />
    </div>;
    const tipoHtml = { I: 'number', R: 'number', D: 'date' }[campo.tipo] || 'text';
    const mascara = campo.tipo === 'S' ? campo.definicao?.texto?.mascara || '' : '';
    const normalizado = mascara && valor && campoEmEdicao !== campo.id ? normalizarValorTexto(String(valor), campo.definicao) : null;
    const exibido = normalizado && !normalizado.erro ? formatarValorExemplo(normalizado.valor, mascara) : valor;
    return <TextField key={campo.id} label={campo.nome} value={exibido ?? ''} type={tipoHtml} disabled={!editavel} fullWidth
      onChange={(evento) => alterar(evento.target.value)} InputLabelProps={campo.tipo === 'D' ? { shrink: true } : undefined}
      onFocus={() => setCampoEmEdicao(campo.id)} onBlur={() => {
        setCampoEmEdicao('');
        if (campo.tipo !== 'S' || !valor) return;
        const resultado = normalizarValorTexto(valor, campo.definicao);
        if (resultado.erro) setErrosCampos((anteriores) => ({ ...anteriores, [campo.id]: resultado.erro }));
        else alterar(resultado.valor);
      }}
      inputProps={campo.tipo === 'R' ? { step: 'any' } : undefined}
      error={Boolean(errosCampos[campo.id])}
      helperText={errosCampos[campo.id] || (campo.acesso === 'L' ? t('Somente leitura') : campo.tipo === 'H' ? 'HH:mm:ss-03:00' : campo.tipo === 'T' ? 'AAAA-MM-DDTHH:mm:ss-03:00' : undefined)} />;
  }

  return <Dialog open={Boolean(idEtapa)} onClose={aoFechar} fullWidth maxWidth="md">
    <DialogTitle>{etapa?.titulo || t('Carregando formulário...')}</DialogTitle>
    <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
      {erro && <Alert severity="error">{erro}</Alert>}
      {carregando && <CircularProgress size={24} />}
      {etapa && <>
        {etapa.situacao === 'S' && !alterado && <Alert severity="success">{t('Formulário salvo e validado.')}</Alert>}
        {etapa.situacao === 'S' && alterado && <Alert severity="warning">{t('O formulário foi alterado. Salve e valide novamente para confirmar os novos valores.')}</Alert>}
        {etapa.podeAssumir && <Alert severity="info">{t('Assuma esta etapa para preencher o formulário.')}</Alert>}
        {(etapa.campos || []).map(campoVisual)}
      </>}
    </DialogContent>
    <DialogActions>
      <Button onClick={aoFechar}>{t('Fechar')}</Button>
      {etapa?.podeAssumir && <Button variant="contained" disabled={gravando} onClick={assumir}>{t('Assumir etapa')}</Button>}
      {etapa?.podeEditar && <Button variant="outlined" disabled={gravando} onClick={() => salvar(false)}>{t('Salvar')}</Button>}
      {etapa?.podeEditar && <Button variant="contained" disabled={gravando} onClick={() => salvar(true)}>{t('Salvar e validar')}</Button>}
      {etapa?.podeEditar && <Button color="success" variant="contained" disabled={gravando} onClick={() => setConfirmarFinalizacao(true)}>{t('Finalizar')}</Button>}
    </DialogActions>
    <Dialog open={confirmarFinalizacao} onClose={() => setConfirmarFinalizacao(false)}>
      <DialogTitle>{t('Finalizar etapa?')}</DialogTitle>
      <DialogContent>{t('Os valores serão validados e a etapa será encaminhada. Esta ação não pode ser desfeita nesta tela.')}</DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmarFinalizacao(false)}>{t('Voltar')}</Button>
        <Button variant="contained" color="success" onClick={finalizar}>{t('Confirmar finalização')}</Button>
      </DialogActions>
    </Dialog>
  </Dialog>;
}
