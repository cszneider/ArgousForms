'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';
import Recursos from './recursos.js';

export default function Instituicao() {
  const { t, system } = useI18n();
  const [dados, setDados] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;
    executar('CONSULTAR_INSTITUICAO')
      .then((resultado) => { if (ativo) setDados({ ...resultado,
        diasLixeira: String(resultado.diasLixeira),
        tamanhoMaximoArquivoBytes: String(resultado.tamanhoMaximoArquivoBytes),
      }); })
      .catch((falha) => { if (ativo) setErro(falha.message); });
    return () => { ativo = false; };
  }, []);

  function alterar(campo, valor) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setMensagem('');
  }

  async function salvar() {
    if (!dados || salvando) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      const resultado = await executar('SALVAR_INSTITUICAO', dados);
      setDados({ ...resultado, diasLixeira: String(resultado.diasLixeira),
        tamanhoMaximoArquivoBytes: String(resultado.tamanhoMaximoArquivoBytes) });
      setMensagem(t('Parâmetros da instituição salvos.'));
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  return <Box sx={{ display: 'grid', gap: 4 }}>
    <section>
      <Box sx={{ mb: 2 }}><Typography variant="h6">{t('Parâmetros da instituição')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('Configure as regras gerais e os endereços de integração.')}</Typography></Box>
      {!dados && !erro && <CircularProgress size={24} />}
      {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>{system(erro)}</Alert>}
      {mensagem && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMensagem('')}>{mensagem}</Alert>}
      {dados && <Box sx={{ display: 'grid', gap: 2, maxWidth: 800 }}>
        <TextField label={t('Nome da instituição')} value={dados.nome || ''} inputProps={{ maxLength: 200 }}
          onChange={(evento) => alterar('nome', evento.target.value)} required />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <TextField label={t('Dias de permanência na lixeira')} type="number" value={dados.diasLixeira}
            inputProps={{ min: 1, step: 1 }} onChange={(evento) => alterar('diasLixeira', evento.target.value)} required />
          <TextField label={t('Tamanho máximo de arquivo (bytes)')} type="number" value={dados.tamanhoMaximoArquivoBytes}
            inputProps={{ min: 1, max: 2147483647, step: 1 }}
            helperText={t('104857600 bytes correspondem a 100 MiB.')} onChange={(evento) => alterar('tamanhoMaximoArquivoBytes', evento.target.value)} required />
        </Box>
        <FormControlLabel control={<Switch checked={Boolean(dados.permitirDestinatariosUnicos)}
          onChange={(evento) => alterar('permitirDestinatariosUnicos', evento.target.checked)} />}
          label={t('Permitir etapas com destinatário único nominal')} />
        <TextField label={t('Fuso horário')} value={dados.fusoHorario || ''} inputProps={{ maxLength: 64 }}
          helperText={t('Exemplo: America/Sao_Paulo')} onChange={(evento) => alterar('fusoHorario', evento.target.value)} required />
        <TextField label={t('URL do webhook principal')} value={dados.urlWebhook || ''} type="url"
          onChange={(evento) => alterar('urlWebhook', evento.target.value)}
          helperText={t('Deixe vazio enquanto a integração não estiver configurada.')} />
        <TextField label={t('URL do webhook alternativo')} value={dados.urlWebhookAlternativo || ''} type="url"
          onChange={(evento) => alterar('urlWebhookAlternativo', evento.target.value)}
          helperText={t('Usado quando o webhook principal estiver indisponível.')} />
        <Box><Button variant="contained" disabled={salvando} onClick={salvar}>{salvando ? t('Salvando…') : t('Salvar parâmetros')}</Button></Box>
      </Box>}
    </section>
    <section><Typography variant="h6" sx={{ mb: 2 }}>{t('Recursos da instituição')}</Typography><Recursos /></section>
  </Box>;
}
