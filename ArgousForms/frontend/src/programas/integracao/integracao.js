'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import ChavesWebhook from './chaves-webhook.js';
import HistoricoIntegracao from './historico-integracao.js';

export default function Integracao({ desenvolvedor = false }) {
  const { t: tr } = useI18n();
  const [aba, setAba] = useState(desenvolvedor ? 0 : 3);
  const [protocolos, setProtocolos] = useState([]);
  const [idProtocolo, setIdProtocolo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [parametros, setParametros] = useState('{}');
  const [resposta, setResposta] = useState(null);
  const [documentacao, setDocumentacao] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [cache, setCache] = useState([]);
  const [inspecionado, setInspecionado] = useState('');

  useEffect(() => {
    if (!desenvolvedor) return;
    Promise.all([
      executar('LISTAR_PROTOCOLOS_INTEGRACAO'),
      executar('DOCUMENTACAO_INTEGRACAO'),
    ]).then(([lista, documento]) => {
      setProtocolos(lista.protocolos || []);
      setDocumentacao(documento.markdown || '');
    }).catch((falha) => setErro(falha.message));
  }, [desenvolvedor]);

  useEffect(() => {
    if (aba !== 2 || !idProtocolo) return;
    let ativo = true;
    executar('LISTAR_CACHE_INTEGRACAO', { idProtocolo })
      .then((resultado) => { if (ativo) setCache(resultado.itens || []); })
      .catch((falha) => { if (ativo) { setErro(falha.message); setCache([]); } });
    return () => { ativo = false; };
  }, [aba, idProtocolo]);

  const selecionarProtocolo = (valor) => {
    setIdProtocolo(valor);
    setCache(valor ? null : []);
    setInspecionado('');
  };

  const testar = async () => {
    setErro('');
    setResposta(null);
    let valores;
    try {
      valores = JSON.parse(parametros);
      if (!valores || Array.isArray(valores) || typeof valores !== 'object') throw new Error();
    } catch {
      setErro(tr('Os parâmetros precisam ser um objeto JSON válido.'));
      return;
    }
    setCarregando(true);
    try {
      setResposta(await executar('TESTAR_GET_DATA', { ...(idProtocolo ? { idProtocolo } : {}), codigo: codigo.trim(), parametros: valores }));
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  };

  const invalidar = async (idCache) => {
    if (!window.confirm(tr('Invalidar esta entrada do cache? A próxima consulta buscará o webhook novamente.'))) return;
    setErro('');
    try {
      await executar('INVALIDAR_CACHE_INTEGRACAO', { idProtocolo, idCache });
      setCache((anterior) => anterior.filter((item) => item.idCache !== idCache));
      if (inspecionado === idCache) setInspecionado('');
    } catch (falha) {
      setErro(falha.message);
    }
  };

  return <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>
    <Typography variant="h4" gutterBottom>{tr('Integração')}</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{tr('Consulte o webhook da instituição e confira o contrato de integração.')}</Typography>
    <Tabs value={aba} onChange={(_, valor) => { setAba(valor); if (valor === 2) { setCache(idProtocolo ? null : []); setInspecionado(''); } }} sx={{ mb: 3 }}>
      {desenvolvedor && <Tab value={0} label={tr('Testar integração')} />}
      {desenvolvedor && <Tab value={1} label={tr('Documentação')} />}
      {desenvolvedor && <Tab value={2} label={tr('Cache')} />}
      <Tab value={3} label={tr('Chaves')} />
      {desenvolvedor && <Tab value={4} label={tr('Histórico')} />}
    </Tabs>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {aba === 0 && <Paper sx={{ p: 3, display: 'grid', gap: 2 }}>
      <TextField select fullWidth label={tr('Protocolo')} value={idProtocolo} onChange={(evento) => selecionarProtocolo(evento.target.value)}>
        <MenuItem value="">{tr('Sem Protocolo — chamada direta, sem cache')}</MenuItem>
        {protocolos.map((protocolo) => <MenuItem key={protocolo.id} value={protocolo.id}>{protocolo.titulo}</MenuItem>)}
      </TextField>
      <TextField label={tr('Código da consulta')} value={codigo} onChange={(evento) => setCodigo(evento.target.value)} fullWidth />
      <TextField label={tr('Parâmetros JSON')} value={parametros} onChange={(evento) => setParametros(evento.target.value)} multiline minRows={5} fullWidth />
      <Box><Button variant="contained" disabled={carregando || !codigo.trim()} onClick={testar}>{carregando ? <CircularProgress size={22} /> : tr('Executar GET_DATA')}</Button></Box>
      {resposta && <Box>
        <Alert severity={resposta.status ? 'success' : 'warning'} sx={{ mb: 1 }}>{tr('Origem da resposta')}: {resposta.origem}</Alert>
        <Typography variant="subtitle1">{tr('Resposta')}</Typography>
        <Paper variant="outlined" component="pre" sx={{ p: 2, overflowX: 'auto', userSelect: 'text', whiteSpace: 'pre-wrap' }}>{JSON.stringify(resposta, null, 2)}</Paper>
      </Box>}
    </Paper>}
    {aba === 1 && <Paper sx={{ p: 3, overflowX: 'auto', userSelect: 'text', '& h1': { fontSize: '2rem', fontWeight: 700, lineHeight: 1.25, mt: 0, mb: 2 }, '& h2': { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, mt: 4, mb: 1.5 }, '& h3': { fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.4, mt: 3, mb: 1 }, '& p': { lineHeight: 1.7, mb: 2 }, '& ol': { listStyle: 'decimal', pl: 4, mb: 2 }, '& ul': { listStyle: 'disc', pl: 4, mb: 2 }, '& li': { lineHeight: 1.7, mb: 0.5 }, '& pre': { p: 2, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1 }, '& code': { fontFamily: 'monospace' }, '& table': { width: '100%', borderCollapse: 'collapse', mb: 2 }, '& th, & td': { p: 1.5, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left', verticalAlign: 'top' }, '& th': { fontWeight: 700, bgcolor: 'action.hover' } }}>
      {documentacao ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentacao}</ReactMarkdown> : tr('Carregando documentação...')}
    </Paper>}
    {aba === 2 && <Paper sx={{ p: 3, display: 'grid', gap: 2 }}>
      <Typography variant="h6">{tr('Cache por Protocolo')}</Typography>
      <TextField select fullWidth label={tr('Protocolo')} value={idProtocolo} onChange={(evento) => selecionarProtocolo(evento.target.value)}>
        <MenuItem value="">{tr('Selecione um Protocolo')}</MenuItem>
        {protocolos.map((protocolo) => <MenuItem key={protocolo.id} value={protocolo.id}>{protocolo.titulo}</MenuItem>)}
      </TextField>
      {!idProtocolo && <Typography color="text.secondary">{tr('Escolha um Protocolo para inspecionar suas entradas de cache.')}</Typography>}
      {cache === null && <CircularProgress size={24} />}
      {idProtocolo && cache !== null && cache.length === 0 && <Typography color="text.secondary">{tr('Nenhuma entrada válida no cache deste Protocolo.')}</Typography>}
      {(cache || []).map((item) => <Paper key={item.idCache} variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1">{item.codigo}</Typography>
        <Typography variant="body2" color="text.secondary">{tr('Válido até')}: {new Date(item.validadeCacheEm).toLocaleString()}</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button size="small" onClick={() => setInspecionado(inspecionado === item.idCache ? '' : item.idCache)}>{tr(inspecionado === item.idCache ? 'Ocultar dados' : 'Inspecionar dados')}</Button>
          <Button size="small" color="error" onClick={() => invalidar(item.idCache)}>{tr('Invalidar')}</Button>
        </Box>
        {inspecionado === item.idCache && <Paper variant="outlined" component="pre" sx={{ p: 2, mt: 2, overflowX: 'auto', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{JSON.stringify(item.resposta, null, 2)}</Paper>}
      </Paper>)}
      {cache?.length === 100 && <Alert severity="info">{tr('Exibindo as primeiras 100 entradas. Refine a consulta em uma próxima versão da ferramenta.')}</Alert>}
    </Paper>}
    {aba === 3 && <ChavesWebhook />}
    {aba === 4 && <HistoricoIntegracao />}
  </Box>;
}
