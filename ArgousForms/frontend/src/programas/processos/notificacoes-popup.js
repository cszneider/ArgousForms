'use client';

import { Badge, Box, CircularProgress, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { Bell } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';

export default function NotificacoesPopup({ naoLidas, itens, carregando, erro, anchor, aoAbrir, aoFechar, aoSelecionar, aoVerTodas }) {
  const { t, system } = useI18n();

  return <>
    <IconButton aria-label={`${t('Notificações')}: ${naoLidas} ${t('não lidas')}`} title={t('Notificações')}
      onClick={aoAbrir} aria-controls={anchor ? 'menu-notificacoes' : undefined} aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
      <Badge badgeContent={naoLidas} color="error" max={99}><Bell size={20} /></Badge>
    </IconButton>
    <Menu id="menu-notificacoes" anchorEl={anchor} open={Boolean(anchor)} onClose={aoFechar}
      slotProps={{ paper: { sx: { width: 390, maxWidth: 'calc(100vw - 24px)', maxHeight: 520 } } }}>
      <Box sx={{ px: 2, py: 1.5 }}><Typography variant="subtitle1" fontWeight={700}>{t('Notificações')}</Typography>
        <Typography variant="caption" color="text.secondary">{naoLidas} {t('não lidas')}</Typography></Box>
      <Divider />
      {carregando && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
      {!carregando && erro && <Box sx={{ px: 2, py: 2 }}><Typography color="error" variant="body2">{system(erro)}</Typography></Box>}
      {!carregando && !erro && !itens.length && <Box sx={{ px: 2, py: 3 }}><Typography color="text.secondary" variant="body2">{t('Você não tem notificações.')}</Typography></Box>}
      {!carregando && !erro && itens.map((item) => <MenuItem key={item.id} onClick={() => aoSelecionar(item)}
        sx={{ alignItems: 'flex-start', whiteSpace: 'normal', gap: 1, py: 1.25, bgcolor: item.visualizacao ? undefined : 'action.hover' }}>
        {!item.visualizacao && <Box aria-hidden="true" sx={{ width: 7, height: 7, mt: 0.9, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
        <Box sx={{ ml: item.visualizacao ? '15px' : 0, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={item.visualizacao ? 500 : 700}>{item.titulo}</Typography>
          {item.resumo && <Typography variant="caption" color="text.secondary" display="block">{item.resumo}</Typography>}
          <Typography variant="caption" color="text.secondary">{new Date(item.entrega).toLocaleString()}</Typography>
        </Box>
      </MenuItem>)}
      <Divider />
      <MenuItem onClick={aoVerTodas} sx={{ justifyContent: 'center', color: 'primary.main', fontWeight: 700 }}>{t('Ver todas')}</MenuItem>
    </Menu>
  </>;
}
