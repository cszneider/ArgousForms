'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { ArrowLeft, Bell, Check, RefreshCw } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';

const situacoes = { P: 'Aguardando ação', A: 'Atendida', E: 'Atendida por outra pessoa', C: 'Cancelada', I: 'Informativa' };

export default function Notificacoes({ aoAbrirProcesso, aoAbrirTarefas, aoVoltar, aoNotificacoesAlteradas }) {
  const { t, system } = useI18n();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [marcando, setMarcando] = useState(null);
  const [confirmarRedisponibilizacao, setConfirmarRedisponibilizacao] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await executar('LISTAR_NOTIFICACOES');
      setItens(dados.notificacoes || []);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { Promise.resolve().then(carregar); }, [carregar]);

  async function marcarLida(item) {
    if (item.visualizacao || marcando) return;
    setMarcando(item.id);
    setErro('');
    try {
      await executar('MARCAR_NOTIFICACAO_LIDA', { idNotificacao: item.id });
      setItens((anteriores) => anteriores.map((atual) => atual.id === item.id
        ? { ...atual, visualizacao: new Date().toISOString() } : atual));
      aoNotificacoesAlteradas?.();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setMarcando(null);
    }
  }

  async function decidirResponsavel(item, manter) {
    if (marcando) return;
    setMarcando(item.id);
    setErro('');
    try {
      await executar('DECIDIR_RESPONSAVEL_NOTIFICACAO', { idNotificacao: item.id, manter });
      setConfirmarRedisponibilizacao(null);
      await carregar();
      aoNotificacoesAlteradas?.();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setMarcando(null);
    }
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">{t('SEU ESPAÇO DE TRABALHO')}</span><h1>{t('Notificações')}</h1>
        <p>{t('Acompanhe avisos e ações ligadas aos seus processos.')}</p></div>
      <Stack direction="row" gap={1}>
        <Button variant="outlined" startIcon={<ArrowLeft size={17} />} onClick={aoVoltar}>{t('Voltar')}</Button>
        <Button variant="outlined" startIcon={<RefreshCw size={17} />} onClick={carregar} disabled={carregando}>{t('Atualizar')}</Button>
      </Stack>
    </div>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{system(erro)}</Alert>}
    {carregando && <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>}
    {!carregando && !itens.length && <Alert severity="info">{t('Você não tem notificações.')}</Alert>}
    {!carregando && <Stack spacing={1.5}>
      {itens.map((item) => <Paper key={item.id} className="panel" sx={{ p: 2, borderLeft: item.visualizacao ? 0 : 4, borderColor: 'primary.main' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box><Stack direction="row" alignItems="center" gap={1}><Bell size={17} />
            <Typography variant="subtitle1" fontWeight={item.visualizacao ? 500 : 700}>{item.titulo}</Typography></Stack>
            {item.resumo && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.resumo}</Typography>}
            <Typography variant="caption" color="text.secondary">{new Date(item.entrega).toLocaleString()}</Typography>
          </Box>
          <Chip size="small" label={t(situacoes[item.situacao] || item.situacao)} color={item.situacao === 'P' ? 'warning' : 'default'} />
        </Stack>
        {item.resultado && <Typography variant="body2" sx={{ mt: 1 }}>{item.resultado}</Typography>}
        <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
          {!item.visualizacao && <Button size="small" startIcon={<Check size={16} />} disabled={Boolean(marcando)} onClick={() => marcarLida(item)}>{t('Marcar como lida')}</Button>}
          {item.tipo === 'RESPONSAVEL_VINCULO_PERDIDO' && item.situacao === 'P' && <>
            <Button size="small" disabled={Boolean(marcando)} onClick={() => decidirResponsavel(item, true)}>{t('Manter responsável')}</Button>
            <Button size="small" color="warning" disabled={Boolean(marcando)} onClick={() => setConfirmarRedisponibilizacao(item)}>{t('Redisponibilizar etapa')}</Button>
          </>}
          {item.tipo === 'ETAPA_DISPONIVEL'
            ? item.situacao === 'P' && <Button size="small" onClick={aoAbrirTarefas}>{t('Abrir tarefas')}</Button>
            : item.idProcesso && <Button size="small" onClick={() => aoAbrirProcesso(item.idProcesso)}>{t('Abrir processo')}</Button>}
        </Stack>
      </Paper>)}
    </Stack>}
    <Dialog open={Boolean(confirmarRedisponibilizacao)} onClose={() => !marcando && setConfirmarRedisponibilizacao(null)} fullWidth maxWidth="sm">
      <DialogTitle>{t('Redisponibilizar etapa')}</DialogTitle>
      <DialogContent><Typography>{t('O responsável atual perderá a tarefa. Os valores já salvos serão preservados para o próximo responsável.')}</Typography></DialogContent>
      <DialogActions>
        <Button disabled={Boolean(marcando)} onClick={() => setConfirmarRedisponibilizacao(null)}>{t('Cancelar')}</Button>
        <Button color="warning" variant="contained" disabled={Boolean(marcando)} onClick={() => decidirResponsavel(confirmarRedisponibilizacao, false)}>{t('Confirmar')}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
