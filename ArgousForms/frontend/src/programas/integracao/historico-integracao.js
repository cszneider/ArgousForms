'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';

const data = (valor) => valor ? new Date(valor).toLocaleString() : '—';

const resultado = {
  P: 'Em andamento', S: 'Dados obtidos', N: 'Negativa de negócio', C: 'Cache', E: 'Erro técnico',
  H: 'Erro HTTP', T: 'Tempo esgotado', R: 'Falha de rede', V: 'Resposta inválida',
};

export default function HistoricoIntegracao() {
  const { t } = useI18n();
  const [codigo, setCodigo] = useState('');
  const [idRequisicao, setIdRequisicao] = useState('');
  const [filtro, setFiltro] = useState({ codigo: '', idRequisicao: '' });
  const [pagina, setPagina] = useState(0);
  const [consultas, setConsultas] = useState(null);
  const [temMais, setTemMais] = useState(false);
  const [selecionada, setSelecionada] = useState('');
  const [tentativas, setTentativas] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    executar('LISTAR_CONSULTAS_INTEGRACAO', { ...filtro, pagina }).then((resposta) => {
      if (ativo) { setConsultas(resposta.itens || []); setTemMais(!!resposta.temMais); }
    }).catch((falha) => { if (ativo) { setErro(falha.message); setConsultas([]); } });
    return () => { ativo = false; };
  }, [filtro, pagina]);

  const pesquisar = (evento) => {
    evento.preventDefault();
    setErro('');
    setConsultas(null);
    setSelecionada('');
    setPagina(0);
    setFiltro({ codigo: codigo.trim(), idRequisicao: idRequisicao.trim() });
  };

  const abrir = async (id) => {
    if (selecionada === id) { setSelecionada(''); return; }
    setSelecionada(id);
    setTentativas(null);
    setErro('');
    try {
      const resposta = await executar('LISTAR_TENTATIVAS_INTEGRACAO', { idRequisicao: id });
      setTentativas(resposta.itens || []);
    } catch (falha) { setErro(falha.message); setTentativas([]); }
  };

  return <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>{t('Histórico de integração')}</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{t('Cada consulta pode ter uma tentativa na URL principal e outra na alternativa. Respostas do cache não geram tentativas de envio.')}</Typography>
    <Box component="form" onSubmit={pesquisar} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: 1.5, mb: 3 }}>
      <TextField label={t('Código da consulta')} value={codigo} onChange={(evento) => setCodigo(evento.target.value)} size="small" />
      <TextField label={t('ID da requisição')} value={idRequisicao} onChange={(evento) => setIdRequisicao(evento.target.value)} size="small" sx={{ minWidth: 300 }} />
      <Button type="submit" variant="contained">{t('Pesquisar')}</Button>
    </Box>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {consultas === null && <CircularProgress size={24} />}
    {consultas?.length === 0 && !erro && <Typography color="text.secondary">{t('Nenhuma consulta encontrada.')}</Typography>}
    {consultas?.map((consulta) => <Paper key={consulta.idRequisicao} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography fontWeight={700}>{consulta.codigo} · {t(resultado[consulta.resultado] || consulta.resultado)}</Typography>
          <Typography variant="body2" color="text.secondary">{data(consulta.inicio)} · {consulta.acao} · {consulta.numeroTentativas} {t('tentativa(s)')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{t('ID da requisição')}: {consulta.idRequisicao}</Typography>
          {consulta.nomeUsuario && <Typography variant="body2" color="text.secondary">{t('Usuário')}: {consulta.nomeUsuario}</Typography>}
          {consulta.codigoErro && <Typography variant="body2" color="error">{consulta.codigoErro}: {consulta.descricaoErro}</Typography>}
        </Box>
        <Box><Button size="small" onClick={() => abrir(consulta.idRequisicao)}>{selecionada === consulta.idRequisicao ? t('Ocultar tentativas') : t('Ver tentativas')}</Button></Box>
      </Stack>
      {selecionada === consulta.idRequisicao && <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        {tentativas === null && <CircularProgress size={20} />}
        {tentativas?.length === 0 && <Typography color="text.secondary">{t('Nenhum envio: resposta obtida do cache ou consulta ainda não enviada.')}</Typography>}
        {tentativas?.map((tentativa) => <Box key={tentativa.idTentativa} sx={{ mb: 1.5 }}>
          <Typography fontWeight={600}>{tentativa.destino === 'A' ? t('URL alternativa') : t('URL principal')} · {t(resultado[tentativa.resultado] || tentativa.resultado)}</Typography>
          <Typography variant="body2" color="text.secondary">{data(tentativa.inicio)} → {data(tentativa.fim)} · HTTP {tentativa.statusHttp ?? '—'}</Typography>
          <Typography variant="body2" color="text.secondary">{t('Chave')}: {tentativa.idChave}</Typography>
          {tentativa.codigoErro && <Typography variant="body2" color="error">{tentativa.codigoErro}: {tentativa.descricaoErro}</Typography>}
        </Box>)}
      </Box>}
    </Paper>)}
    {consultas && <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
      <Button disabled={pagina === 0} onClick={() => { setPagina((atual) => atual - 1); setConsultas(null); }}>{t('Anterior')}</Button>
      <Typography variant="body2">{t('Página')} {pagina + 1}</Typography>
      <Button disabled={!temMais} onClick={() => { setPagina((atual) => atual + 1); setConsultas(null); }}>{t('Próxima')}</Button>
    </Stack>}
  </Paper>;
}
