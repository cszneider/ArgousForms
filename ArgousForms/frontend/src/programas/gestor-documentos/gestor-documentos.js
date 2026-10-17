'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Alert, Box, Breadcrumbs, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, Link, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Download, FileText, Folder, Plus, Upload } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { pageReducer } from '../../utils/page-state.js';
import { useI18n } from '../../components/i18n/i18n.js';
import { enviarArquivo } from './upload-arquivo.js';

export const GestorDocumentosContext = createContext(null);

function Conteudo() {
  const { value, dispatch, carregar, criarPasta, verificarMongo, enviar, abrirArquivo, salvarArquivo, usuario, podeEnviar } = useContext(GestorDocumentosContext);
  const { t, system } = useI18n();
  const pastasDestino = [value.dados?.pasta, ...(value.dados?.pastas || [])].filter((pasta) => pasta?.podeIncluir);

  if (!usuario) return <Alert severity="info">{t('Entre com sua conta para consultar os arquivos da instituição.')}</Alert>;

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">{t('ARQUIVOS DA INSTITUIÇÃO')}</span>
        <h1>{t('Documentos')}</h1>
        <p>{t('Navegue pelas pastas e consulte os arquivos autorizados.')}</p>
      </div>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {value.dados?.pasta?.gestor && <Button variant="outlined" startIcon={<Plus size={18} />}
          onClick={() => dispatch({ field: 'novaPastaAberta', value: true })}>{t('Nova pasta')}</Button>}
        {podeEnviar && <Button variant="contained" startIcon={<Upload size={18} />} disabled={!value.mongo?.disponivel || !pastasDestino.length}
          onClick={() => { dispatch({ field: 'pastaDestino', value: pastasDestino[0].idPasta }); dispatch({ field: 'envioAberto', value: true }); }}>
          {t('Enviar arquivo')}
        </Button>}
      </Box>
    </div>

    {value.loading && <LinearProgress sx={{ mb: 2 }} />}
    {value.error && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={carregar}>{t('Tentar novamente')}</Button>}>
      {system(value.error)}
    </Alert>}
    {podeEnviar && value.mongo && !value.mongo.disponivel && <Alert severity="warning" sx={{ mb: 2 }}
      action={<Button onClick={verificarMongo}>{t('Verificar novamente')}</Button>}>
      {system(value.mongo.mensagem || 'O armazenamento de arquivos não está disponível.')}
    </Alert>}
    {!value.loading && !value.error && value.dados && <>
      <Breadcrumbs aria-label={t('Caminho da pasta')} sx={{ mb: 2 }}>
        {value.dados.caminho.map((item, indice) => indice === value.dados.caminho.length - 1
          ? <Typography key={item.idPasta} color="text.primary">{item.nome}</Typography>
          : <Link key={item.idPasta} component="button" type="button" underline="hover"
              onClick={() => dispatch({ field: 'idPasta', value: item.idPasta })}>{item.nome}</Link>)}
      </Breadcrumbs>
      <TableContainer component={Paper} className="panel">
        <Table aria-label={t('Conteúdo da pasta')}>
          <TableHead><TableRow>
            <TableCell>{t('NOME')}</TableCell><TableCell>{t('TIPO')}</TableCell><TableCell>{t('TAMANHO')}</TableCell><TableCell>{t('VERSÃO')}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {value.dados.pastas.map((pasta) => <TableRow key={pasta.idPasta} hover>
              <TableCell><Button sx={{ textTransform: 'none' }} startIcon={<Folder size={18} />}
                onClick={() => dispatch({ field: 'idPasta', value: pasta.idPasta })}>{pasta.nome}</Button></TableCell>
              <TableCell>{t('Pasta')}</TableCell><TableCell>—</TableCell><TableCell>—</TableCell>
            </TableRow>)}
            {value.dados.arquivos.map((arquivo) => <TableRow key={arquivo.idArquivo} hover>
              <TableCell><Button sx={{ textTransform: 'none' }} startIcon={<FileText size={18} />}
                onClick={() => abrirArquivo(arquivo.idArquivo)}>{arquivo.nome}</Button></TableCell>
              <TableCell>{arquivo.contentType || '—'}</TableCell>
              <TableCell>{arquivo.tamanhoBytes == null ? '—' : `${(arquivo.tamanhoBytes / 1048576).toFixed(2)} MiB`}</TableCell>
              <TableCell>{arquivo.versao ?? '—'}</TableCell>
            </TableRow>)}
            {!value.dados.pastas.length && !value.dados.arquivos.length && <TableRow>
              <TableCell colSpan={4}>{t('Esta pasta não contém itens disponíveis para sua conta.')}</TableCell>
            </TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </>}
    <Dialog open={value.novaPastaAberta} onClose={() => !value.salvandoPasta && dispatch({ field: 'novaPastaAberta', value: false })} fullWidth maxWidth="sm">
      <DialogTitle>{t('Nova pasta')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <Typography variant="body2">{t('Dentro de')} {value.dados?.pasta?.nome}</Typography>
        <TextField label={t('Nome da pasta')} value={value.nomeNovaPasta} inputProps={{ maxLength: 255 }}
          onChange={(event) => dispatch({ field: 'nomeNovaPasta', value: event.target.value })} />
        <TextField label={t('Descrição')} value={value.descricaoNovaPasta} multiline minRows={2}
          onChange={(event) => dispatch({ field: 'descricaoNovaPasta', value: event.target.value })} />
        {value.erroNovaPasta && <Alert severity="error">{system(value.erroNovaPasta)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={value.salvandoPasta} onClick={() => dispatch({ field: 'novaPastaAberta', value: false })}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={value.salvandoPasta || !value.nomeNovaPasta.trim()} onClick={criarPasta}>{t('Criar pasta')}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={value.envioAberto} onClose={() => !value.enviando && dispatch({ field: 'envioAberto', value: false })} fullWidth maxWidth="sm">
      <DialogTitle>{t('Enviar arquivo')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <Button component="label" variant="outlined" startIcon={<Upload size={18} />}>
          {value.arquivo ? value.arquivo.name : t('Escolher arquivo')}
          <input hidden type="file" onChange={(event) => dispatch({ field: 'arquivo', value: event.target.files?.[0] || null })} />
        </Button>
        <FormControl fullWidth>
          <InputLabel>{t('Pasta de destino')}</InputLabel>
          <Select label={t('Pasta de destino')} value={value.pastaDestino || ''}
            onChange={(event) => dispatch({ field: 'pastaDestino', value: event.target.value })}>
            {value.dados?.pasta?.podeIncluir && <MenuItem value={value.dados.pasta.idPasta}>{value.dados.pasta.nome}</MenuItem>}
            {value.dados?.pastas.filter((pasta) => pasta.podeIncluir).map((pasta) =>
              <MenuItem key={pasta.idPasta} value={pasta.idPasta}>{pasta.nome}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label={t('Título (opcional)')} value={value.tituloArquivo}
          onChange={(event) => dispatch({ field: 'tituloArquivo', value: event.target.value })} inputProps={{ maxLength: 255 }} />
        <TextField label={t('Descrição (opcional)')} value={value.descricaoArquivo} multiline minRows={2}
          onChange={(event) => dispatch({ field: 'descricaoArquivo', value: event.target.value })} />
        <FormControl fullWidth>
          <InputLabel>{t('Classificação')}</InputLabel>
          <Select label={t('Classificação')} value={value.classificacaoArquivo}
            onChange={(event) => dispatch({ field: 'classificacaoArquivo', value: event.target.value })}>
            <MenuItem value="L">{t('Dados livres')}</MenuItem>
            <MenuItem value="S">{t('Dados sensíveis')}</MenuItem>
            <MenuItem value="A">{t('Dados anonimizados')}</MenuItem>
          </Select>
        </FormControl>
        <TextField label={t('Validade em dias (opcional)')} type="number" value={value.diasValidade}
          onChange={(event) => dispatch({ field: 'diasValidade', value: event.target.value })} inputProps={{ min: 1, max: 36500 }} />
        <FormControl fullWidth>
          <InputLabel>{t('Se já existir um arquivo com este nome')}</InputLabel>
          <Select label={t('Se já existir um arquivo com este nome')} value={value.modoConflito}
            onChange={(event) => dispatch({ field: 'modoConflito', value: event.target.value })}>
            <MenuItem value="NOVO_ARQUIVO">{t('Criar outro arquivo com número no nome')}</MenuItem>
            <MenuItem value="NOVA_VERSAO">{t('Adicionar uma versão ao arquivo existente')}</MenuItem>
          </Select>
        </FormControl>
        {value.modoConflito === 'NOVA_VERSAO' && <Alert severity="info">
          {t('Se o nome já existir, a nova versão manterá o título, a classificação e a validade do arquivo existente.')}
        </Alert>}
        {value.mongo?.limiteBytes && <Typography variant="caption">
          {t('Tamanho máximo')}: {(value.mongo.limiteBytes / 1048576).toFixed(1)} MiB
        </Typography>}
        {value.enviando && <Box><LinearProgress variant={value.progressoEnvio < 100 ? 'determinate' : 'indeterminate'}
          value={value.progressoEnvio} /><Typography variant="caption">{value.progressoEnvio < 100
            ? `${value.progressoEnvio}%` : t('Concluindo gravação...')}</Typography></Box>}
        {value.erroEnvio && <Alert severity="error">{system(value.erroEnvio)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={value.enviando} onClick={() => dispatch({ field: 'envioAberto', value: false })}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={value.enviando || !value.arquivo || !value.pastaDestino} onClick={enviar}>{t('Enviar')}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={value.detalheAberto} onClose={() => !value.salvandoArquivo && dispatch({ field: 'detalheAberto', value: false })}
      fullWidth maxWidth="md">
      <DialogTitle>{value.arquivoDetalhe?.nome || t('Arquivo')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {value.carregandoArquivo && <LinearProgress />}
        {value.erroDetalhe && <Alert severity="error">{system(value.erroDetalhe)}</Alert>}
        {value.carregandoArquivo && <Box component="output" aria-live="polite"
          sx={{ minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <CircularProgress />
          <Typography variant="body2">{t('Carregando arquivo...')}</Typography>
        </Box>}
        {value.arquivoDetalhe && <>
          {['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(value.arquivoDetalhe.contentType?.toLowerCase())
            ? <Box sx={{ position: 'relative', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                {value.arquivoDetalhe.contentType?.toLowerCase() === 'application/pdf' && <Alert severity="info"
                  icon={value.previewCarregando ? <CircularProgress size={18} /> : undefined} sx={{ width: '100%' }}>
                  {value.previewCarregando ? t('Carregando arquivo...') : t('Se o PDF ainda estiver em branco, aguarde a apresentação pelo navegador.')}
                </Alert>}
                {value.previewCarregando && !value.previewErro && value.arquivoDetalhe.contentType?.toLowerCase() !== 'application/pdf' && <Box component="output" aria-live="polite"
                  sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <CircularProgress />
                  <Typography variant="body2">{t('Carregando arquivo...')}</Typography>
                </Box>}
                {value.previewErro && <Alert severity="error">{t('Não foi possível carregar a visualização do arquivo.')}</Alert>}
                {value.previewUrl && (value.arquivoDetalhe.contentType?.toLowerCase() === 'application/pdf'
                  ? <Box component="iframe" title={value.arquivoDetalhe.titulo} src={value.previewUrl}
                      onLoad={() => dispatch({ field: 'previewCarregando', value: false })}
                      onError={() => { dispatch({ field: 'previewErro', value: true }); dispatch({ field: 'previewCarregando', value: false }); }}
                      sx={{ width: '100%', height: 420, border: 0 }} />
                  : <Box component="img" alt={value.arquivoDetalhe.titulo} src={value.previewUrl}
                      onLoad={() => dispatch({ field: 'previewCarregando', value: false })}
                      onError={() => { dispatch({ field: 'previewErro', value: true }); dispatch({ field: 'previewCarregando', value: false }); }}
                      sx={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', opacity: value.previewCarregando || value.previewErro ? 0 : 1 }} />)}
              </Box>
            : <Alert severity="info">{t('Este tipo de arquivo não possui visualização direta.')}</Alert>}
          <Typography variant="body2">{t('Nome')}: {value.arquivoDetalhe.nome} · MIME: {value.arquivoDetalhe.contentType || '—'} · {t('Versão')}: {value.arquivoDetalhe.versao ?? '—'}</Typography>
          <Typography variant="body2">{t('Tamanho')}: {value.arquivoDetalhe.tamanhoBytes == null ? '—' : `${(value.arquivoDetalhe.tamanhoBytes / 1048576).toFixed(2)} MiB`} · {t('Criado em')}: {value.arquivoDetalhe.inclusao ? new Date(value.arquivoDetalhe.inclusao).toLocaleDateString() : '—'}</Typography>
          <TextField label={t('Título')} value={value.detalheTitulo} disabled={!value.arquivoDetalhe.podeEditar}
            inputProps={{ maxLength: 255 }} onChange={(event) => dispatch({ field: 'detalheTitulo', value: event.target.value })} />
          <TextField label={t('Descrição')} value={value.detalheDescricao} disabled={!value.arquivoDetalhe.podeEditar}
            multiline minRows={2} onChange={(event) => dispatch({ field: 'detalheDescricao', value: event.target.value })} />
          <FormControl fullWidth disabled={!value.arquivoDetalhe.podeEditar}>
            <InputLabel>{t('Classificação')}</InputLabel>
            <Select label={t('Classificação')} value={value.detalheClassificacao}
              onChange={(event) => dispatch({ field: 'detalheClassificacao', value: event.target.value })}>
              <MenuItem value="L">{t('Dados livres')}</MenuItem><MenuItem value="S">{t('Dados sensíveis')}</MenuItem>
              <MenuItem value="A">{t('Dados anonimizados')}</MenuItem>
            </Select>
          </FormControl>
          <TextField label={t('Data de validade')} type="date" value={value.detalheVencimento}
            disabled={!value.arquivoDetalhe.podeAlterarValidade} InputLabelProps={{ shrink: true }}
            helperText={value.arquivoDetalhe.podeAlterarValidade ? t('A validade termina ao fim do dia informado (UTC). Deixe em branco para não vencer.') : t('Somente um gestor da pasta pode alterar a validade.')}
            onChange={(event) => dispatch({ field: 'detalheVencimento', value: event.target.value })} />
        </>}
      </DialogContent>
      <DialogActions>
        {value.arquivoDetalhe?.podeBaixar && <Button component="a" href={urlConteudo(value.arquivoDetalhe.idArquivo, 'baixar')}
          startIcon={<Download size={18} />}>{t('Baixar')}</Button>}
        <Button onClick={() => dispatch({ field: 'detalheAberto', value: false })}>{t('Fechar')}</Button>
        {value.arquivoDetalhe?.podeEditar && <Button variant="contained" disabled={value.salvandoArquivo || !value.detalheTitulo.trim()}
          onClick={salvarArquivo}>{t('Salvar alterações')}</Button>}
      </DialogActions>
    </Dialog>
  </>;
}

function urlConteudo(idArquivo, modo) {
  return `/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(idArquivo)}&modo=${modo}`;
}

export default function GestorDocumentos({ usuario, podeEnviar }) {
  const initialState = useMemo(() => ({ idPasta: null, dados: null, loading: false, error: '',
    novaPastaAberta: false, nomeNovaPasta: '', descricaoNovaPasta: '', salvandoPasta: false, erroNovaPasta: '',
    mongo: null, envioAberto: false, arquivo: null, pastaDestino: '', tituloArquivo: '', descricaoArquivo: '',
    classificacaoArquivo: 'L', diasValidade: '', modoConflito: 'NOVO_ARQUIVO', enviando: false, progressoEnvio: 0, erroEnvio: '',
    detalheAberto: false, carregandoArquivo: false, salvandoArquivo: false, erroDetalhe: '', arquivoDetalhe: null,
    previewCarregando: false, previewErro: false, previewUrl: null,
    detalheTitulo: '', detalheDescricao: '', detalheClassificacao: 'L', detalheVencimento: '' }), []);
  const initialStateRef = useRef(initialState);
  const [value, dispatch] = useReducer(pageReducer, initialState);
  const requestRef = useRef(0);

  const carregar = useCallback(async () => {
    if (!usuario) return;
    const atual = ++requestRef.current;
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'error', value: '' });
    dispatch({ field: 'dados', value: null });
    try {
      const dados = await executar('LISTAR_PASTA', { idPasta: value.idPasta });
      if (atual === requestRef.current) dispatch({ field: 'dados', value: dados });
    } catch (error) {
      if (atual === requestRef.current) dispatch({ field: 'error', value: error.message });
    } finally {
      if (atual === requestRef.current) dispatch({ field: 'loading', value: false });
    }
  }, [usuario, value.idPasta]);

  const criarPasta = useCallback(async () => {
    if (!value.dados?.pasta?.idPasta) return;
    dispatch({ field: 'salvandoPasta', value: true });
    dispatch({ field: 'erroNovaPasta', value: '' });
    try {
      await executar('CRIAR_PASTA', { idPastaPai: value.dados.pasta.idPasta,
        nome: value.nomeNovaPasta.trim(), descricao: value.descricaoNovaPasta.trim() });
      dispatch({ field: 'novaPastaAberta', value: false });
      dispatch({ field: 'nomeNovaPasta', value: '' });
      dispatch({ field: 'descricaoNovaPasta', value: '' });
      await carregar();
    } catch (error) {
      dispatch({ field: 'erroNovaPasta', value: error.message });
    } finally {
      dispatch({ field: 'salvandoPasta', value: false });
    }
  }, [value.dados, value.nomeNovaPasta, value.descricaoNovaPasta, carregar]);

  const verificarMongo = useCallback(async () => {
    if (!usuario || !podeEnviar) return;
    try {
      dispatch({ field: 'mongo', value: await executar('VERIFICAR_MONGODB') });
    } catch (error) {
      dispatch({ field: 'mongo', value: { disponivel: false, mensagem: error.message } });
    }
  }, [usuario, podeEnviar]);

  const enviar = useCallback(async () => {
    if (!value.arquivo || !value.pastaDestino) return;
    if (value.arquivo.size > (value.mongo?.limiteBytes || 0)) {
      dispatch({ field: 'erroEnvio', value: 'O arquivo excede o limite da instituição.' });
      return;
    }
    const dados = new FormData();
    dados.append('arquivo', value.arquivo);
    dados.append('idPasta', value.pastaDestino);
    dados.append('titulo', value.tituloArquivo);
    dados.append('descricao', value.descricaoArquivo);
    dados.append('classificacao', value.classificacaoArquivo);
    dados.append('diasValidade', value.diasValidade);
    dados.append('modoConflito', value.modoConflito);
    dispatch({ field: 'erroEnvio', value: '' });
    dispatch({ field: 'progressoEnvio', value: 0 });
    dispatch({ field: 'enviando', value: true });
    try {
      await enviarArquivo(dados, (progresso) => dispatch({ field: 'progressoEnvio', value: progresso }));
      dispatch({ field: 'envioAberto', value: false });
      dispatch({ field: 'arquivo', value: null });
      dispatch({ field: 'tituloArquivo', value: '' });
      dispatch({ field: 'descricaoArquivo', value: '' });
      dispatch({ field: 'diasValidade', value: '' });
      if (value.pastaDestino === value.dados?.pasta?.idPasta) await carregar();
      else dispatch({ field: 'idPasta', value: value.pastaDestino });
    } catch (error) {
      dispatch({ field: 'erroEnvio', value: error.message });
    } finally {
      dispatch({ field: 'enviando', value: false });
    }
  }, [value, carregar]);

  const abrirArquivo = useCallback(async (idArquivo) => {
    dispatch({ field: 'detalheAberto', value: true });
    dispatch({ field: 'carregandoArquivo', value: true });
    dispatch({ field: 'previewCarregando', value: true });
    dispatch({ field: 'previewErro', value: false });
    dispatch({ field: 'previewUrl', value: null });
    dispatch({ field: 'erroDetalhe', value: '' });
    dispatch({ field: 'arquivoDetalhe', value: null });
    try {
      const arquivo = await executar('CONSULTAR_ARQUIVO', { idArquivo });
      dispatch({ field: 'arquivoDetalhe', value: arquivo });
      dispatch({ field: 'detalheTitulo', value: arquivo.titulo || '' });
      dispatch({ field: 'detalheDescricao', value: arquivo.descricao || '' });
      dispatch({ field: 'detalheClassificacao', value: arquivo.classificacao });
      dispatch({ field: 'detalheVencimento', value: arquivo.vencimento?.slice(0, 10) || '' });
    } catch (error) {
      dispatch({ field: 'erroDetalhe', value: error.message });
    } finally {
      dispatch({ field: 'carregandoArquivo', value: false });
    }
  }, []);

  const idPreview = value.arquivoDetalhe?.idArquivo;
  const tipoPreview = value.arquivoDetalhe?.contentType?.toLowerCase();
  useEffect(() => {
    if (!value.detalheAberto || !idPreview || !['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(tipoPreview)) return;

    const controlador = new AbortController();
    let url = null;
    async function buscarConteudo() {
      try {
        const resposta = await fetch(urlConteudo(idPreview, 'visualizar'), {
          credentials: 'same-origin', cache: 'no-store', signal: controlador.signal,
        });
        if (!resposta.ok) {
          const erro = await resposta.json().catch(() => null);
          throw new Error(erro?.mensagem || 'Não foi possível carregar a visualização do arquivo.');
        }
        const conteudo = await resposta.blob();
        if (controlador.signal.aborted) return;
        url = URL.createObjectURL(conteudo);
        dispatch({ field: 'previewUrl', value: url });
      } catch (error) {
        if (controlador.signal.aborted) return;
        dispatch({ field: 'previewErro', value: true });
        dispatch({ field: 'previewCarregando', value: false });
        dispatch({ field: 'erroDetalhe', value: error.message });
      }
    }
    buscarConteudo();
    return () => {
      controlador.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [value.detalheAberto, idPreview, tipoPreview]);

  const salvarArquivo = useCallback(async () => {
    if (!value.arquivoDetalhe) return;
    dispatch({ field: 'salvandoArquivo', value: true });
    dispatch({ field: 'erroDetalhe', value: '' });
    try {
      const dados = { idArquivo: value.arquivoDetalhe.idArquivo, titulo: value.detalheTitulo.trim(),
        descricao: value.detalheDescricao.trim(), classificacao: value.detalheClassificacao };
      if (value.arquivoDetalhe.podeAlterarValidade && value.detalheVencimento !== (value.arquivoDetalhe.vencimento?.slice(0, 10) || '')) {
        dados.vencimento = value.detalheVencimento;
      }
      await executar('SALVAR_ARQUIVO', dados);
      await carregar();
      dispatch({ field: 'detalheAberto', value: false });
    } catch (error) {
      dispatch({ field: 'erroDetalhe', value: error.message });
    } finally {
      dispatch({ field: 'salvandoArquivo', value: false });
    }
  }, [value.arquivoDetalhe, value.detalheTitulo, value.detalheDescricao, value.detalheClassificacao, value.detalheVencimento, carregar]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { verificarMongo(); }, [verificarMongo]);
  const contextValues = useMemo(() => ({ telaAtual: 'GestorDocumentos', loading: value.loading,
    value, dispatch, initialStateRef, carregar, criarPasta, verificarMongo, enviar, abrirArquivo, salvarArquivo, usuario, podeEnviar }),
    [value, carregar, criarPasta, verificarMongo, enviar, abrirArquivo, salvarArquivo, usuario, podeEnviar]);
  return <GestorDocumentosContext.Provider value={contextValues}><Conteudo /></GestorDocumentosContext.Provider>;
}
