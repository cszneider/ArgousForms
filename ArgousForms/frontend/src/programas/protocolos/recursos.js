'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';
import { enviarArquivo } from '../gestor-documentos/upload-arquivo.js';
import SeletorPasta from './seletor-pasta.js';

export default function Recursos({ idProtocolo = null }) {
  const { t, system } = useI18n();
  const instituicao = !idProtocolo;
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [seletor, setSeletor] = useState(false);
  const [envio, setEnvio] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [progresso, setProgresso] = useState(0);
  const [remocao, setRemocao] = useState(null);
  const [edicao, setEdicao] = useState(null);

  const carregar = useCallback(async () => {
    const resultado = await executar(instituicao ? 'LISTAR_RECURSOS_INSTITUICAO' : 'LISTAR_RECURSOS_PROTOCOLO',
      instituicao ? {} : { idProtocolo });
    setDados(resultado);
  }, [instituicao, idProtocolo]);

  useEffect(() => {
    let ativo = true;
    executar(instituicao ? 'LISTAR_RECURSOS_INSTITUICAO' : 'LISTAR_RECURSOS_PROTOCOLO',
      instituicao ? {} : { idProtocolo })
      .then((resultado) => { if (ativo) setDados(resultado); })
      .catch((falha) => { if (ativo) setErro(falha.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [instituicao, idProtocolo]);

  async function associarPasta(pasta) {
    setSalvando(true);
    setErro('');
    try {
      await executar('ASSOCIAR_PASTA_RECURSOS_INSTITUICAO', { idPasta: pasta.idPasta });
      await carregar();
      setSeletor(false);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function enviar() {
    if (!arquivo || !codigo.trim()) return;
    setSalvando(true);
    setErro('');
    setProgresso(0);
    try {
      const formulario = new FormData();
      formulario.append('arquivo', arquivo);
      formulario.append('codigoRecurso', codigo.trim());
      if (instituicao) formulario.append('recursoInstituicao', 'true');
      else formulario.append('idProtocoloRecurso', idProtocolo);
      await enviarArquivo(formulario, setProgresso);
      await carregar();
      setEnvio(false);
      setArquivo(null);
      setCodigo('');
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!remocao) return;
    setSalvando(true);
    setErro('');
    try {
      await executar(instituicao ? 'REMOVER_RECURSO_INSTITUICAO' : 'REMOVER_RECURSO_PROTOCOLO',
        instituicao ? { idArquivoVersao: remocao.idArquivoVersao } : { idProtocolo, idProtocoloRecurso: remocao.idProtocoloRecurso });
      await carregar();
      setRemocao(null);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alterarCodigo() {
    if (!edicao?.codigo?.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      await executar(instituicao ? 'ALTERAR_CODIGO_RECURSO_INSTITUICAO' : 'ALTERAR_CODIGO_RECURSO_PROTOCOLO',
        instituicao ? { idArquivoVersao: edicao.idArquivoVersao, codigo: edicao.codigo.trim() }
          : { idProtocolo, idProtocoloRecurso: edicao.idProtocoloRecurso, codigo: edicao.codigo.trim() });
      await carregar();
      setEdicao(null);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  return <Box sx={{ display: 'grid', gap: 2 }}>
    {carregando && <CircularProgress size={24} />}
    {erro && <Alert severity="error" onClose={() => setErro('')}>{system(erro)}</Alert>}
    <Typography variant="body2" color="text.secondary">
      {instituicao
        ? t('Imagens compartilhadas pelos Protocolos da instituição.')
        : t('Imagens deste Protocolo, compartilhadas entre seus modelos de documento.')}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      {instituicao && <Button variant="outlined" startIcon={<FolderOpen size={17} />} onClick={() => setSeletor(true)}>
        {dados?.idPasta ? t('Trocar pasta') : t('Escolher pasta')}
      </Button>}
      <Button variant="contained" startIcon={<Plus size={17} />} disabled={!dados?.idPasta || salvando}
        onClick={() => setEnvio(true)}>{t('Adicionar imagem')}</Button>
      {!dados?.idPasta && <Typography variant="body2" color="text.secondary">
        {instituicao ? t('Escolha a pasta de recursos antes de enviar imagens.') : t('Associe uma pasta ao Protocolo antes de enviar imagens.')}
      </Typography>}
    </Box>
    {dados?.recursos?.length ? <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 2 }}>
      {dados.recursos.map((recurso) => <Box key={recurso.idArquivoVersao} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
        <Box component="img" src={`/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(recurso.idArquivo)}&idArquivoVersao=${encodeURIComponent(recurso.idArquivoVersao)}&modo=visualizar`}
          alt={recurso.codigo} sx={{ width: '100%', height: 120, objectFit: 'contain', bgcolor: 'background.default' }} />
        <Typography variant="subtitle2" sx={{ mt: 1 }}>{recurso.codigo}</Typography>
        <Typography variant="caption" color="text.secondary">{recurso.nome}</Typography>
        <Box><Button size="small" onClick={() => setEdicao({ ...recurso })}>{t('Editar código')}</Button>
          <Button size="small" color="error" startIcon={<Trash2 size={15} />} onClick={() => setRemocao(recurso)}>{t('Remover vínculo')}</Button></Box>
      </Box>)}
    </Box> : !carregando && <Alert severity="info">{t('Nenhum recurso cadastrado.')}</Alert>}
    {seletor && <SeletorPasta aberto permitirCriacao pastaAtual={dados?.idPasta}
      titulo={t('Escolher pasta de recursos da instituição')} aoFechar={() => setSeletor(false)} aoEscolher={associarPasta} />}
    <Dialog open={envio} onClose={() => !salvando && setEnvio(false)} fullWidth maxWidth="sm">
      <DialogTitle>{t('Adicionar imagem')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <TextField label={t('Código do recurso')} value={codigo} inputProps={{ maxLength: 40 }}
          onChange={(evento) => setCodigo(evento.target.value)} helperText={t('Identifica esta imagem nos modelos de documento.')} />
        <Button variant="outlined" component="label">{arquivo?.name || t('Escolher imagem')}
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(evento) => setArquivo(evento.target.files?.[0] || null)} />
        </Button>
        {salvando && <Typography variant="body2">{t('Enviando imagem')} {progresso}%</Typography>}
      </DialogContent>
      <DialogActions><Button disabled={salvando} onClick={() => setEnvio(false)}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={salvando || !codigo.trim() || !arquivo} onClick={enviar}>{t('Enviar')}</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(edicao)} onClose={() => !salvando && setEdicao(null)} fullWidth maxWidth="xs">
      <DialogTitle>{t('Editar código do recurso')}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}><TextField fullWidth label={t('Código do recurso')}
        value={edicao?.codigo || ''} inputProps={{ maxLength: 40 }}
        onChange={(evento) => setEdicao({ ...edicao, codigo: evento.target.value })} /></DialogContent>
      <DialogActions><Button disabled={salvando} onClick={() => setEdicao(null)}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={salvando || !edicao?.codigo?.trim()} onClick={alterarCodigo}>{t('Salvar')}</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(remocao)} onClose={() => !salvando && setRemocao(null)}>
      <DialogTitle>{t('Remover recurso')}</DialogTitle>
      <DialogContent><Typography>{t('O vínculo será removido. O arquivo continuará no gestor de documentos.')}</Typography></DialogContent>
      <DialogActions><Button disabled={salvando} onClick={() => setRemocao(null)}>{t('Cancelar')}</Button>
        <Button color="error" disabled={salvando} onClick={remover}>{t('Remover vínculo')}</Button></DialogActions>
    </Dialog>
  </Box>;
}
