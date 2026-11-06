'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import { Folder, Plus } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';

export default function SeletorPasta({ aberto, pastaAtual, permitirCriacao = false, titulo, aoFechar, aoEscolher }) {
  const { t, system } = useI18n();
  const [idPasta, setIdPasta] = useState(pastaAtual || null);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [novaPasta, setNovaPasta] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_PASTA', idPasta ? { idPasta } : {})
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((falha) => {
        if (!cancelado) {
          setDados(null);
          setErro(falha.message);
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => { cancelado = true; };
  }, [idPasta]);

  function navegar(pasta) {
    setDados(null);
    setErro('');
    setCarregando(true);
    setIdPasta(pasta);
  }

  async function criarPasta() {
    if (!dados?.pasta?.gestor || !nome.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      const criada = await executar('CRIAR_PASTA', {
        idPastaPai: dados.pasta.idPasta,
        nome: nome.trim(),
        descricao: descricao.trim(),
      });
      setNovaPasta(false);
      setNome('');
      setDescricao('');
      navegar(criada.idPasta);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  const podeEscolher = dados?.pasta?.podeLer && dados?.pasta?.podeIncluir;
  const caminho = dados?.caminho?.map((item) => item.nome).join(' / ') || '';

  return (
    <Dialog open={aberto} onClose={aoFechar} fullWidth maxWidth="sm">
      <DialogTitle>{titulo || t('Escolher pasta do Protocolo')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <Typography variant="body2">
          {t('Escolha uma pasta onde você possa ler e incluir arquivos.')}
        </Typography>
        {carregando && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>}
        {erro && <Alert severity="error" action={idPasta
          ? <Button color="inherit" onClick={() => navegar(null)}>{t('Abrir raiz')}</Button>
          : null}>{system(erro)}</Alert>}
        {dados && <>
          <Breadcrumbs aria-label={t('Caminho da pasta')}>
            {dados.caminho.map((item, indice) => indice === dados.caminho.length - 1
              ? <Typography key={item.idPasta} color="text.primary">{item.nome}</Typography>
              : <Link key={item.idPasta} component="button" type="button" underline="hover"
                  onClick={() => navegar(item.idPasta)}>{item.nome}</Link>)}
          </Breadcrumbs>
          <Box sx={{ display: 'grid', gap: 0.5, minHeight: 80 }}>
            {dados.pastas.map((pasta) => <Button key={pasta.idPasta} variant="text" startIcon={<Folder size={18} />}
              onClick={() => navegar(pasta.idPasta)} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
              {pasta.nome}
            </Button>)}
            {!dados.pastas.length && <Typography variant="body2" color="text.secondary">{t('Nenhuma subpasta nesta pasta.')}</Typography>}
          </Box>
          {!podeEscolher && <Alert severity="info">{t('Esta pasta não permite leitura e inclusão para sua conta.')}</Alert>}
          {permitirCriacao && dados.pasta.gestor && !novaPasta && <Button variant="outlined" startIcon={<Plus size={16} />}
            onClick={() => setNovaPasta(true)} sx={{ justifySelf: 'start' }}>{t('Nova pasta')}</Button>}
          {novaPasta && <Box sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label={t('Nome da pasta')} value={nome} inputProps={{ maxLength: 255 }}
              onChange={(evento) => setNome(evento.target.value)} />
            <TextField label={t('Descrição')} value={descricao} multiline minRows={2}
              onChange={(evento) => setDescricao(evento.target.value)} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={() => setNovaPasta(false)} disabled={salvando}>{t('Cancelar')}</Button>
              <Button variant="contained" onClick={criarPasta} disabled={salvando || !nome.trim()}>{t('Criar pasta')}</Button>
            </Box>
          </Box>}
        </>}
      </DialogContent>
      <DialogActions>
        <Button onClick={aoFechar} disabled={salvando}>{t('Fechar')}</Button>
        <Button variant="contained" disabled={!podeEscolher || salvando}
          onClick={() => aoEscolher({ idPasta: dados.pasta.idPasta, nome: dados.pasta.nome, caminho })}>
          {t('Escolher esta pasta')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
