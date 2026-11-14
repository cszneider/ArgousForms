'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';

const data = (valor) => valor ? new Date(valor).toLocaleString() : '—';

export default function ChavesWebhook() {
  const { t } = useI18n();
  const [chaves, setChaves] = useState(null);
  const [erro, setErro] = useState('');
  const [titulo, setTitulo] = useState('');
  const [semVencimento, setSemVencimento] = useState(false);
  const [vencimento, setVencimento] = useState('');

  useEffect(() => {
    let ativo = true;
    executar('LISTAR_CHAVES_WEBHOOK').then((resposta) => {
      if (ativo) {
        const itens = resposta.itens || [];
        setChaves(itens);
        setTitulo((atual) => atual || `Chave ${itens.length + 1}`);
      }
    }).catch((falha) => { if (ativo) setErro(falha.message); });
    return () => { ativo = false; };
  }, []);

  const situacao = (chave) => {
    if (chave.invalidacao) return t('Invalidada');
    if (chave.vencimento && new Date(chave.vencimento) <= new Date()) return t('Vencida');
    if (chave.ativacao) return t('Em uso');
    return t('Preparada');
  };

  return <Stack spacing={3}>
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>{t('Chaves do webhook')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{t('Uma chave é exibida apenas na criação. Depois disso, a lista mostra somente seu nome e suas datas.')}</Typography>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      {chaves === null && !erro && <CircularProgress size={24} />}
      {chaves?.length === 0 && <Typography color="text.secondary">{t('Nenhuma chave cadastrada.')}</Typography>}
      {chaves?.map((chave) => <Paper key={chave.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography fontWeight={700}>{chave.titulo}</Typography>
            <Typography variant="body2" color="text.secondary">{t('Criada em')}: {data(chave.inclusao)} · {t('Vence em')}: {chave.vencimento ? data(chave.vencimento) : t('Sem vencimento')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('Identificador')}: {chave.id}</Typography>
          </Box>
          <Typography color="text.secondary" fontWeight={600}>{situacao(chave)}</Typography>
        </Stack>
      </Paper>)}
    </Paper>
    <Paper sx={{ p: 3, display: 'grid', gap: 2 }}>
      <Typography variant="h6">{t('Preparar nova chave')}</Typography>
      <TextField label={t('Nome da chave')} value={titulo} onChange={(evento) => setTitulo(evento.target.value)} inputProps={{ maxLength: 100 }} helperText={t('Você pode substituir o nome sugerido.')} />
      <FormControlLabel control={<Checkbox checked={semVencimento} onChange={(evento) => setSemVencimento(evento.target.checked)} />} label={t('Sem vencimento')} />
      {!semVencimento && <TextField label={t('Data de vencimento')} type="datetime-local" value={vencimento} onChange={(evento) => setVencimento(evento.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
      {semVencimento && <Alert severity="warning">{t('Uma chave sem vencimento continuará válida até ser invalidada. Revise esta escolha antes de confirmar a criação.')}</Alert>}
      <Alert severity="info">{t('A geração e a cópia da chave serão habilitadas quando a cifragem e a ativação estiverem implementadas no backend. Nenhuma chave é criada nesta tela por enquanto.')}</Alert>
      <Box><Button variant="contained" disabled>{t('Gerar chave e copiar')}</Button></Box>
    </Paper>
  </Stack>;
}
